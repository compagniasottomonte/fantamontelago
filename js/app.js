// Nome:     app.js
// Versione: 1.0
// Uso:      Punto di ingresso dell'applicazione: decide quale schermata
//           mostrare, smista i click alle azioni delle viste, risolve gli URL
//           firmati delle foto e tiene aggiornati i dati.
// Autore:   Daniele Polucci

import * as api from './api.js';
import * as coda from './coda.js';
import { leggiConfig } from './config.js';
import { esc, toast, occupato, dataOra, conferma } from './ui.js';
import { stato, bus, campRicordato, ricordaCamp, totaleInAttesa, codaQui,
         codaInPartenza } from './stato.js';
import { salvaDati, datiSalvati, ricordaUtente, utenteRicordato } from './locale.js';

import * as vAuth from './views/auth.js';
import * as vAccampamenti from './views/accampamenti.js';
import * as vClassifica from './views/classifica.js';
import * as vSegna from './views/segna.js';
import * as vDiario from './views/diario.js';
import * as vProposte from './views/proposte.js';
import * as vGestione from './views/gestione.js';
import { piePagina } from './views/info.js';

const SCHEDE = [
  { id: 'classifica', icona: '🏆', titolo: 'Classifica', vista: vClassifica },
  { id: 'segna',      icona: '➕', titolo: 'Segna',      vista: vSegna },
  { id: 'diario',     icona: '📸', titolo: 'Diario',     vista: vDiario },
  { id: 'proposte',   icona: '⏳', titolo: 'Proposte',   vista: vProposte },
  { id: 'gestione',   icona: '⚙️', titolo: 'Gestione',   vista: vGestione },
];

const app = () => document.getElementById('app');

// ------------------------------------------------------------------
// Disegno
// ------------------------------------------------------------------

function disegna() {
  const configurato = !!leggiConfig();

  if (!configurato) return schermataSemplice(vAuth.renderConfig());
  if (!stato.sessione) return schermataSemplice(vAuth.renderLogin());
  if (!stato.campId || !stato.dati) return schermataSemplice(vAccampamenti.render());

  const scheda = SCHEDE.find((s) => s.id === stato.vista) || SCHEDE[0];
  document.body.classList.add('con-nav');
  intestazione(stato.dati.accampamento.nome, stato.dati.accampamento.edizione);
  // Il richiamo al fatto che non sia l'app ufficiale chiude ogni schermata,
  // non solo quella dei crediti.
  app().innerHTML = avvisoSenzaRete() + scheda.vista.render() + piePagina();
  navigazione();
  risolviFoto();
}

/**
 * Dice a chiare lettere che quello che si sta guardando e' vecchio.
 *
 * Senza questo avviso la copia salvata sarebbe indistinguibile dalla
 * classifica vera, e qualcuno festeggerebbe un sorpasso che non c'e' stato.
 */
function avvisoSenzaRete() {
  if (!stato.senzaRete) return '';
  const inPartenza = codaInPartenza().length;
  return `
    <div class="banner senza-rete">
      📴 <b>Nessuna linea.</b> Stai guardando la copia salvata${
        stato.datiDel ? ` del ${esc(dataOra(stato.datiDel))}` : ''}.
      ${inPartenza
        ? `${inPartenza === 1
            ? 'La tua segnalazione partirà'
            : `Le tue ${inPartenza} segnalazioni partiranno`} appena torna il campo.`
        : 'Puoi segnare lo stesso: quello che scrivi parte da solo appena torna il campo.'}
    </div>`;
}

function schermataSemplice(html) {
  document.body.classList.remove('con-nav');
  document.getElementById('nav').innerHTML = '';
  intestazione(null);
  app().innerHTML = html;
}

function intestazione(titolo, sottotitolo) {
  const el = document.getElementById('intestazione');
  if (!titolo) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `
    <img class="marchio" src="assets/icona-app-192.png" alt="" width="192" height="192">
    <div class="grow">
      <h1>${esc(titolo)}</h1>
      <div class="sub">${esc(sottotitolo || '')}</div>
    </div>
    <button class="icon" data-act="aggiorna" title="Aggiorna">⟳</button>`;
}

function navigazione() {
  const attesa = totaleInAttesa();
  const daSpedire = codaQui().length;
  const arbitro = stato.dati?.arbitro;

  document.getElementById('nav').innerHTML = SCHEDE.map((s) => {
    // Per chi non arbitra quella scheda non contiene comandi da usare, ma le
    // informazioni sull'accampamento e i contatti della Compagnia: chiamarla
    // "Gestione" la farebbe scansare da chi invece dovrebbe aprirla.
    const gestioneAltrui = s.id === 'gestione' && !arbitro;
    const titolo = gestioneAltrui ? 'Info' : s.titolo;
    const icona = gestioneAltrui ? 'ℹ️' : s.icona;

    // Quante cose la scheda sta trattenendo: le proposte da giudicare,
    // oppure gli eventi che aspettano il campo per partire.
    const conteggio = (s.id === 'proposte' && attesa)
      || (s.id === 'segna' && daSpedire) || 0;

    return `
      <button data-scheda="${s.id}" aria-current="${s.id === stato.vista}">
        <span class="ic">${icona}${conteggio ? `<i class="badge">${conteggio}</i>` : ''}</span>
        ${titolo}
      </button>`;
  }).join('');
}

/**
 * Le foto stanno in un bucket privato: al posto di src il markup porta un
 * data-foto col path, e qui si chiedono gli URL firmati una volta sola.
 */
async function risolviFoto() {
  const immagini = [...document.querySelectorAll('img[data-foto]')];
  await Promise.all(immagini.map(async (img) => {
    const url = await api.urlFoto(img.dataset.foto);
    if (url) img.src = url;
    else img.replaceWith(Object.assign(document.createElement('div'), {
      className: 'muted small', textContent: 'Foto non disponibile',
    }));
  }));
}

// ------------------------------------------------------------------
// Dati
// ------------------------------------------------------------------

async function ricarica() {
  if (!stato.sessione) return disegna();

  if (!stato.campId) {
    stato.dati = null;
    vAccampamenti.invalida();
    try {
      await vAccampamenti.carica();
    } catch (e) {
      toast(e.message, 'error');
    }
    return disegna();
  }

  try {
    stato.dati = await api.caricaTutto(stato.campId, stato.utente.id);
    stato.senzaRete = false;
    // Segnata anche quando la linea c'e': se cade un istante dopo, l'avviso
    // sa gia' dire a quando risale quello che si sta guardando.
    stato.datiDel = new Date().toISOString();
    salvaDati(stato.campId, stato.dati);
  } catch (e) {
    // Manca il campo: si riapre l'ultima copia invece di mandare via chi
    // magari deve solo segnare un evento. E' l'unico caso in cui l'app mostra
    // dati che potrebbero non essere piu' veri, e infatti lo dichiara.
    const salvato = api.senzaRete(e) ? datiSalvati(stato.campId) : null;
    if (salvato) {
      stato.dati = salvato.dati;
      stato.senzaRete = true;
      stato.datiDel = salvato.quando;
    } else if (api.senzaRete(e)) {
      stato.dati = null;
      toast('Nessuna linea e nessuna copia salvata di questo accampamento', 'error');
    } else {
      // Tipicamente: l'accampamento e' stato cancellato o siamo stati rimossi.
      toast('Accampamento non accessibile', 'error');
      stato.campId = null;
      stato.dati = null;
      ricordaCamp(null);
      vAccampamenti.invalida();
      await vAccampamenti.carica().catch(() => {});
    }
  }
  disegna();
}

/**
 * Rilegge dal telefono le segnalazioni in attesa.
 * Le viste disegnano di colpo e non possono aspettare IndexedDB: la copia in
 * memoria e' quella che leggono.
 */
async function ricaricaCoda() {
  try {
    stato.coda = await coda.voci();
  } catch {
    // Archivio locale non disponibile (navigazione privata, spazio finito):
    // l'app resta usabile online, semplicemente senza coda.
    stato.coda = [];
  }
  sorvegliaLaCoda();
}

// Si riprova presto, poi sempre piu' di rado: chi ha appena ritrovato il campo
// vuole vedere partire la sua segnalazione, chi e' in mezzo a un prato da tre
// ore non vuole la batteria prosciugata da un tentativo al secondo.
const ATTESE = [5000, 15000, 30000, 60000];
let timerCoda = null;
let tentativo = 0;

/**
 * Insiste finche' la coda non si svuota.
 *
 * L'evento "online" scatta quando la scheda di rete si riaccende, che e'
 * parecchio prima che la connessione serva davvero a qualcosa: il primo
 * tentativo trova ancora il vuoto. Fermarsi li' vorrebbe dire lasciare la
 * segnalazione ferma fino a quando qualcuno non preme il pulsante a mano, ed
 * e' proprio quello che non deve succedere.
 */
function sorvegliaLaCoda() {
  clearTimeout(timerCoda);
  // Le respinte dal database non si sorvegliano: riprovarle non le farebbe
  // passare, aspettano una decisione di chi le ha scritte.
  if (!stato.coda.some((v) => !v.bloccata)) { tentativo = 0; return; }

  timerCoda = setTimeout(async () => {
    if (navigator.onLine) {
      const prima = stato.coda.length;
      const inviati = await spediciCoda(true);
      // Ogni passo avanti fa ricominciare da capo l'attesa breve: se la linea
      // regge, il resto della coda parte di seguito senza aspettare un minuto.
      tentativo = inviati ? 0 : Math.min(tentativo + 1, ATTESE.length - 1);
      if (inviati) await ricarica();
      else if (prima !== stato.coda.length) disegna();
    }
    sorvegliaLaCoda();
  }, ATTESE[tentativo]);
}

/**
 * Prova a spedire la coda e racconta com'e' andata.
 * "spontaneo" e' l'invio partito da solo al ritorno della linea: se non c'e'
 * niente da dire, meglio tacere che far comparire un avviso dal nulla.
 */
async function spediciCoda(spontaneo = false) {
  if (!stato.coda.length) return 0;

  const { inviati, falliti } = await coda.inviaCoda();
  await ricaricaCoda();

  if (inviati) toast(inviati === 1 ? 'Segnalazione inviata' : `${inviati} segnalazioni inviate`);
  else if (falliti) toast('Qualche segnalazione è stata respinta: guarda in Segna', 'error');
  else if (!spontaneo) toast('Ancora senza linea: restano in coda', 'error');

  return inviati;
}

// ------------------------------------------------------------------
// Smistamento dei click
// ------------------------------------------------------------------

const AZIONI_GLOBALI = {
  async aggiorna() {
    occupato(true, 'Aggiorno...');
    try {
      await spediciCoda(true);
      await ricarica();
    } finally { occupato(false); }
  },

  // Le chiavi di IndexedDB sono numeri, gli attributi del markup stringhe.
  async 'invia-coda'() {
    occupato(true, 'Spedisco quello che aspetta...');
    try {
      await spediciCoda();
      await ricarica();
    } finally { occupato(false); }
  },

  async 'riprova-coda'(id) {
    await coda.riprova(Number(id));
    await ricaricaCoda();
    await AZIONI_GLOBALI['invia-coda']();
  },

  async 'scarta-coda'(id) {
    if (!conferma('Buttare via questa segnalazione? Non è mai arrivata al database.')) return;
    await coda.dimentica(Number(id));
    await ricaricaCoda();
    disegna();
    toast('Segnalazione scartata');
  },
};

function azioniCorrenti() {
  const scheda = SCHEDE.find((s) => s.id === stato.vista);
  return {
    ...AZIONI_GLOBALI,
    ...vAuth.azioni,
    ...vAccampamenti.azioni,
    ...(stato.dati && scheda?.vista.azioni ? scheda.vista.azioni : {}),
  };
}

document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const azione = azioniCorrenti()[el.dataset.act];
  if (!azione) return;
  ev.preventDefault();
  try {
    await azione(el.dataset.id, el);
  } catch (e) {
    toast(e.message || 'Qualcosa è andato storto', 'error');
    occupato(false);
  }
});

document.getElementById('nav').addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-scheda]');
  if (!b) return;
  stato.vista = b.dataset.scheda;
  disegna();
  window.scrollTo(0, 0);
});

// ------------------------------------------------------------------
// Avvio
// ------------------------------------------------------------------

bus.disegna = disegna;
bus.ricarica = ricarica;
bus.vaiA = (vista) => { stato.vista = vista; disegna(); };
bus.ricaricaCoda = ricaricaCoda;

vSegna.collegaInputFoto();
vGestione.collegaCampi();

async function avvia() {
  if (!leggiConfig()) return disegna();

  await ricaricaCoda();

  api.alCambioSessione(async (sessione) => {
    const cambiato = sessione?.user?.id !== stato.utente?.id;
    // Senza linea Supabase annuncia ogni tanto una sessione nulla perche' non
    // riesce a rinnovare il permesso: dargli retta butterebbe fuori dall'app
    // chi sta segnando, e senza motivo, visto che il permesso si riprende da
    // solo appena torna il campo.
    if (!sessione && !navigator.onLine) return;
    stato.sessione = sessione;
    stato.utente = sessione?.user || null;
    if (sessione?.user) ricordaUtente(sessione.user);
    if (cambiato) {
      stato.campId = sessione ? campRicordato() : null;
      vAccampamenti.invalida();
      await ricarica();
    }
  });

  const sessione = await api.sessione();
  stato.sessione = sessione;
  stato.utente = sessione?.user || null;

  if (sessione?.user) {
    ricordaUtente(sessione.user);
  } else if (!navigator.onLine && utenteRicordato()) {
    // Il permesso di Supabase dura un'ora e senza rete non si rinnova: dopo
    // un pomeriggio in mezzo ai prati l'app tornerebbe alla schermata di
    // accesso, che senza linea non porta da nessuna parte. Per stare offline
    // basta sapere chi siamo; il permesso vero si riprende dopo.
    stato.sessione = { offline: true };
    stato.utente = utenteRicordato();
  }

  stato.campId = stato.sessione ? campRicordato() : null;
  await ricarica();
}

/**
 * Il ritorno della linea e' il momento buono: si spedisce quello che aspetta
 * e si riprendono i dati veri. Se la sessione era quella di ripiego, la si
 * rifa' per bene, perche' adesso Supabase puo' rinnovare il permesso.
 */
window.addEventListener('online', async () => {
  if (!leggiConfig()) return;

  if (stato.sessione?.offline) {
    const vera = await api.sessione();
    if (!vera) return;
    stato.sessione = vera;
    stato.utente = vera.user;
  }

  await spediciCoda(true);
  await ricarica();
});

// Il browser se ne accorge prima che una chiamata fallisca: l'avviso compare
// subito, invece che al primo tentativo andato a vuoto.
window.addEventListener('offline', () => {
  if (stato.dati) { stato.senzaRete = true; disegna(); }
});

// Al ritorno sull'app (schermo riacceso, cambio di scheda) i dati possono
// essere vecchi di ore: si ricaricano, ma solo se c'e' un accampamento aperto.
document.addEventListener('visibilitychange', async () => {
  if (document.hidden || !stato.campId || !stato.sessione) return;
  // Riaprire l'app e' un buon momento anche per la coda: spesso si torna a
  // guardarla proprio perche' si e' visto ricomparire la tacca del campo.
  await spediciCoda(true);
  await ricarica();
});

/**
 * Registra il service worker, che tiene una copia dell'app sul telefono e la
 * rende installabile. Quando ne arriva una versione nuova la pagina si
 * ricarica una volta sola, cosi' nessuno resta con file misti.
 */
function attivaCopiaLocale() {
  if (!('serviceWorker' in navigator)) return;

  let giaRicaricata = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (giaRicaricata) return;
    giaRicaricata = true;
    window.location.reload();
  });

  navigator.serviceWorker.register('sw.js')
    .catch((e) => console.warn('Copia locale non attivata:', e.message));
}

attivaCopiaLocale();

avvia().catch((e) => {
  app().innerHTML = `<div class="card"><h2>Avvio non riuscito</h2>
    <p class="muted">${esc(e.message)}</p></div>`;
});
