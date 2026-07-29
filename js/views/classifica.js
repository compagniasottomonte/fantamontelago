// Nome:     classifica.js
// Versione: 1.0
// Uso:      Vista della classifica dell'accampamento, con podio, dettaglio
//           per personaggio e riepilogo degli ultimi eventi approvati.
// Autore:   Daniele Polucci

import { esc, punti, dataBreve } from '../ui.js';
import { stato, bus, classifica, eventiValidi, nomePersonaggio, mioPersonaggio } from '../stato.js';

export function render() {
  const cl = classifica();
  const premio = stato.dati.accampamento.premio;
  const strisciaPremio = premio
    ? `<div class="premio"><div class="titolo">🏅 Premio in palio</div>${esc(premio)}</div>`
    : '';

  if (!cl.length) {
    return `
      ${strisciaPremio}
      <div class="empty">
        <p>Nessun personaggio in classifica.</p>
        ${stato.dati.arbitro
          ? '<p>Aggiungi le persone del tuo clan dalla scheda <b>Gestione</b>.</p>'
          : '<p>L\'arbitro non ha ancora inserito i partecipanti.</p>'}
      </div>`;
  }

  const podio = cl.slice(0, 3);
  const resto = cl.slice(3);
  const mioId = mioPersonaggio()?.id;
  const evidenzia = (id) => (id === mioId ? ' io' : '');

  const cartaPodio = (p, i) => `
    <div class="podio-posto p${i + 1}">
      <div class="medaglia">${['🥇', '🥈', '🥉'][i]}</div>
      <div class="podio-nome">${esc(p.nome)}</div>
      ${punti(p.punti)}
    </div>`;

  const riga = (p, i) => `
    <details class="card${evidenzia(p.id)}">
      <summary class="row">
        <span class="rank">${i + 4}</span>
        <span class="grow">
          <span class="name">${esc(p.nome)}</span>
          ${p.soprannome ? `<div class="muted">«${esc(p.soprannome)}»</div>` : ''}
        </span>
        ${punti(p.punti)}
      </summary>
      ${dettaglio(p.id)}
    </details>`;

  const ultimi = eventiValidi().slice(0, 8).map((e) => `
    <div class="item">
      <span class="grow">
        <span class="name">${esc(nomePersonaggio(e.personaggio_id))}</span>
        <div class="muted">${esc(e.regola_nome)} · ${dataBreve(e.giornata)}</div>
      </span>
      ${punti(e.punti)}
    </div>`).join('');

  return `
    ${strisciaPremio}
    ${invitoRiconoscersi()}
    <div class="podio">${podio.map(cartaPodio).join('')}</div>

    ${podio.map((p, i) => `
      <details class="card${evidenzia(p.id)}">
        <summary class="row">
          <span class="rank r${i + 1}">${i + 1}</span>
          <span class="grow">
            <span class="name">${esc(p.nome)}</span>
            <div class="muted">${p.eventi} event${p.eventi === 1 ? 'o' : 'i'}</div>
          </span>
          ${punti(p.punti)}
        </summary>
        ${dettaglio(p.id)}
      </details>`).join('')}

    ${resto.map(riga).join('')}

    ${ultimi ? `<h2>Ultimi verdetti</h2><div class="card">${ultimi}</div>` : ''}`;
}

/**
 * Finche' non ci si riconosce, l'app non sa quale riga sia la tua: senza quel
 * collegamento niente riepilogo personale a fine festival.
 */
function invitoRiconoscersi() {
  if (mioPersonaggio() || !stato.dati.personaggi.length) return '';
  return `
    <div class="banner ok">
      <div class="between">
        <span class="grow">Non ti sei ancora riconosciuto in classifica.</span>
        <button data-act="vai-riconoscimento">Chi sono</button>
      </div>
    </div>`;
}

export const azioni = {
  'vai-riconoscimento'() { bus.vaiA('gestione'); },
};

/** Storico dei punti di un singolo personaggio, mostrato aprendo la riga. */
function dettaglio(personaggioId) {
  const suoi = eventiValidi().filter((e) => e.personaggio_id === personaggioId);
  if (!suoi.length) return '<div class="sep"></div><div class="muted pad">Ancora nessun punto.</div>';

  return `<div class="sep"></div>${suoi.map((e) => `
    <div class="item">
      <span class="grow">
        ${esc(e.regola_nome)}
        <div class="muted">${dataBreve(e.giornata)}${e.nota ? ` · ${esc(e.nota)}` : ''}</div>
      </span>
      ${punti(e.punti)}
    </div>`).join('')}`;
}
