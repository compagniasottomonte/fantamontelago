// Nome:     diario.js
// Versione: 1.0
// Uso:      Cronaca del festival giornata per giornata: tutti gli eventi
//           approvati con le loro foto-prova e i video collegati.
// Autore:   Daniele Polucci

import * as api from '../api.js';
import { esc, punti, toast, occupato, conferma, anteprimaVideo } from '../ui.js';
import { stato, bus, eventiValidi, nomePersonaggio, nomeMembro } from '../stato.js';

export function render() {
  const eventi = eventiValidi();
  if (!eventi.length) {
    return '<div class="empty"><p>Il diario è ancora bianco.</p><p class="muted">Qui finiscono tutti gli eventi approvati, con le foto.</p></div>';
  }

  // Raggruppati per giornata, dalla piu' recente: e' cosi' che si racconta
  // un festival, non come un elenco piatto.
  const perGiorno = new Map();
  for (const e of eventi) {
    if (!perGiorno.has(e.giornata)) perGiorno.set(e.giornata, []);
    perGiorno.get(e.giornata).push(e);
  }

  const giorni = [...perGiorno.keys()].sort().reverse();

  return giorni.map((giorno) => {
    const lista = perGiorno.get(giorno);
    const totale = lista.reduce((s, e) => s + e.punti, 0);
    const titolo = new Date(giorno).toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long',
    });

    return `
      <h2 class="giorno">${esc(titolo)} <span class="pill">${lista.length} eventi · ${totale > 0 ? '+' : ''}${totale}</span></h2>
      ${lista.map(scheda).join('')}`;
  }).join('');
}

function scheda(e) {
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
      ${e.foto_path ? `<img class="prova" data-foto="${esc(e.foto_path)}" alt="foto-prova" loading="lazy">` : ''}

      ${e.video_url ? (video
        ? `<div class="video-box"><iframe loading="lazy" allowfullscreen
             src="${video.tipo === 'youtube'
               ? `https://www.youtube-nocookie.com/embed/${video.id}`
               : `https://player.vimeo.com/video/${video.id}`}"></iframe></div>`
        : `<a class="link-video" href="${esc(e.video_url)}" target="_blank" rel="noopener noreferrer">🎬 Apri il video</a>`
      ) : ''}

      <div class="between mt">
        <span class="muted small">Segnato da ${esc(nomeMembro(e.proposto_da))}</span>
        ${stato.dati.arbitro
          ? `<button class="icon danger" data-act="annulla-evento" data-id="${e.id}">Annulla</button>`
          : ''}
      </div>
    </div>`;
}

export const azioni = {
  async 'annulla-evento'(id) {
    if (!conferma('Annullare questo evento? I punti verranno tolti.')) return;
    const evento = stato.dati.eventi.find((x) => x.id === id);
    occupato(true, 'Annullo...');
    try {
      await api.eliminaEvento(evento);
      await bus.ricarica();
      toast('Evento annullato');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      occupato(false);
    }
  },
};
