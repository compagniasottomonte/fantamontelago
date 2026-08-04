// Nome:     accampamenti.js
// Versione: 1.0
// Uso:      Schermata di scelta dell'accampamento: elenco di quelli a cui si
//           appartiene, creazione di uno nuovo e ingresso tramite codice.
// Autore:   Daniele Polucci

import * as api from '../api.js';
import * as coda from '../coda.js';
import { esc, toast, occupato, conferma } from '../ui.js';
import { stato, bus, ricordaCamp } from '../stato.js';
import { dimenticaLocale } from '../locale.js';

let elenco = [];
let caricato = false;

export async function carica() {
  elenco = await api.mieiAccampamenti(stato.utente.id);
  caricato = true;
}

export function render() {
  if (!caricato) {
    // Qui l'elenco arriva solo dal database: senza linea non c'e' ripiego che
    // tenga, ma dirlo e' meglio di un "Carico..." che non finisce mai.
    if (!navigator.onLine) {
      return `<div class="empty">
        <p>📴 <b>Nessuna linea.</b></p>
        <p>L'elenco degli accampamenti si può leggere solo online.</p>
        <p class="muted">Se ne avevi già aperto uno, torna qui appena hai campo.</p>
      </div>`;
    }
    return '<div class="empty">Carico...</div>';
  }

  const lista = elenco.map((a) => `
    <button class="card riga-camp" data-act="apri-camp" data-id="${a.id}">
      <span class="grow">
        <span class="name">${esc(a.nome)}</span>
        <div class="muted">${esc(a.edizione)}</div>
      </span>
      <span class="pill">${a.ruolo === 'arbitro' ? '⚖️ arbitro' : 'giocatore'}</span>
    </button>`).join('');

  return `
    <div class="hero small">
      <div class="logo">☘</div>
      <h1>I tuoi accampamenti</h1>
      <p class="muted">${esc(stato.utente?.email || '')}</p>
    </div>

    ${elenco.length ? lista : '<div class="empty">Non fai ancora parte di nessun accampamento.</div>'}

    <h2>Entra con un codice</h2>
    <div class="card">
      <div class="field">
        <label for="codice">Codice invito</label>
        <input id="codice" placeholder="es. K7M2QP" maxlength="6"
               style="text-transform:uppercase;letter-spacing:.2em;font-size:1.3rem;text-align:center"
               autocapitalize="characters" spellcheck="false">
      </div>
      <div class="field">
        <label for="nomeIngresso">Il tuo nome nel gruppo</label>
        <input id="nomeIngresso" placeholder="es. Daniele">
      </div>
      <button class="primary block" data-act="entra-codice">Entra</button>
    </div>

    <h2>Oppure creane uno tu</h2>
    <div class="card">
      <div class="field">
        <label for="nuovoNome">Nome dell'accampamento</label>
        <input id="nuovoNome" placeholder="es. Clan dei Druidi del Fango">
      </div>
      <div class="field">
        <label for="nuovaEdizione">Edizione</label>
        <input id="nuovaEdizione" value="Montelago Celtic Festival ${new Date().getFullYear()}">
      </div>
      <button class="primary block" data-act="crea-camp">Crea e diventa arbitro</button>
      <p class="muted mt">Chi crea l'accampamento ne diventa l'arbitro e riceve il codice da diffondere.</p>
    </div>

    <div class="card">
      <button class="block ghost" data-act="logout">Esci dall'account</button>
    </div>`;
}

const val = (id) => (document.getElementById(id)?.value || '').trim();

export const azioni = {
  'apri-camp'(id) {
    stato.campId = id;
    ricordaCamp(id);
    stato.vista = 'classifica';
    bus.ricarica();
  },

  async 'entra-codice'() {
    const codice = val('codice').toUpperCase();
    const nome = val('nomeIngresso');
    if (codice.length !== 6) return toast('Il codice ha 6 caratteri', 'error');
    if (!nome) return toast('Scrivi come ti chiami', 'error');

    occupato(true, 'Entro...');
    try {
      const id = await api.entraConCodice(codice, nome);
      stato.campId = id;
      ricordaCamp(id);
      stato.vista = 'classifica';
      await bus.ricarica();
      toast('Benvenuto nell\'accampamento');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      occupato(false);
    }
  },

  async 'crea-camp'() {
    const nome = val('nuovoNome');
    if (nome.length < 2) return toast('Dai un nome all\'accampamento', 'error');

    occupato(true, 'Creo l\'accampamento...');
    try {
      const id = await api.creaAccampamento(nome, val('nuovaEdizione') || 'Montelago');
      stato.campId = id;
      ricordaCamp(id);
      stato.vista = 'gestione';
      await bus.ricarica();
      toast('Accampamento creato');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      occupato(false);
    }
  },

  async logout() {
    // Le segnalazioni in attesa non hanno ancora un autore nel database: chi
    // le spedisce se le ritrova intestate. Uscendo vanno buttate, e chi esce
    // deve saperlo prima, non dopo.
    const inAttesa = stato.coda.length;
    if (inAttesa && !conferma(
      `Hai ${inAttesa} ${inAttesa === 1 ? 'segnalazione' : 'segnalazioni'} non ancora inviate: `
      + 'uscendo si perdono. Se hai campo, torna indietro e mandale prima.\n\nUscire lo stesso?'
    )) return;
    if (!inAttesa && !conferma('Vuoi uscire dall\'account?')) return;

    for (const voce of stato.coda) await coda.dimentica(voce.id).catch(() => {});
    await api.esci();
    ricordaCamp(null);
    dimenticaLocale();
    window.location.reload();
  },
};

/** Invalidata quando si rientra nella schermata, per non mostrare dati vecchi. */
export function invalida() {
  caricato = false;
}
