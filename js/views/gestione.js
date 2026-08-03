// Nome:     gestione.js
// Versione: 1.0
// Uso:      Pannello dell'accampamento: codice invito, personaggi in gara,
//           catalogo di bonus e malus, elenco dei membri e uscita. Le parti
//           di modifica compaiono solo all'arbitro.
// Autore:   Daniele Polucci

import * as api from '../api.js';
import { esc, punti, toast, occupato, conferma, iniziali, dataOra, perCampoData } from '../ui.js';
import { stato, bus, ricordaCamp, puntiDi, mioPersonaggio, membroDaId,
         titoloDi, titoloCalcolatoDi, stagioneChiusa, proposteInAttesa,
         regoleAttive, regoleApprovate, regoleProposte } from '../stato.js';
import { crediti } from './info.js';

export function render() {
  const { accampamento: a, personaggi, membri, arbitro } = stato.dati;

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

    ${sezioneStagione(a, arbitro)}
    ${sezioneBandiera(a, arbitro)}
    ${sezioneChiSei(personaggi)}
    ${sezionePremio(a, arbitro)}
    ${arbitro ? sezionePersonaggi(personaggi) : elencoPersonaggi(personaggi)}
    ${arbitro ? sezioneRegole() : elencoRegole()}

    <h2>Membri (${membri.length})</h2>
    <div class="card">
      ${membri.map((m) => {
        // Il nome lo puo' correggere chi lo porta e l'arbitro: chi sbaglia a
        // scriverlo entrando resterebbe altrimenti inchiodato a quello.
        const modificabile = arbitro || m.user_id === stato.utente.id;
        return `
        <div class="item colonna">
          <div class="row">
            <span class="grow">
              <span class="name">${esc(m.nome_visualizzato || 'Senza nome')}</span>
              <div class="muted">${m.ruolo}${m.user_id === stato.utente.id ? ' · sei tu' : ''}</div>
            </span>
            ${arbitro && m.user_id !== stato.utente.id
              ? `<button class="icon danger" data-act="rimuovi-membro" data-id="${m.user_id}">Rimuovi</button>`
              : ''}
          </div>
          ${modificabile ? `
            <input class="titolo-campo" maxlength="40" placeholder="Come si chiama nel gruppo"
                   value="${esc(m.nome_visualizzato || '')}"
                   data-campo="nome-membro" data-id="${m.id}">` : ''}
        </div>`;
      }).join('')}
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
 * Apertura e chiusura della stagione. La data chiude da sola, il pulsante
 * scavalca la data in entrambe le direzioni: si puo' chiudere prima se il
 * gruppo ha gia' finito, e si puo' riaprire perche' qualcuno arrivera' sempre
 * a giochi fatti con la foto che si era dimenticato.
 */
function sezioneStagione(a, arbitro) {
  const chiusa = stagioneChiusa();
  const inAttesa = proposteInAttesa().length;

  return `
    <h2>Stagione</h2>
    <div class="card">
      <div class="banner ${chiusa ? '' : 'ok'}">
        ${chiusa
          ? '🔒 Stagione chiusa: la classifica è definitiva e non si registrano più eventi.'
          : '🟢 Stagione aperta: si può ancora segnare.'}
      </div>

      ${a.chiude_il && !a.chiusa_il
        ? `<p class="muted">Chiusura automatica: <b>${esc(dataOra(a.chiude_il))}</b></p>`
        : ''}
      ${a.chiusa_il
        ? `<p class="muted">Chiusa a mano il ${esc(dataOra(a.chiusa_il))}</p>`
        : ''}

      ${arbitro ? `
        <div class="sep"></div>
        <div class="field">
          <label for="dataChiusura">Chiude da sola il</label>
          <input id="dataChiusura" type="datetime-local" value="${perCampoData(a.chiude_il)}">
        </div>
        <button class="block" data-act="salva-data-chiusura">Salva la data</button>

        <div class="sep"></div>
        ${chiusa
          ? `<button class="block primary" data-act="riapri-stagione">Riapri la stagione</button>
             <p class="muted mt">Riaprendo si toglie anche la data programmata.</p>`
          : `<button class="block danger" data-act="chiudi-stagione">Chiudi la stagione adesso</button>
             ${inAttesa
               ? `<p class="muted mt">⚠️ Hai ${inAttesa} segnalazion${inAttesa === 1 ? 'e' : 'i'} in sospeso: giudicale prima di chiudere, dopo non si potrà più.</p>`
               : ''}`}`
      : ''}
    </div>`;
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
function elencoRegole() {
  const attive = regoleAttive();
  const mieProposte = regoleProposte().filter((r) => r.proposta_da === stato.utente.id);
  const chiusa = stagioneChiusa();

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
    </details>

    ${chiusa ? '' : `
      <div class="card">
        <h3>Proponi una regola</h3>
        <p class="muted">
          Se al campo salta fuori qualcosa che merita punti, scrivila qui:
          finisce all'arbitro, che decide se adottarla.
        </p>
        <div class="field">
          <label for="rNome">Descrizione</label>
          <input id="rNome" placeholder="es. Si addormenta in piedi">
        </div>
        <div class="field">
          <label for="rPunti">Punti (negativi per un malus)</label>
          <input id="rPunti" type="number" value="5">
        </div>
        <button class="primary block" data-act="add-regola">Proponi la regola</button>
      </div>`}

    ${mieProposte.length ? `
      <div class="card">
        <h3>Le tue proposte in attesa</h3>
        ${mieProposte.map((r) => `
          <div class="item">
            <span class="grow">${esc(r.nome)}</span>
            ${punti(r.punti)}
          </div>`).join('')}
        <p class="muted mt">Dalla scheda Proposte puoi ritirarle finché l'arbitro non decide.</p>
      </div>` : ''}`;
}

function sezioneRegole() {
  const regole = regoleApprovate();
  const inArrivo = regoleProposte().length;

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
    ${inArrivo ? `
      <div class="banner ok">
        ✋ ${inArrivo} regol${inArrivo === 1 ? 'a proposta' : 'e proposte'} dal gruppo:
        le giudichi dalla scheda <b>Proposte</b>.
      </div>` : ''}
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

  'salva-data-chiusura'() {
    const valore = document.getElementById('dataChiusura').value;
    const quando = valore ? new Date(valore).toISOString() : null;
    return conRicarica('Salvo...', () => api.impostaDataChiusura(stato.campId, quando),
      quando ? 'Data di chiusura impostata' : 'Chiusura automatica tolta');
  },

  'chiudi-stagione'() {
    const inAttesa = proposteInAttesa().length;
    if (!conferma(
      'Chiudere la stagione?\n\n' +
      'La classifica diventa definitiva: nessuno potrà più segnare, approvare ' +
      'o cancellare eventi.' +
      (inAttesa ? `\n\nATTENZIONE: hai ${inAttesa} segnalazioni non giudicate, che resteranno tali.` : '') +
      '\n\nPotrai comunque riaprire.'
    )) return;
    return conRicarica('Chiudo...', () => api.chiudiStagione(stato.campId), 'Stagione chiusa');
  },

  'riapri-stagione'() {
    if (!conferma('Riaprire la stagione? Si torna a poter segnare, e la data di chiusura automatica viene tolta.')) return;
    return conRicarica('Riapro...', () => api.riapriStagione(stato.campId), 'Stagione riaperta');
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
    // Chi non arbitra puo' scriverla lo stesso: e' il database a farla nascere
    // come proposta, e il messaggio deve dirlo chiaramente.
    const arbitro = stato.dati.arbitro;
    return conRicarica(
      arbitro ? 'Aggiungo...' : 'Invio la proposta...',
      () => api.aggiungiRegola(stato.campId, nome, p),
      arbitro ? 'Regola aggiunta' : 'Proposta inviata all\'arbitro',
    );
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

    const nomeMembro = ev.target.closest('[data-campo="nome-membro"]');
    if (nomeMembro) {
      const nome = nomeMembro.value.trim();
      if (!nome) return toast('Il nome non può restare vuoto', 'error');
      try {
        await api.aggiornaNomeMembro(nomeMembro.dataset.id, nome);
        await bus.ricarica();
        toast('Nome aggiornato');
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
