// Nome:     segna.js
// Versione: 1.0
// Uso:      Modulo per registrare un bonus o un malus: scelta del personaggio
//           e della regola, nota, giornata, foto-prova e link a un video.
//           L'arbitro conferma subito, gli altri inviano una proposta.
// Autore:   Daniele Polucci

import * as api from '../api.js';
import * as coda from '../coda.js';
import { esc, punti, toast, occupato, urlSicuro, dataOra, comprimiImmagine } from '../ui.js';
import { stato, bus, stagioneChiusa, regoleAttive, codaQui, nomePersonaggio } from '../stato.js';

let fotoScelta = null;

export function render() {
  const { personaggi, arbitro } = stato.dati;

  // La coda si mostra sempre, anche quando il modulo non c'e': se la stagione
  // si e' chiusa mentre si era senza campo, chi ha segnato deve poter vedere
  // che fine hanno fatto le sue segnalazioni, non ritrovarsi il vuoto.
  const attesa = riquadroCoda();

  if (stagioneChiusa()) {
    return attesa + `<div class="empty">
      <p>🔒 <b>La stagione è chiusa.</b></p>
      <p>La classifica è definitiva: non si registrano più eventi.</p>
      ${arbitro ? '<p>Se serve, puoi riaprirla dalla scheda Gestione.</p>' : ''}
    </div>`;
  }

  if (!personaggi.length || !regoleAttive().length) {
    return attesa + `<div class="empty">
      <p>Per segnare servono almeno un personaggio e una regola.</p>
      ${arbitro ? '<p>Vai su <b>Gestione</b> per aggiungerli.</p>'
                : '<p>Aspetta che l\'arbitro finisca di preparare l\'accampamento.</p>'}
    </div>`;
  }

  const attive = regoleAttive();
  const opzioniRegole = (lista) => lista
    .map((r) => `<option value="${r.id}">${esc(r.nome)} (${r.punti > 0 ? '+' : ''}${r.punti})</option>`)
    .join('');

  const oggi = new Date().toISOString().slice(0, 10);

  return attesa + `
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
        <label>Foto-prova${fotoScelta ? ' — scelta' : ''}</label>
        <!--
          Due pulsanti e due campi distinti invece di uno solo: senza
          l'attributo "capture" certi telefoni vanno dritti alla galleria,
          con l'attributo aprono solo la fotocamera. Separandoli, entrambe le
          strade restano sempre disponibili su qualunque telefono.
        -->
        <div class="row wrap pari">
          <button class="grow" data-act="scatta-foto">📷 Scatta ora</button>
          <button class="grow" data-act="scegli-foto">🖼️ Dalla galleria</button>
        </div>
        <input type="file" id="fotoCamera" accept="image/*" capture="environment" hidden>
        <input type="file" id="foto" accept="image/*" hidden>
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

/**
 * Quello che aspetta il campo per partire.
 *
 * Sta in cima alla schermata e non in fondo: al festival e' la prima cosa che
 * si vuole sapere riaprendo l'app, "il malus di ieri notte e' arrivato?".
 */
function riquadroCoda() {
  const attesa = codaQui();
  if (!attesa.length) return '';

  const respinte = attesa.filter((v) => v.bloccata).length;
  const inPartenza = attesa.length - respinte;

  const riga = (v) => `
    <div class="item colonna">
      <div class="between">
        <span class="grow">
          <span class="name">${esc(nomePersonaggio(v.personaggioId))}</span>
          <div class="muted">${esc(v.regolaNome)}</div>
        </span>
        ${punti(v.regolaPunti)}
      </div>
      ${v.nota ? `<p class="nota">«${esc(v.nota)}»</p>` : ''}
      <div class="between mt">
        <span class="muted small">
          ${v.foto ? '📷 ' : ''}segnato il ${esc(dataOra(v.creatoIl))}
        </span>
        <span class="row">
          ${v.bloccata ? `<button class="icon" data-act="riprova-coda" data-id="${v.id}">Riprova</button>` : ''}
          <button class="icon danger" data-act="scarta-coda" data-id="${v.id}">Scarta</button>
        </span>
      </div>
      ${v.bloccata ? `<p class="muted small">❌ ${esc(v.motivo)}</p>` : ''}
    </div>`;

  return `
    <h2>In attesa di partire</h2>
    <div class="card ${respinte ? 'avviso' : ''}">
      <p class="muted">${
        inPartenza
          ? (inPartenza === 1
              ? 'Una segnalazione è sul telefono e partirà da sola appena c\'è campo.'
              : `${inPartenza} segnalazioni sono sul telefono e partiranno da sole appena c'è campo.`)
          : ''}
        ${respinte ? `${respinte === 1 ? 'Una è stata respinta' : `${respinte} sono state respinte`} dal database: decidi tu cosa farne.` : ''}
      </p>
      ${attesa.map(riga).join('')}
      ${inPartenza ? '<button class="primary block mt" data-act="invia-coda">Prova a inviarle adesso</button>' : ''}
    </div>`;
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

  'scatta-foto'() {
    document.getElementById('fotoCamera').click();
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

    const bozza = {
      accampamentoId: stato.campId,
      personaggioId,
      regola,
      nota: val('nota'),
      giornata: val('giornata') || new Date().toISOString().slice(0, 10),
      videoUrl,
      foto: fotoScelta,
    };

    // Se il browser sa gia' di essere senza linea si va dritti in coda: fare
    // un tentativo destinato a fallire vorrebbe dire far aspettare qualcuno
    // in mezzo a un prato per niente.
    if (!navigator.onLine) return mettiInCoda(bozza);

    occupato(true, fotoScelta ? 'Carico la foto...' : 'Registro...');
    try {
      await api.creaEvento(bozza);
      fotoScelta = null;
      await bus.ricarica();
      toast(stato.dati.arbitro ? 'Punti assegnati' : 'Segnalazione inviata');
    } catch (e) {
      // Il campo puo' cadere a meta' invio: in quel caso non si perde niente,
      // l'evento passa in coda come se fosse stato segnato da fermi.
      if (api.senzaRete(e)) {
        occupato(false);
        return mettiInCoda(bozza);
      }
      toast(e.message, 'error');
    } finally {
      occupato(false);
    }
  },
};

/**
 * Mette da parte una segnalazione che non e' potuta partire.
 *
 * La foto si comprime adesso, non alla spedizione: qui e' ancora un file che
 * il browser ha in mano, e ridurla subito significa tenere in archivio
 * duecento chili di byte invece dei quattro mega dell'originale. Al festival,
 * con la coda che si allunga per ore, e' la differenza fra starci e no.
 */
async function mettiInCoda(bozza) {
  occupato(true, bozza.foto ? 'Preparo la foto...' : 'Metto in coda...');
  try {
    let foto = null;
    if (bozza.foto) {
      // Se la compressione non riesce si tiene l'originale: pesa, ma una
      // segnalazione pesante e' sempre meglio di una segnalazione persa.
      foto = await comprimiImmagine(bozza.foto).catch(() => bozza.foto);
    }

    await coda.accoda({
      accampamentoId: bozza.accampamentoId,
      personaggioId: bozza.personaggioId,
      regolaId: bozza.regola.id,
      regolaNome: bozza.regola.nome,
      regolaPunti: bozza.regola.punti,
      nota: bozza.nota,
      giornata: bozza.giornata,
      videoUrl: bozza.videoUrl,
      foto,
      creatoIl: new Date().toISOString(),
    });

    fotoScelta = null;
    await bus.ricaricaCoda();
    bus.disegna();
    toast('Senza linea: la mando appena torna il campo');
  } catch (e) {
    toast(e.message || 'Non sono riuscito a mettere in coda la segnalazione', 'error');
  } finally {
    occupato(false);
  }
}

/** Registrato da app.js: il change su input file non passa dal bus delle azioni. */
export function collegaInputFoto() {
  document.addEventListener('change', (ev) => {
    const daCampoFoto = ev.target.id === 'foto' || ev.target.id === 'fotoCamera';
    if (!daCampoFoto || !ev.target.files?.length) return;
    const file = ev.target.files[0];
    if (file.size > 25 * 1024 * 1024) {
      return toast('Foto troppo grande (oltre 25 MB)', 'error');
    }
    fotoScelta = file;
    const box = document.getElementById('anteprima');
    if (box) box.innerHTML = `<img class="preview" src="${URL.createObjectURL(file)}" alt="anteprima">`;
  });
}
