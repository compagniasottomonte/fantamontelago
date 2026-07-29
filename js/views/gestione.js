// Nome:     gestione.js
// Versione: 1.0
// Uso:      Pannello dell'accampamento: codice invito, personaggi in gara,
//           catalogo di bonus e malus, elenco dei membri e uscita. Le parti
//           di modifica compaiono solo all'arbitro.
// Autore:   Daniele Polucci

import * as api from '../api.js';
import { esc, punti, toast, occupato, conferma, iniziali } from '../ui.js';
import { stato, bus, ricordaCamp, puntiDi, mioPersonaggio, membroDaId,
         titoloDi, titoloCalcolatoDi } from '../stato.js';
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

    ${sezioneBandiera(a, arbitro)}
    ${sezioneChiSei(personaggi)}
    ${sezionePremio(a, arbitro)}
    ${arbitro ? sezionePersonaggi(personaggi) : elencoPersonaggi(personaggi)}
    ${arbitro ? sezioneRegole(regole) : elencoRegole(regole)}

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
      <div class="row wrap pari mt">
        <button class="grow" data-act="cambia-camp">Cambia<br>accampamento</button>
        <button class="grow ghost" data-act="logout">Esci</button>
      </div>
      <div class="sep"></div>
      ${arbitro ? `
        <button class="block danger" data-act="elimina-camp">Elimina l'accampamento</button>
        <p class="muted mt">
          Cancella per sempre classifica, eventi, foto, regole e membri.
          Da arbitro non puoi limitarti ad uscire: lasceresti il gruppo senza
          nessuno in grado di gestirlo.
        </p>`
      : `
        <button class="block danger" data-act="abbandona">Abbandona questo accampamento</button>
        <p class="muted mt">Esci tu, il gruppo resta agli altri.</p>`}
    </div>

    <h2>L'app</h2>
    ${crediti()}`;
}

/**
 * La bandiera del clan. La caricano gia' fatta, perche' i gruppi che vanno a
 * Montelago un vessillo ce l'hanno: nessun generatore di stemmi risolverebbe
 * un problema che non hanno. Senza bandiera restano le iniziali, cosi' le
 * immagini da condividere sono complete fin dal primo giorno.
 */
function sezioneBandiera(a, arbitro) {
  const vessillo = a.bandiera_path
    ? `<img class="bandiera" data-foto="${esc(a.bandiera_path)}" alt="Bandiera dell'accampamento">`
    : `<div class="bandiera vuota">${esc(iniziali(a.nome))}</div>`;

  if (!arbitro) {
    return `<h2>Bandiera</h2><div class="card center">${vessillo}</div>`;
  }

  return `
    <h2>Bandiera</h2>
    <div class="card center">
      ${vessillo}
      <div class="row wrap pari mt">
        <button class="grow" data-act="scegli-bandiera">
          ${a.bandiera_path ? '🔄 Sostituisci' : '📤 Carica la bandiera'}
        </button>
        ${a.bandiera_path
          ? '<button class="grow danger" data-act="rimuovi-bandiera">Rimuovi</button>'
          : ''}
      </div>
      <input type="file" id="fileBandiera" accept="image/*" hidden>
      <p class="muted mt">
        Meglio un PNG con lo sfondo trasparente: la bandiera finirà sulle
        immagini da condividere, e un rettangolo bianco stonerebbe.
      </p>
    </div>`;
}

/**
 * L'anello fra chi usa l'app e la classifica. I personaggi li inserisce
 * l'arbitro e non sono legati a un account, quindi senza questo passaggio
 * l'app non sa quale riga sia la tua.
 */
function sezioneChiSei(personaggi) {
  if (!personaggi.length) return '';

  const mio = mioPersonaggio();
  const disponibili = personaggi.filter((p) => !p.membro_id || p.id === mio?.id);
  const nascosti = personaggi.length - disponibili.length;

  return `
    <h2>Chi sei in classifica</h2>
    <div class="card">
      ${mio ? `
        <div class="between">
          <span class="grow">
            <span class="name">${esc(mio.nome)}</span>
            <div class="titolo">${esc(titoloDi(mio.id))}</div>
          </span>
          ${punti(puntiDi(mio.id))}
        </div>
        <div class="sep"></div>
        <div class="field">
          <label for="mioTitolo">Il tuo titolo</label>
          <input id="mioTitolo" maxlength="40" value="${esc(mio.titolo || '')}"
                 placeholder="${esc(titoloCalcolatoDi(mio.id))}">
        </div>
        <button class="block" data-act="salva-titolo" data-id="${mio.id}">Salva il titolo</button>
        <p class="muted mt">
          Lascialo vuoto e te lo assegna l'app in base a quello che combini:
          adesso saresti <b>${esc(titoloCalcolatoDi(mio.id))}</b>.
        </p>
        <div class="sep"></div>`
      : `
        <p class="muted">
          Dicci quale riga della classifica sei tu: serve per avere il tuo
          riepilogo di fine festival.
        </p>`}

      <div class="field">
        <label for="selIo">${mio ? 'Cambia abbinamento' : 'Scegli il tuo nome'}</label>
        <select id="selIo">
          <option value="">— nessuno —</option>
          ${disponibili.map((p) => `
            <option value="${p.id}"${p.id === mio?.id ? ' selected' : ''}>${esc(p.nome)}</option>
          `).join('')}
        </select>
      </div>
      <button class="primary block" data-act="rivendica">${mio ? 'Aggiorna' : 'Sono io'}</button>
      ${nascosti ? `<p class="muted mt">${nascosti} ${nascosti === 1 ? 'nome è già stato preso' : 'nomi sono già stati presi'} da altri e non compaiono nell'elenco.</p>` : ''}
    </div>`;
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
      ${personaggi.map((p) => {
        const abbinato = p.membro_id ? membroDaId(p.membro_id) : null;
        return `
        <div class="item colonna">
          <div class="row">
            <span class="grow">
              <span class="name">${esc(p.nome)}</span>
              ${p.soprannome ? `<div class="muted">«${esc(p.soprannome)}»</div>` : ''}
              ${abbinato ? `<div class="muted">👤 ${esc(abbinato.nome_visualizzato || 'iscritto')}</div>` : ''}
            </span>
            ${punti(puntiDi(p.id))}
            ${abbinato ? `<button class="icon" data-act="slega" data-id="${p.id}" title="Sciogli l'abbinamento">🔗</button>` : ''}
            <button class="icon danger" data-act="del-personaggio" data-id="${p.id}">✕</button>
          </div>
          <input class="titolo-campo" maxlength="40" value="${esc(p.titolo || '')}"
                 placeholder="${esc(titoloCalcolatoDi(p.id))}"
                 data-campo="titolo-personaggio" data-id="${p.id}">
        </div>`;
      }).join('')}
    </div>` : '<div class="empty">Nessun personaggio: aggiungi le persone del tuo clan.</div>'}`;
}

/**
 * Il regolamento in sola lettura, per chi non arbitra. Ogni accampamento se lo
 * scrive da se', quindi senza questo elenco un giocatore potrebbe conoscerlo
 * solo scorrendo il menu a tendina mentre segna.
 */
function elencoRegole(regole) {
  const attive = regole.filter((r) => r.attiva);
  const riga = (r) => `
    <div class="item">
      <span class="grow">${esc(r.nome)}${r.protetta ? ' 🔒' : ''}</span>
      ${punti(r.punti)}
    </div>`;

  const bonus = attive.filter((r) => r.punti >= 0);
  const malus = attive.filter((r) => r.punti < 0).sort((a, b) => a.punti - b.punti);

  return `
    <h2>Regolamento</h2>
    <details class="card">
      <summary class="tasto">📜 Vedi le ${attive.length} regole dell'accampamento</summary>
      <div class="sep"></div>
      <h3>Bonus (${bonus.length})</h3>
      ${bonus.map(riga).join('') || '<div class="muted">Nessun bonus.</div>'}
      <div class="sep"></div>
      <h3>Malus (${malus.length})</h3>
      ${malus.map(riga).join('') || '<div class="muted">Nessun malus.</div>'}
      <p class="muted mt">
        Le regole le decide l'arbitro: ogni accampamento ha le sue.
      </p>
    </details>`;
}

function sezioneRegole(regole) {
  // Le regole di bandiera si mostrano con il lucchetto invece dei comandi:
  // il database le rifiuterebbe comunque, ma un pulsante che non fa niente
  // sembrerebbe un guasto.
  const riga = (r) => r.protetta ? `
    <div class="item">
      <span class="grow">
        ${esc(r.nome)}
        <div class="muted">🔒 regola fissa</div>
      </span>
      ${punti(r.punti)}
    </div>`
  : `
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
    </div>
    <p class="muted">
      🔒 Le regole con il lucchetto sostengono il progetto e restano in tutti
      gli accampamenti: non si possono cancellare né modificare.
    </p>`;
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

  'scegli-bandiera'() {
    document.getElementById('fileBandiera').click();
  },

  'rimuovi-bandiera'() {
    if (!conferma('Rimuovere la bandiera dell\'accampamento?')) return;
    return conRicarica('Rimuovo...', () =>
      api.rimuoviBandiera(stato.campId, stato.dati.accampamento.bandiera_path),
      'Bandiera rimossa');
  },

  'rivendica'() {
    const scelto = document.getElementById('selIo').value;
    return conRicarica('Aggiorno...', () =>
      api.rivendicaPersonaggio(stato.campId, scelto),
      scelto ? 'Fatto: ora l\'app sa chi sei' : 'Abbinamento sciolto');
  },

  'salva-titolo'(id) {
    const testo = document.getElementById('mioTitolo').value.trim();
    return conRicarica('Salvo...', () => api.impostaTitolo(id, testo),
      testo ? 'Titolo aggiornato' : 'Sei tornato al titolo automatico');
  },

  'slega'(personaggioId) {
    if (!conferma('Sciogliere questo abbinamento? La persona potrà rifarlo.')) return;
    return conRicarica('Aggiorno...', () => api.slegaPersonaggio(personaggioId));
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

  async 'elimina-camp'() {
    const a = stato.dati.accampamento;
    if (!conferma(
      `Eliminare "${a.nome}"?\n\n` +
      'Spariscono per sempre la classifica, tutti gli eventi, le foto, le regole ' +
      'e i membri. Nessuno potrà più entrare col codice.'
    )) return;
    if (!conferma('Ultima conferma: l\'operazione non si può annullare.')) return;

    await conRicarica('Elimino l\'accampamento...', async () => {
      await api.eliminaAccampamento(stato.campId);
      stato.campId = null;
      stato.dati = null;
      ricordaCamp(null);
    }, 'Accampamento eliminato');
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

/** Campi che agiscono al cambiamento, senza passare da un pulsante. */
export function collegaCampi() {
  document.addEventListener('change', async (ev) => {
    const regola = ev.target.closest('[data-campo="punti-regola"]');
    if (regola) {
      const valore = Number(regola.value);
      if (!Number.isInteger(valore)) return toast('Punteggio non valido', 'error');
      try {
        await api.aggiornaRegola(regola.dataset.id, { punti: valore });
        await bus.ricarica();
      } catch (e) {
        toast(e.message, 'error');
      }
      return;
    }

    const titolo = ev.target.closest('[data-campo="titolo-personaggio"]');
    if (titolo) {
      try {
        await api.impostaTitolo(titolo.dataset.id, titolo.value.trim());
        await bus.ricarica();
      } catch (e) {
        toast(e.message, 'error');
      }
      return;
    }

    if (ev.target.id === 'fileBandiera' && ev.target.files?.length) {
      const file = ev.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        return toast('Immagine troppo grande (oltre 10 MB)', 'error');
      }
      occupato(true, 'Carico la bandiera...');
      try {
        await api.caricaBandiera(stato.campId, file, stato.dati.accampamento.bandiera_path);
        await bus.ricarica();
        toast('Bandiera aggiornata');
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        occupato(false);
      }
    }
  });
}
