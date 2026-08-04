# Fanta Montelago — istruzioni per chi riprende il lavoro

Il fantacalcio del Montelago Celtic Festival, di **Daniele Polucci**
(MadStoryteller11) per **La Compagnia di Sotto Monte**. È in uso reale: il
gruppo ci gioca davvero, quindi ogni modifica arriva subito a persone vere.

- App: <https://compagniasottomonte.github.io/fantamontelago/>
- Guida pubblica: `guida.html` sullo stesso indirizzo
- Repository: `compagniasottomonte/fantamontelago`

## Le tre regole che contano

1. **Niente passaggio di build.** L'app è fatta di moduli ES nativi caricati
   direttamente dal browser. Non introdurre Vite, bundler o npm install: sulla
   macchina di Daniele c'è **Node 14**, troppo vecchio per qualunque toolchain
   moderno, e senza build il deploy è un semplice `git push`.
2. **Il codice deve convivere con lo schema vecchio.** Il push pubblica subito,
   ma la migrazione del database la esegue Daniele a mano, dopo. In quella
   finestra il codice nuovo gira sul database vecchio: ogni colonna aggiunta va
   letta con un ripiego (vedi `statoRegola()` in `js/stato.js`). Questo errore è
   già stato commesso una volta e ha reso l'app inservibile.
3. **Si scrive in italiano.** Nomi di funzioni, variabili, commenti, messaggi.
   Ogni nuovo file porta l'intestazione con nome, versione, uso e autore.

## Com'è fatta

```
index.html            guscio; i moduli riempiono #app, #nav, #intestazione
guida.html            pagina condivisibile, statica, indipendente dall'app
sw.js                 service worker: copia locale, "prima la rete" con limite di 4 s
assets/style.css      tema scuro unico
assets/installa/      schermate della guida all'installazione
js/config.js          credenziali Supabase (la chiave pubblica sta nel codice)
js/api.js             unico punto di contatto col database
js/coda.js            eventi segnati senza campo, in IndexedDB, e la spedizione
js/locale.js          copia dell'ultimo caricamento e di chi e' entrato
js/stato.js           stato condiviso e calcoli derivati (classifica, titoli, stagione)
js/titoli.js          soprannomi automatici, riconosciuti per parole chiave
js/card.js            immagini condivisibili 1080x1920: evento, recap, poster
js/app.js             router, smistamento dei click, avvio
js/views/*.js         una schermata per file, ognuna esporta render() e azioni
supabase/schema.sql   tabelle, policy, trigger, funzioni: rieseguibile senza danni
promo/messaggi.md     testi pronti da condividere
```

Ogni vista espone `render()` che restituisce HTML e un oggetto `azioni`
indicizzato dagli attributi `data-act`. `app.js` intercetta i click e chiama
l'azione giusta. Le viste non parlano mai direttamente con Supabase.

## Senza campo

Al festival la rete manca, ed e' proprio quando serve segnare. Tre pezzi
lavorano insieme, e vanno capiti insieme:

- **`js/locale.js`** tiene in `localStorage` l'ultimo `caricaTutto()` riuscito e
  l'identita' di chi e' entrato. E' l'unico posto dove l'app mostra dati che
  potrebbero non essere piu' veri, e infatti lo dichiara: `stato.senzaRete`
  accende un avviso rosso in cima con la data della copia. Il service worker
  continua a non toccare le chiamate a Supabase, e ha ragione: una copia
  nascosta darebbe una classifica falsa senza che nessuno se ne accorga.
- **La sessione sopravvive.** Il permesso di Supabase dura un'ora e senza rete
  non si rinnova: dopo un pomeriggio nei prati l'app tornerebbe alla schermata
  di accesso, che offline non porta da nessuna parte. Se `getSession()` non da'
  niente **e** il browser si dichiara offline **e** c'e' un utente ricordato,
  `app.js` va avanti con `stato.sessione = { offline: true }`. Per stare offline
  basta sapere chi siamo; il permesso vero si riprende al ritorno del campo.
- **`js/coda.js`** conserva in IndexedDB gli eventi segnati senza linea, foto
  compresa (`localStorage` non tiene i blob e sta stretto in cinque mega).
  La foto si comprime al momento di accodare, non alla spedizione.

Due modi di fallire, da non confondere mai: se manca la linea non si e' perso
niente, si smette e si riprova; se e' il database a dire di no (stagione
chiusa, personaggio cancellato) riprovare non servira' mai, la voce resta in
coda marcata col motivo e decide chi l'ha scritta. `api.senzaRete(errore)` e'
il posto dove si distinguono.

Gli eventi in coda partono con il loro `creato_il` vero, quello di quando il
fatto e' successo, non di quando il telefono ha ritrovato il campo.

**Non basta ascoltare l'evento `online`, e questo e' costato una prova sul
campo.** Quell'evento scatta quando la scheda di rete si riaccende, che e'
parecchio prima che la connessione serva a qualcosa: il primo tentativo
fallisce sempre. Provando una volta sola la segnalazione restava ferma finche'
qualcuno non premeva il pulsante a mano. `sorvegliaLaCoda()` in `app.js`
riprova a 5, 15, 30 e 60 secondi, e ricomincia dall'attesa breve ogni volta che
qualcosa parte, cosi' il resto della coda segue subito. Il timer si spegne da
solo quando non resta niente da spedire, e non sorveglia le voci respinte:
riprovarle non le farebbe passare. L'invio riparte anche riaprendo l'app
(`visibilitychange`), sul pulsante ⟳ e a mano dalla scheda Segna. **Uscendo dall'account la coda si butta**, dopo averlo chiesto:
il database attribuisce l'evento a chi lo spedisce, e una segnalazione altrui
finirebbe intestata a chi entra dopo.

## Il database

Lo schema sta tutto in `supabase/schema.sql` ed è **rieseguibile**: `create table
if not exists`, `create or replace function`, policy sempre `drop` e ricreate,
migrazioni come `alter table ... add column if not exists`.

Concetti da conoscere prima di toccarlo:

- **Le regole di sicurezza stanno nel database, non nell'interfaccia.** Chi non
  arbitra può *proporre* eventi e regole ma non renderli validi: lo impongono i
  trigger `forza_stato_evento` e `forza_stato_regola`, non i pulsanti.
- **Punteggi e descrizioni degli eventi vengono riletti dal database** a partire
  dalla regola citata: non sono falsificabili dal browser.
- Le funzioni `security definer` (`crea_accampamento`, `entra_con_codice`,
  `rivendica_personaggio`, `imposta_titolo`…) scavalcano la RLS di proposito, e
  sono l'unico modo per operazioni che altrimenti si morderebbero la coda.
- Due regole promozionali sono **protette**: non si cancellano, non si spengono,
  non si modificano. L'elenco è in `regola_protetta()`.
- La RLS **non** vale per le cancellazioni a cascata né dentro le funzioni
  definer: è ciò che permette di eliminare un accampamento anche chiuso.

Quando serve una migrazione: aggiorna `schema.sql`, poi metti l'intero file
negli appunti di Daniele (`Set-Clipboard`) e digli di incollarlo nell'SQL Editor
di Supabase e premere Run.

## Come si pubblica

```bash
git add -A && git commit && git push origin main
```

Il remote è già legato all'account giusto (`compagniasottomonte@github.com/...`)
perché su questa macchina convive anche l'account personale `madstoryteller11`,
che sul repository non ha i permessi. GitHub Pages ripubblica da solo in un paio
di minuti.

Punto di ripristino sicuro: etichetta `v1.0-stabile` e ramo `stabile`.

## Trappole già incontrate

- **La cache dei moduli inganna le verifiche.** Provando nel browser di sviluppo
  capita che venga servito un file vecchio: se un controllo dà un risultato
  assurdo, sospetta la cache prima del codice, e ricarica con `?v=` o `no-store`.
- **Nel browser senza schermo il salto a un istante del video non aggiorna il
  fotogramma.** Per estrarre immagini da un video bisogna riprodurlo davvero.
- **L'attributo `capture` sui campi file** apre solo la fotocamera e salta la
  galleria; senza attributo certi telefoni fanno il contrario. Servono due
  campi distinti.
- **Le card non si disegnano con immagini di altri domini** senza scaricarle
  prima come dati grezzi, altrimenti il browser rifiuta di esportare la tela.
- **`createImageBitmap` fallisce su certe foto di fotocamera** con "The source
  image could not be decoded", pur trattandosi di immagini che il browser mostra
  benissimo. In `js/ui.js` c'è il ripiego sul decodificatore classico: non
  toglierlo. Stesso file: i tipi MIME vuoti vanno accettati, certe gallerie
  Android non li dichiarano.
- **`sw.js` ha un elenco di file da salvare**: chi aggiunge un modulo in `js/`
  deve metterlo li' dentro e alzare `VERSIONE`, altrimenti quel file offline
  non c'e' e l'app si apre a meta'. Siamo a `fanta-montelago-v2`.
- **La card è verticale 9:16 e ritagliare per riempirla costa caro.**
  `disegnaFondoConFoto()` decide guardando *quanta immagine andrebbe persa*
  (soglia 18%), non le proporzioni: una foto 3:4, la più comune da telefono,
  perderebbe un quarto della larghezza. Oltre soglia si mette la foto intera al
  centro con dietro la stessa foto sfocata.

## Come si verifica

Non fidarsi del "dovrebbe funzionare". In questo progetto si è sempre
controllato eseguendo: `preview_start`, poi `javascript_tool` per montare uno
stato finto e ispezionare l'HTML prodotto. Per le immagini generate si misurano
i pixel accesi riga per riga, per accertarsi che testi e numeri non si
sovrappongano nei casi peggiori (nomi lunghi, venticinque partecipanti, premio
presente).

La configurazione di `preview_start` sta in `~/.claude/launch.json` (non nella
cartella del progetto): due voci uguali su porte diverse, perché due sessioni
aperte insieme si litigherebbero la stessa porta.

Per l'assenza di rete non serve staccare niente: si sostituisce `window.fetch`
con una funzione che rifiuta (`TypeError('Failed to fetch')`) e si ridefinisce
`navigator.onLine`. Con una `Response` 403 al posto del rifiuto si prova
l'altra strada, quella del database che dice di no. Ricordarsi di rimettere il
`fetch` vero alla fine.

## Cosa è già stato sistemato (non riproporlo)

Lo schema è stato eseguito per intero sul progetto Supabase: premio, bandiera,
titoli, riconoscimento in classifica, chiusura di stagione e proposte di regole
funzionano dal vivo. I due modelli di mail (*Magic Link* e *Confirm signup*)
sono stati adattati e contengono il codice a sei cifre. L'**SMTP** è stato
collegato: le email non passano più dal servizio incluso in Supabase.

L'app è **installabile** (service worker in `sw.js`) e la guida
all'installazione, con le schermate per Android e le istruzioni a parole per
iPhone, sta nel pannello che si apre dalla schermata di accesso.

La **coda offline** è fatta: si consulta e si segna anche senza campo, e quello
che si segna parte da solo al ritorno della linea. Vedi *Senza campo* più
sopra. Non ha richiesto migrazioni: usa `creato_il`, che c'è dalla prima
versione.

Non c'è nulla in sospeso lato Daniele: ogni migrazione è stata eseguita.

## Cosa resta aperto

- **Riprovare la coda offline su un telefono vero.** Daniele l'ha già provata
  in locale con il suo account, spegnendo il Wi-Fi: consultazione, avviso
  rosso, segnalazione accodata e sopravvissuta a un ricaricamento, tutto a
  posto. È così che è saltata fuori la faccenda dell'evento `online` descritta
  sopra, che nessuna prova col browser aveva mostrato. Resta da rifare la
  stessa prova dopo quella correzione, possibilmente da telefono e in modalità
  aereo.
- **Poster dell'accampamento con le tende**: i nomi sulle tende, la bandiera, i
  punteggi. Idea originale di Daniele, mai realizzata.
- **Guida illustrata per iPhone**: le istruzioni iOS sono a parole, servirebbe
  una registrazione da un iPhone per fare le schermate. Il procedimento per
  ricavarle da un video è collaudato: si riproduce il video e si catturano i
  fotogrammi durante la riproduzione, salvandoli con un piccolo ricevitore HTTP
  locale invece di farli passare per la chat.
