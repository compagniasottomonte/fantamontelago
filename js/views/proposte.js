// Nome:     proposte.js
// Versione: 1.0
// Uso:      Coda delle segnalazioni in attesa: l'arbitro le approva o le
//           rifiuta, i giocatori vedono lo stato delle proprie e possono
//           ritirarle finche' non sono state giudicate.
// Autore:   Daniele Polucci

import * as api from '../api.js';
import { esc, punti, dataBreve, toast, occupato, conferma, anteprimaVideo } from '../ui.js';
import { stato, bus, nomePersonaggio, nomeMembro, proposteInAttesa, stagioneChiusa,
         regoleProposte } from '../stato.js';

export function render() {
  const attesa = proposteInAttesa();
  const regole = regoleProposte();
  const arbitro = stato.dati.arbitro;
  const chiusa = stagioneChiusa();

  if (!attesa.length && !regole.length) {
    return `<div class="empty">
      <p>Niente in attesa.</p>
      <p class="muted">${arbitro
        ? 'Qui arrivano le segnalazioni e le regole proposte dal gruppo.'
        : 'Le tue proposte compaiono qui finché l\'arbitro non decide.'}</p>
    </div>`;
  }

  return `
    ${chiusa ? '<div class="banner">🔒 Stagione chiusa: resta tutto così finché non la riapri.</div>' : ''}

    ${regole.length ? `
      <h2>Regole proposte (${regole.length})</h2>
      ${regole.map((r) => schedaRegola(r, arbitro, chiusa)).join('')}` : ''}

    ${attesa.length ? `
      <h2>Segnalazioni (${attesa.length})</h2>
      ${attesa.map((e) => scheda(e, arbitro, chiusa)).join('')}` : ''}`;
}

/** Una regola che qualcuno vorrebbe aggiungere al regolamento. */
function schedaRegola(r, arbitro, chiusa) {
  const mia = r.proposta_da === stato.utente.id;

  return `
    <div class="card">
      <div class="between">
        <span class="grow">
          <span class="name">${esc(r.nome)}</span>
          <div class="muted">proposta da ${esc(nomeMembro(r.proposta_da))}</div>
        </span>
        ${punti(r.punti)}
      </div>

      <div class="sep"></div>
      ${chiusa ? '<div class="muted">🔒 Stagione chiusa: resta in sospeso.</div>'
      : arbitro ? `
        <div class="row">
          <button class="primary grow" data-act="approva-regola" data-id="${r.id}">✅ Adottala</button>
          <button class="grow" data-act="rifiuta-regola" data-id="${r.id}">❌ Scartala</button>
        </div>
        <p class="muted mt">Adottandola entra nel regolamento e si può assegnare a chiunque.</p>`
      : mia ? `
        <button class="block danger" data-act="ritira-regola" data-id="${r.id}">Ritira la proposta</button>`
      : '<div class="muted">In attesa del giudizio dell\'arbitro.</div>'}
    </div>`;
}

function scheda(e, arbitro, chiusa) {
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
      ${chiusa ? '<div class="muted">🔒 Stagione chiusa: questa segnalazione resta in sospeso.</div>'
      : arbitro ? `
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

async function decidiRegola(id, nuovoStato, messaggio) {
  occupato(true, 'Aggiorno...');
  try {
    await api.aggiornaRegola(id, { stato: nuovoStato });
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

  'approva-regola': (id) => decidiRegola(id, 'approvata', 'Regola adottata'),
  'rifiuta-regola': (id) => decidiRegola(id, 'rifiutata', 'Regola scartata'),

  async 'ritira-regola'(id) {
    if (!conferma('Vuoi ritirare questa proposta di regola?')) return;
    occupato(true, 'Ritiro...');
    try {
      await api.eliminaRegola(id);
      await bus.ricarica();
      toast('Proposta ritirata');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      occupato(false);
    }
  },

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
