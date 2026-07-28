// Nome:     gestione.js
// Versione: 1.0
// Uso:      Pannello dell'accampamento: codice invito, personaggi in gara,
//           catalogo di bonus e malus, elenco dei membri e uscita. Le parti
//           di modifica compaiono solo all'arbitro.
// Autore:   Daniele Polucci

import * as api from '../api.js';
import { esc, punti, toast, occupato, conferma } from '../ui.js';
import { stato, bus, ricordaCamp, puntiDi } from '../stato.js';
import { crediti } from './info.js';

export function render() {
  const { accampamento: a, personaggi, regole, membri, arbitro } = stato.dati;

  return `
    <div class="card">
      <div class="between">
        <span class="grow">
          <span class="name">${esc(a.nome)}</span>
          <div class="muted">${esc(a.edizione)}</div>
        </span>
        <span class="pill">${arbitro ? '⚖️ arbitro' : 'giocatore'}</span>
      </div>
    </div>

    <h2>Codice invito</h2>
    <div class="card center">
      <div class="codice">${esc(a.codice_invito)}</div>
      <p class="muted">Chi ha questo codice può entrare nell'accampamento.</p>
      <div class="row">
        <button class="grow" data-act="copia-codice">📋 Copia</button>
        <button class="grow" data-act="condividi-codice">📤 Condividi</button>
      </div>
    </div>

    ${sezionePremio(a, arbitro)}
    ${arbitro ? sezionePersonaggi(personaggi) : elencoPersonaggi(personaggi)}
    ${arbitro ? sezioneRegole(regole) : ''}

    <h2>Membri (${membri.length})</h2>
    <div class="card">
      ${membri.map((m) => `
        <div class="item">
          <span class="grow">
            <span class="name">${esc(m.nome_visualizzato || 'Senza nome')}</span>
            <div class="muted">${m.ruolo}</div>
          </span>
          ${arbitro && m.user_id !== stato.utente.id
            ? `<button class="icon danger" data-act="rimuovi-membro" data-id="${m.user_id}">Rimuovi</button>`
            : ''}
        </div>`).join('')}
    </div>

    <h2>Account</h2>
    <div class="card">
      <p class="muted">Sei entrato come ${esc(stato.utente.email)}.</p>
      <div class="row wrap mt">
        <button class="grow" data-act="cambia-camp">Cambia accampamento</button>
        <button class="grow ghost" data-act="logout">Esci</button>
      </div>
      <div class="sep"></div>
      <button class="block danger" data-act="abbandona">Abbandona questo accampamento</button>
    </div>

    <h2>L'app</h2>
    ${crediti()}`;
}

/** Il premio e' facoltativo: se l'arbitro non lo imposta, la sezione sparisce. */
function sezionePremio(a, arbitro) {
  if (!arbitro) {
    return a.premio
      ? `<h2>Premio in palio</h2><div class="card"><p>${esc(a.premio)}</p></div>`
      : '';
  }
  return `
    <h2>Premio in palio</h2>
    <div class="card">
      <div class="field">
        <label for="premio">Cosa si vince (facoltativo)</label>
        <textarea id="premio" rows="3"
          placeholder="es. Aperitivo gratis per i primi due, pagato dagli ultimi due in classifica">${esc(a.premio)}</textarea>
      </div>
      <button class="primary block" data-act="salva-premio">Salva il premio</button>
      <p class="muted mt">Se lo compili, compare in cima alla classifica per tutti.</p>
    </div>`;
}

function elencoPersonaggi(personaggi) {
  return `
    <h2>In gara (${personaggi.length})</h2>
    <div class="card">
      ${personaggi.length
        ? personaggi.map((p) => `<div class="item"><span class="grow">${esc(p.nome)}</span>${punti(puntiDi(p.id))}</div>`).join('')
        : '<div class="muted">Nessun personaggio inserito.</div>'}
    </div>`;
}

function sezionePersonaggi(personaggi) {
  return `
    <h2>Personaggi in gara (${personaggi.length})</h2>
    <div class="card">
      <div class="field">
        <label for="pNome">Nome</label>
        <input id="pNome" placeholder="es. Marco">
      </div>
      <div class="field">
        <label for="pSopr">Soprannome da accampamento</label>
        <input id="pSopr" placeholder="es. Barba">
      </div>
      <button class="primary block" data-act="add-personaggio">Aggiungi al clan</button>
    </div>
    ${personaggi.length ? `<div class="card">
      ${personaggi.map((p) => `
        <div class="item">
          <span class="grow">
            <span class="name">${esc(p.nome)}</span>
            ${p.soprannome ? `<div class="muted">«${esc(p.soprannome)}»</div>` : ''}
          </span>
          ${punti(puntiDi(p.id))}
          <button class="icon danger" data-act="del-personaggio" data-id="${p.id}">✕</button>
        </div>`).join('')}
    </div>` : '<div class="empty">Nessun personaggio: aggiungi le persone del tuo clan.</div>'}`;
}

function sezioneRegole(regole) {
  const riga = (r) => `
    <div class="item">
      <span class="grow ${r.attiva ? '' : 'spento'}">${esc(r.nome)}</span>
      <input class="mini" type="number" value="${r.punti}" data-campo="punti-regola" data-id="${r.id}">
      <button class="icon" data-act="toggle-regola" data-id="${r.id}" title="Attiva o disattiva">
        ${r.attiva ? '👁' : '🚫'}
      </button>
      <button class="icon danger" data-act="del-regola" data-id="${r.id}">✕</button>
    </div>`;

  return `
    <h2>Bonus e malus (${regole.length})</h2>
    <div class="card">
      <div class="field">
        <label for="rNome">Descrizione</label>
        <input id="rNome" placeholder="es. Si addormenta in piedi">
      </div>
      <div class="field">
        <label for="rPunti">Punti (negativi per un malus)</label>
        <input id="rPunti" type="number" value="5">
      </div>
      <button class="primary block" data-act="add-regola">Aggiungi regola</button>
      <div class="sep"></div>
      <button class="block ghost" data-act="ricarica-regole">♻️ Ripristina il regolamento ufficiale</button>
      <p class="muted mt">
        Rimette il regolamento ufficiale della Compagnia, cancellando le regole
        attuali. Gli eventi già assegnati restano validi.
      </p>
    </div>
    <div class="card">
      ${regole.filter((r) => r.punti >= 0).map(riga).join('') || '<div class="muted">Nessun bonus.</div>'}
    </div>
    <div class="card">
      ${regole.filter((r) => r.punti < 0).map(riga).join('') || '<div class="muted">Nessun malus.</div>'}
    </div>`;
}

const val = (id) => (document.getElementById(id)?.value || '').trim();

async function conRicarica(testo, operazione, successo) {
  occupato(true, testo);
  try {
    await operazione();
    await bus.ricarica();
    if (successo) toast(successo);
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    occupato(false);
  }
}

export const azioni = {
  async 'copia-codice'() {
    const codice = stato.dati.accampamento.codice_invito;
    try {
      await navigator.clipboard.writeText(codice);
      toast('Codice copiato');
    } catch {
      toast(`Codice: ${codice}`);
    }
  },

  async 'condividi-codice'() {
    const { nome, codice_invito: codice } = stato.dati.accampamento;
    const testo = `Entra nel mio accampamento "${nome}" su Fanta Montelago con il codice ${codice}: ${window.location.href}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Fanta Montelago', text: testo }); } catch { /* annullato */ }
    } else {
      try {
        await navigator.clipboard.writeText(testo);
        toast('Invito copiato');
      } catch {
        toast('Codice: ' + codice);
      }
    }
  },

  'salva-premio'() {
    const testo = document.getElementById('premio').value.trim();
    return conRicarica('Salvo...', () =>
      api.aggiornaAccampamento(stato.campId, { premio: testo }),
      testo ? 'Premio aggiornato' : 'Premio rimosso');
  },

  'add-personaggio'() {
    const nome = val('pNome');
    if (!nome) return toast('Serve un nome', 'error');
    return conRicarica('Aggiungo...', () =>
      api.aggiungiPersonaggio(stato.campId, nome, val('pSopr')), 'Personaggio aggiunto');
  },

  'del-personaggio'(id) {
    const p = stato.dati.personaggi.find((x) => x.id === id);
    if (!conferma(`Eliminare ${p.nome}? Spariranno anche i suoi eventi.`)) return;
    return conRicarica('Elimino...', () => api.eliminaPersonaggio(id));
  },

  'add-regola'() {
    const nome = val('rNome');
    const p = Number(val('rPunti'));
    if (!nome) return toast('Serve una descrizione', 'error');
    if (!Number.isInteger(p) || p === 0) return toast('I punti devono essere un numero diverso da zero', 'error');
    return conRicarica('Aggiungo...', () => api.aggiungiRegola(stato.campId, nome, p), 'Regola aggiunta');
  },

  'toggle-regola'(id) {
    const r = stato.dati.regole.find((x) => x.id === id);
    return conRicarica('Aggiorno...', () => api.aggiornaRegola(id, { attiva: !r.attiva }));
  },

  async 'ricarica-regole'() {
    if (!conferma(
      'Ripristinare il regolamento ufficiale?\n\n' +
      'Le regole attuali, comprese quelle che hai aggiunto o modificato tu, ' +
      'verranno sostituite. Gli eventi già assegnati restano validi.'
    )) return;

    let quante = 0;
    await conRicarica('Ripristino il regolamento...', async () => {
      quante = await api.ricaricaRegoleBase(stato.campId);
    });
    if (quante) toast(`${quante} regole ripristinate`);
  },

  'del-regola'(id) {
    if (!conferma('Eliminare questa regola? Gli eventi già assegnati restano validi.')) return;
    return conRicarica('Elimino...', () => api.eliminaRegola(id));
  },

  'rimuovi-membro'(userId) {
    if (!conferma('Rimuovere questa persona dall\'accampamento?')) return;
    return conRicarica('Rimuovo...', () => api.esciDaAccampamento(stato.campId, userId));
  },

  'cambia-camp'() {
    stato.campId = null;
    stato.dati = null;
    ricordaCamp(null);
    bus.ricarica();
  },

  async abbandona() {
    if (!conferma('Vuoi davvero uscire da questo accampamento?')) return;
    await conRicarica('Esco...', async () => {
      await api.esciDaAccampamento(stato.campId, stato.utente.id);
      stato.campId = null;
      stato.dati = null;
      ricordaCamp(null);
    });
  },

  async logout() {
    if (!conferma('Vuoi uscire dall\'account?')) return;
    await api.esci();
    ricordaCamp(null);
    window.location.reload();
  },
};

/** Modifica del punteggio di una regola direttamente dalla lista. */
export function collegaCampi() {
  document.addEventListener('change', async (ev) => {
    const el = ev.target.closest('[data-campo="punti-regola"]');
    if (!el) return;
    const valore = Number(el.value);
    if (!Number.isInteger(valore)) return toast('Punteggio non valido', 'error');
    try {
      await api.aggiornaRegola(el.dataset.id, { punti: valore });
      await bus.ricarica();
    } catch (e) {
      toast(e.message, 'error');
    }
  });
}
