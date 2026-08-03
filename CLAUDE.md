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
js/stato.js           stato condiviso e calcoli derivati (classifica, titoli, stagione)
js/titoli.js          soprannomi automatici, riconosciuti per parole chiave
js/card.js            immagini condivisibili su tela 1080x1920
js/app.js             router, smistamento dei click, avvio
js/views/*.js         una schermata per file, ognuna esporta render() e azioni
supabase/schema.sql   tabelle, policy, trigger, funzioni: rieseguibile senza danni
promo/messaggi.md     testi pronti da condividere
```

Ogni vista espone `render()` che restituisce HTML e un oggetto `azioni`
indicizzato dagli attributi `data-act`. `app.js` intercetta i click e chiama
l'azione giusta. Le viste non parlano mai direttamente con Supabase.

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

## Come si verifica

Non fidarsi del "dovrebbe funzionare". In questo progetto si è sempre
controllato eseguendo: `preview_start`, poi `javascript_tool` per montare uno
stato finto e ispezionare l'HTML prodotto. Per le immagini generate si misurano
i pixel accesi riga per riga, per accertarsi che testi e numeri non si
sovrappongano nei casi peggiori (nomi lunghi, venticinque partecipanti, premio
presente).

## Cosa è già stato sistemato (non riproporlo)

Lo schema è stato eseguito per intero sul progetto Supabase: premio, bandiera,
titoli, riconoscimento in classifica, chiusura di stagione e proposte di regole
funzionano dal vivo. I due modelli di mail (*Magic Link* e *Confirm signup*)
sono stati adattati e contengono il codice a sei cifre. L'**SMTP** è stato
collegato: le email non passano più dal servizio incluso in Supabase.

## Cosa resta aperto

- **Poster dell'accampamento con le tende**: i nomi sulle tende, la bandiera, i
  punteggi. Idea originale di Daniele, mai realizzata.
- **Guida illustrata per iPhone**: le istruzioni iOS sono a parole, servirebbe
  una registrazione da un iPhone per fare le schermate.
