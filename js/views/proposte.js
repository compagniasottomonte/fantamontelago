// Nome:     proposte.js
// Versione: 1.0
// Uso:      Coda delle segnalazioni in attesa: l'arbitro le approva o le
//           rifiuta, i giocatori vedono lo stato delle proprie e possono
//           ritirarle finche' non sono state giudicate.
// Autore:   Daniele Polucci

import * as api from '../api.js';
import { esc, punti, dataBreve, toast, occupato, conferma, anteprimaVideo } from '../ui.js';
import { stato, bus, nomePersonaggio, nomeMembro, proposteInAttesa } from '../stato.js';

export function render() {
  const attesa = proposteInAttesa();
  const arbitro = stato.dati.arbitro;

  if (!attesa.length) {
    return `<div class="empty">
      <p>Nessuna segnalazione in attesa.</p>
      <p class="muted">${arbitro
        ? 'Quando qualcuno segnala qualcosa la trovi qui.'
        : 'Le tue proposte compaiono qui finché l\'arbitro non decide.'}</p>
    </div>`;
  }

  return `
    <div class="banner">${attesa.length} segnalazion${attesa.length === 1 ? 'e' : 'i'} in attesa</div>
    ${attesa.map((e) => scheda(e, arbitro)).join('')}`;
}

function scheda(e, arbitro) {
  const mia = e.proposto_da === stato.utente.id;
  const video = anteprimaVideo(e.video_url);

  return `
    <div class="card">
      <div class="between">
        <span class="grow">
          <span class="name">${esc(nomePersonaggio(e.personaggio_id))}</span>
          <div class="muted">${esc(e.regola_nome)}</div>
        </span>
        ${punti(e.punti)}
      </div>

      ${e.nota ? `<p class="nota">«${esc(e.nota)}»</p>` : ''}

      <div class="muted small">
        Segnalato da ${esc(nomeMembro(e.proposto_da))} · ${dataBreve(e.giornata)}
      </div>

      ${e.foto_path ? `<img class="prova" data-foto="${esc(e.foto_path)}" alt="foto-prova" loading="lazy">` : ''}

      ${e.video_url ? (video
        ? `<div class="video-box"><iframe loading="lazy" allowfullscreen
             src="${video.tipo === 'youtube'
               ? `https://www.youtube-nocookie.com/embed/${video.id}`
               : `https://player.vimeo.com/video/${video.id}`}"></iframe></div>`
        : `<a class="link-video" href="${esc(e.video_url)}" target="_blank" rel="noopener noreferrer">🎬 Apri il video</a>`
      ) : ''}

      <div class="sep"></div>
      ${arbitro ? `
        <div class="row">
          <button class="primary grow" data-act="approva" data-id="${e.id}">✅ Approva</button>
          <button class="grow" data-act="rifiuta" data-id="${e.id}">❌ Rifiuta</button>
        </div>`
      : mia ? `
        <button class="block danger" data-act="ritira" data-id="${e.id}">Ritira la segnalazione</button>`
      : '<div class="muted">In attesa del giudizio dell\'arbitro.</div>'}
    </div>`;
}

async function decidi(id, nuovoStato, messaggio) {
  occupato(true, 'Aggiorno...');
  try {
    await api.decidiEvento(id, nuovoStato);
    await bus.ricarica();
    toast(messaggio);
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    occupato(false);
  }
}

export const azioni = {
  approva: (id) => decidi(id, 'approvato', 'Punti assegnati'),
  rifiuta: (id) => decidi(id, 'rifiutato', 'Segnalazione rifiutata'),

  async ritira(id) {
    if (!conferma('Vuoi ritirare questa segnalazione?')) return;
    const evento = stato.dati.eventi.find((x) => x.id === id);
    occupato(true, 'Ritiro...');
    try {
      await api.eliminaEvento(evento);
      await bus.ricarica();
      toast('Segnalazione ritirata');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      occupato(false);
    }
  },
};
