// Nome:     app.js
// Versione: 1.0
// Uso:      Punto di ingresso dell'applicazione: decide quale schermata
//           mostrare, smista i click alle azioni delle viste, risolve gli URL
//           firmati delle foto e tiene aggiornati i dati.
// Autore:   Daniele Polucci

import * as api from './api.js';
import { leggiConfig } from './config.js';
import { esc, toast, occupato } from './ui.js';
import { stato, bus, campRicordato, ricordaCamp, proposteInAttesa } from './stato.js';

import * as vAuth from './views/auth.js';
import * as vAccampamenti from './views/accampamenti.js';
import * as vClassifica from './views/classifica.js';
import * as vSegna from './views/segna.js';
import * as vDiario from './views/diario.js';
import * as vProposte from './views/proposte.js';
import * as vGestione from './views/gestione.js';

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
  app().innerHTML = scheda.vista.render();
  navigazione();
  risolviFoto();
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
  const attesa = proposteInAttesa().length;
  const arbitro = stato.dati?.arbitro;

  document.getElementById('nav').innerHTML = SCHEDE.map((s) => {
    // Per chi non arbitra quella scheda non contiene comandi da usare, ma le
    // informazioni sull'accampamento e i contatti della Compagnia: chiamarla
    // "Gestione" la farebbe scansare da chi invece dovrebbe aprirla.
    const gestioneAltrui = s.id === 'gestione' && !arbitro;
    const titolo = gestioneAltrui ? 'Info' : s.titolo;
    const icona = gestioneAltrui ? 'ℹ️' : s.icona;

    return `
      <button data-scheda="${s.id}" aria-current="${s.id === stato.vista}">
        <span class="ic">${icona}${s.id === 'proposte' && attesa ? `<i class="badge">${attesa}</i>` : ''}</span>
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
  } catch (e) {
    // Tipicamente: l'accampamento e' stato cancellato o siamo stati rimossi.
    toast('Accampamento non accessibile', 'error');
    stato.campId = null;
    stato.dati = null;
    ricordaCamp(null);
    vAccampamenti.invalida();
    await vAccampamenti.carica().catch(() => {});
  }
  disegna();
}

// ------------------------------------------------------------------
// Smistamento dei click
// ------------------------------------------------------------------

const AZIONI_GLOBALI = {
  async aggiorna() {
    occupato(true, 'Aggiorno...');
    try { await ricarica(); } finally { occupato(false); }
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

vSegna.collegaInputFoto();
vGestione.collegaCampi();

async function avvia() {
  if (!leggiConfig()) return disegna();

  api.alCambioSessione(async (sessione) => {
    const cambiato = sessione?.user?.id !== stato.utente?.id;
    stato.sessione = sessione;
    stato.utente = sessione?.user || null;
    if (cambiato) {
      stato.campId = sessione ? campRicordato() : null;
      vAccampamenti.invalida();
      await ricarica();
    }
  });

  const sessione = await api.sessione();
  stato.sessione = sessione;
  stato.utente = sessione?.user || null;
  stato.campId = sessione ? campRicordato() : null;
  await ricarica();
}

// Al ritorno sull'app (schermo riacceso, cambio di scheda) i dati possono
// essere vecchi di ore: si ricaricano, ma solo se c'e' un accampamento aperto.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && stato.campId && stato.sessione) ricarica();
});

avvia().catch((e) => {
  app().innerHTML = `<div class="card"><h2>Avvio non riuscito</h2>
    <p class="muted">${esc(e.message)}</p></div>`;
});
