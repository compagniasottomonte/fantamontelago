// Nome:     segna.js
// Versione: 1.0
// Uso:      Modulo per registrare un bonus o un malus: scelta del personaggio
//           e della regola, nota, giornata, foto-prova e link a un video.
//           L'arbitro conferma subito, gli altri inviano una proposta.
// Autore:   Daniele Polucci

import * as api from '../api.js';
import { esc, punti, toast, occupato, urlSicuro } from '../ui.js';
import { stato, bus } from '../stato.js';

let fotoScelta = null;

export function render() {
  const { personaggi, regole, arbitro } = stato.dati;

  if (!personaggi.length || !regole.length) {
    return `<div class="empty">
      <p>Per segnare servono almeno un personaggio e una regola.</p>
      ${arbitro ? '<p>Vai su <b>Gestione</b> per aggiungerli.</p>'
                : '<p>Aspetta che l\'arbitro finisca di preparare l\'accampamento.</p>'}
    </div>`;
  }

  const attive = regole.filter((r) => r.attiva);
  const opzioniRegole = (lista) => lista
    .map((r) => `<option value="${r.id}">${esc(r.nome)} (${r.punti > 0 ? '+' : ''}${r.punti})</option>`)
    .join('');

  const oggi = new Date().toISOString().slice(0, 10);

  return `
    <div class="banner ${arbitro ? 'ok' : ''}">
      ${arbitro
        ? '⚖️ Sei l\'arbitro: quello che segni vale subito.'
        : '⏳ La tua segnalazione andrà in attesa di approvazione dall\'arbitro.'}
    </div>

    <div class="card">
      <div class="field">
        <label for="selP">Chi</label>
        <select id="selP">
          <option value="">— scegli il personaggio —</option>
          ${personaggi.map((p) => `<option value="${p.id}">${esc(p.nome)}</option>`).join('')}
        </select>
      </div>

      <div class="field">
        <label for="selR">Cosa ha combinato</label>
        <select id="selR">
          <option value="">— scegli bonus o malus —</option>
          <optgroup label="Bonus">${opzioniRegole(attive.filter((r) => r.punti >= 0))}</optgroup>
          <optgroup label="Malus">${opzioniRegole(attive.filter((r) => r.punti < 0))}</optgroup>
        </select>
      </div>

      <div class="field">
        <label for="giornata">Giornata</label>
        <input id="giornata" type="date" value="${oggi}">
      </div>

      <div class="field">
        <label for="nota">Nota</label>
        <input id="nota" placeholder="es. alle 4 di notte, davanti al palco Taberna">
      </div>

      <div class="field">
        <label>Foto-prova</label>
        <button class="block" data-act="scegli-foto">
          ${fotoScelta ? '📷 Cambia foto' : '📷 Scatta o scegli una foto'}
        </button>
        <input type="file" id="foto" accept="image/*" capture="environment" hidden>
        <div id="anteprima">${fotoScelta ? `<img class="preview" src="${URL.createObjectURL(fotoScelta)}" alt="anteprima">` : ''}</div>
      </div>

      <div class="field">
        <label for="video">Link a un video (facoltativo)</label>
        <input id="video" type="url" inputmode="url" placeholder="https://youtu.be/..."
               autocapitalize="off" spellcheck="false">
        <p class="muted mt">I video non si caricano qui: mettili su YouTube, Google Foto o Drive e incolla il link.</p>
      </div>

      <button class="primary block big" data-act="invia-evento">
        ${arbitro ? 'Assegna i punti' : 'Invia la segnalazione'}
      </button>
    </div>

    ${riepilogoMie()}`;
}

/** Per un giocatore normale e' utile vedere che fine hanno fatto le sue proposte. */
function riepilogoMie() {
  const mie = (stato.dati.eventi || [])
    .filter((e) => e.proposto_da === stato.utente.id)
    .slice(0, 6);
  if (!mie.length) return '';

  const etichetta = { proposto: '⏳ in attesa', approvato: '✅ approvato', rifiutato: '❌ rifiutato' };
  return `
    <h2>Le tue ultime segnalazioni</h2>
    <div class="card">
      ${mie.map((e) => `
        <div class="item">
          <span class="grow">
            <span class="name">${esc(e.regola_nome)}</span>
            <div class="muted">${etichetta[e.stato]}</div>
          </span>
          ${punti(e.punti)}
        </div>`).join('')}
    </div>`;
}

const val = (id) => (document.getElementById(id)?.value || '').trim();

export const azioni = {
  'scegli-foto'() {
    document.getElementById('foto').click();
  },

  async 'invia-evento'() {
    const personaggioId = val('selP');
    const regolaId = val('selR');
    if (!personaggioId) return toast('Scegli il personaggio', 'error');
    if (!regolaId) return toast('Scegli il bonus o il malus', 'error');

    const regola = stato.dati.regole.find((r) => r.id === regolaId);
    const videoGrezzo = val('video');
    const videoUrl = urlSicuro(videoGrezzo);
    if (videoGrezzo && !videoUrl) return toast('Il link del video non è valido', 'error');

    occupato(true, fotoScelta ? 'Carico la foto...' : 'Registro...');
    try {
      await api.creaEvento({
        accampamentoId: stato.campId,
        personaggioId,
        regola,
        nota: val('nota'),
        giornata: val('giornata') || new Date().toISOString().slice(0, 10),
        videoUrl,
        foto: fotoScelta,
      });
      fotoScelta = null;
      await bus.ricarica();
      toast(stato.dati.arbitro ? 'Punti assegnati' : 'Segnalazione inviata');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      occupato(false);
    }
  },
};

/** Registrato da app.js: il change su input file non passa dal bus delle azioni. */
export function collegaInputFoto() {
  document.addEventListener('change', (ev) => {
    if (ev.target.id !== 'foto' || !ev.target.files?.length) return;
    const file = ev.target.files[0];
    if (file.size > 25 * 1024 * 1024) {
      return toast('Foto troppo grande (oltre 25 MB)', 'error');
    }
    fotoScelta = file;
    const box = document.getElementById('anteprima');
    if (box) box.innerHTML = `<img class="preview" src="${URL.createObjectURL(file)}" alt="anteprima">`;
  });
}
