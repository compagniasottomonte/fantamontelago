# Fanta Montelago

Il fantagioco del Montelago Celtic Festival, per il tuo accampamento.

Creata da **MadStoryteller11** per **La Compagnia di Sotto Monte** —
[Instagram della Compagnia](https://www.instagram.com/compagnia_di_sotto_monte/) ·
[Instagram dell'autore](https://www.instagram.com/madstoryteller11/)

App gratuita, nata per passione e per divertimento nel tempo libero. Può avere
malfunzionamenti. Per segnalazioni o interesse: <compagniasottomonte@gmail.com>

> **Progetto amatoriale, fatto dai fan per i fan.** Non è l'app ufficiale del
> Montelago Celtic Festival e non ha alcun legame con chi lo organizza, che non
> c'entra niente con questo gioco e non ne è in alcun modo responsabile. Il nome
> del festival appartiene ai suoi legittimi proprietari.

Ogni clan crea il proprio accampamento privato, ci carica dentro le persone che
lo compongono e per tutto il festival assegna bonus e malus con tanto di
foto-prova. La classifica si aggiorna in tempo reale e il diario racconta il
festival giornata per giornata.

## Come si gioca

- **L'arbitro** crea l'accampamento, inserisce i partecipanti e definisce il
  catalogo di bonus e malus. Quello che segna lui vale immediatamente.
- **I giocatori** entrano con un codice invito di 6 caratteri e possono
  *segnalare* eventi allegando una foto o il link a un video. Le segnalazioni
  finiscono in una coda e valgono punti solo quando l'arbitro le approva.
- Ogni accampamento vede **soltanto i propri dati**: la separazione è imposta
  dal database, non dall'interfaccia.
- L'arbitro può indicare un **premio in palio** (facoltativo), che compare in
  cima alla classifica per tutti.

Due regole promozionali — la pubblicità alla Compagnia e quella al Fanta
Montelago — sono **protette**: nessun arbitro può cancellarle, disattivarle o
cambiarne il punteggio. Il divieto è nelle policy del database, non solo
nell'interfaccia. L'elenco sta in `regola_protetta()`.

Ogni nuovo accampamento nasce già col **regolamento ufficiale della Compagnia**
(50 fra bonus e malus, definiti in `regole_base()` dentro
[`supabase/schema.sql`](supabase/schema.sql)). L'arbitro può modificarne i
punteggi, disattivarne, aggiungerne di propri, e in qualsiasi momento rimettere
tutto com'era col pulsante *Ripristina il regolamento ufficiale*. I punteggi
ammessi vanno da **−100 a +100**: per uscire da quell'intervallo va allargato
il vincolo `check (punti between -100 and 100)` nello schema.

## Architettura

Nessun passaggio di build: sono file statici con moduli ES nativi. Questo
significa che il deploy è un `git push` e che non serve Node installato.

| Pezzo | Tecnologia | Costo |
|---|---|---|
| Sito | HTML + CSS + JavaScript su GitHub Pages | gratis |
| Database, login, foto | Supabase (Postgres, Auth, Storage) | gratis fino a 500 MB / 1 GB |

La sicurezza sta tutta nelle *Row Level Security policies* di
[`supabase/schema.sql`](supabase/schema.sql): anche chi manomettesse il
JavaScript nel browser non riuscirebbe a leggere un accampamento di cui non è
membro, né ad assegnarsi punti. In particolare punteggio e descrizione di un
evento vengono riletti dal database a partire dalla regola citata, quindi non
sono falsificabili dal client.

## Installazione

### 1. Crea il progetto Supabase

Vai su [supabase.com](https://supabase.com), crea un progetto gratuito e
scegli la region **Europe (Frankfurt)** o **Europe (Ireland)**: sono le più
vicine e le più veloci dall'Italia.

### 2. Crea le tabelle

Nel pannello Supabase apri **SQL Editor › New query**, incolla tutto il
contenuto di `supabase/schema.sql` ed esegui. Crea tabelle, policy di
sicurezza, funzioni e il bucket per le foto. È scritto per poter essere
rieseguito senza danni.

### 3. Configura gli indirizzi di ritorno del login

In **Authentication › URL Configuration**:

- **Site URL**: `https://TUO-UTENTE.github.io/fanta-montelago/`
- **Redirect URLs**: aggiungi sia l'indirizzo qui sopra sia
  `http://localhost:5173` per le prove in locale.

Se salti questo passaggio i link di accesso via email non funzionano.

> **Attenzione al limite delle email.** Il servizio SMTP incluso in Supabase
> serve solo per le prove e manda pochissime email all'ora: con un gruppo di
> venti persone che entrano tutte insieme, la maggior parte non riceverà
> niente. Prima del festival collega un SMTP tuo in **Authentication › Emails ›
> SMTP Settings** — [Resend](https://resend.com) o
> [Brevo](https://brevo.com) hanno un piano gratuito abbondante. Meglio ancora,
> fai entrare tutti qualche giorno prima: una volta dentro la sessione resta
> valida e non servono altre email.

### 4. Collega l'app

Da **Settings › API** copia il **Project URL** e la chiave **anon public**.
Hai due strade:

- **Al volo**: apri l'app e incollali nella schermata di prima accensione.
  Restano solo sul tuo dispositivo, ma ogni persona dovrà rifarlo.
- **Nel codice** (consigliato per l'uso vero): scrivili in `js/config.js`
  dentro `DA_FILE`. La chiave *anon* è progettata per stare nel codice del
  browser ed è pubblica per definizione: a proteggere i dati sono le policy,
  non la sua segretezza.

### 5. Pubblica su GitHub Pages

```bash
git init
git add .
git commit -m "Fanta Montelago"
git branch -M main
git remote add origin https://github.com/TUO-UTENTE/fanta-montelago.git
git push -u origin main
```

Poi su GitHub: **Settings › Pages › Source: Deploy from a branch**, ramo
`main`, cartella `/ (root)`. Dopo un minuto l'app è online e ogni `git push`
successivo la aggiorna.

## Quando pubblichi un aggiornamento

I browser tengono in memoria i file dell'app anche dopo che sono cambiati sul
server. Nei minuti successivi a un `git push` può quindi capitare che qualcuno
si ritrovi un misto di file vecchi e nuovi, e che l'app dia errore invece di
aprirsi. GitHub Pages li fa scadere da solo nel giro di una decina di minuti,
quindi di norma si risolve aspettando; a chi ha fretta basta ricaricare con
**Ctrl+Shift+R** (sul telefono, chiudere e riaprire la scheda).

Per questo conviene pubblicare le modifiche quando nessuno sta giocando,
e non nel bel mezzo del sabato sera del festival.

## Sviluppo in locale

I moduli ES non funzionano aprendo il file col doppio click: serve un server.

```bash
python -m http.server 5173 --directory .
```

Poi apri `http://localhost:5173`.

## Struttura

```
index.html               guscio della pagina
assets/style.css         tema scuro, mobile-first
js/config.js             credenziali Supabase
js/api.js                tutte le chiamate al database
js/stato.js              stato condiviso e calcolo della classifica
js/app.js                router, smistamento dei click, avvio
js/views/                una schermata per file
supabase/schema.sql      tabelle, policy di sicurezza, storage
prototipo/index.html     prima bozza offline, senza account (usa e getta)
```

## Limiti del piano gratuito

Le foto vengono ridimensionate a 1600 px e ricompresse nel browser prima di
partire, quindi pesano circa 250 KB l'una: nel gigabyte di storage ce ne stanno
qualche migliaio, più che sufficienti per un festival. I video invece non si
caricano — si incolla il link a YouTube, Google Foto o Drive — perché un solo
minuto di video da telefono si mangerebbe un decimo dello spazio disponibile.

## Idee non ancora implementate

Il campo `modalita` sulla tabella `accampamenti` esiste già ma per ora vale
sempre `classica`. È il punto di aggancio per le altre varianti di gioco:
asta con budget, pronostici sul cartellone, sfide fra accampamenti.
