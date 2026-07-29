// Nome:     card.js
// Versione: 1.0
// Uso:      Genera le immagini condivisibili di Fanta Montelago: prende un
//           evento approvato, ne compone una card in formato storia con foto,
//           punteggio, bandiera del clan e logo, e la passa al menu di
//           condivisione del telefono.
// Autore:   Daniele Polucci

import * as api from './api.js';

// Misura delle storie di Instagram. Tutto il disegno e' pensato su questa
// tela: cambiarla significa rifare le proporzioni.
const LARG = 1080;
const ALT = 1920;

const COLORI = {
  fondo: '#0c1710',
  fondo2: '#16281c',
  oro: '#d9a441',
  oro2: '#f0c46a',
  chiaro: '#e8e4d5',
  verde: '#5cbb7c',
  rosso: '#e0705c',
};

const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';

/**
 * Carica un'immagine passando da fetch invece che da <img src>.
 * Disegnare direttamente un'immagine di un altro dominio "contaminerebbe" la
 * tela e il browser rifiuterebbe di esportarla; scaricandola prima come dato
 * grezzo il problema non si pone.
 */
async function immagine(url) {
  if (!url) return null;
  try {
    const risposta = await fetch(url, { mode: 'cors' });
    if (!risposta.ok) return null;
    return await createImageBitmap(await risposta.blob());
  } catch {
    return null;
  }
}

/** Disegna riempiendo il riquadro e tagliando l'eccesso, come "object-fit: cover". */
function disegnaCoprendo(ctx, img, x, y, w, h) {
  const scala = Math.max(w / img.width, h / img.height);
  const lw = img.width * scala;
  const lh = img.height * scala;
  ctx.drawImage(img, x + (w - lw) / 2, y + (h - lh) / 2, lw, lh);
}

/** Disegna stando dentro al riquadro senza tagliare, come "object-fit: contain". */
function disegnaContenendo(ctx, img, x, y, w, h) {
  const scala = Math.min(w / img.width, h / img.height);
  const lw = img.width * scala;
  const lh = img.height * scala;
  ctx.drawImage(img, x + (w - lw) / 2, y + (h - lh) / 2, lw, lh);
}

/** Spezza il testo in righe che stiano nella larghezza data. */
function inRighe(ctx, testo, largMax, maxRighe) {
  const parole = String(testo).split(/\s+/);
  const righe = [];
  let riga = '';

  for (const parola of parole) {
    const prova = riga ? `${riga} ${parola}` : parola;
    if (ctx.measureText(prova).width <= largMax || !riga) {
      riga = prova;
    } else {
      righe.push(riga);
      riga = parola;
    }
  }
  if (riga) righe.push(riga);

  if (righe.length > maxRighe) {
    righe.length = maxRighe;
    righe[maxRighe - 1] = righe[maxRighe - 1].replace(/.{3}$/, '...');
  }
  return righe;
}

/** Sfondo di ripiego quando l'evento non ha una foto. */
function sfondoDecorativo(ctx) {
  const g = ctx.createLinearGradient(0, 0, LARG, ALT);
  g.addColorStop(0, COLORI.fondo2);
  g.addColorStop(1, COLORI.fondo);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LARG, ALT);

  ctx.strokeStyle = 'rgba(217,164,65,.10)';
  ctx.lineWidth = 3;
  for (let r = 200; r < 1500; r += 130) {
    ctx.beginPath();
    ctx.arc(LARG / 2, ALT * 0.36, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * Compone la card di un evento e la restituisce come immagine PNG.
 * Riceve gia' pronti gli URL, cosi' la funzione non deve sapere nulla di come
 * si recuperano.
 */
export async function cardEvento({ evento, personaggio, accampamento, urlFoto, urlBandiera }) {
  const canvas = document.createElement('canvas');
  canvas.width = LARG;
  canvas.height = ALT;
  const ctx = canvas.getContext('2d');

  const [foto, bandiera, logo] = await Promise.all([
    immagine(urlFoto),
    immagine(urlBandiera),
    immagine('assets/icona-app-192.png'),
  ]);

  // --- sfondo ---
  if (foto) {
    disegnaCoprendo(ctx, foto, 0, 0, LARG, ALT);
    // Velo scuro: senza, il testo bianco sparirebbe su una foto chiara.
    const velo = ctx.createLinearGradient(0, 0, 0, ALT);
    velo.addColorStop(0, 'rgba(8,18,12,.72)');
    velo.addColorStop(0.35, 'rgba(8,18,12,.28)');
    velo.addColorStop(0.62, 'rgba(8,18,12,.80)');
    velo.addColorStop(1, 'rgba(8,18,12,.97)');
    ctx.fillStyle = velo;
    ctx.fillRect(0, 0, LARG, ALT);
  } else {
    sfondoDecorativo(ctx);
  }

  // --- cornice ---
  ctx.strokeStyle = COLORI.oro;
  ctx.lineWidth = 6;
  ctx.strokeRect(38, 38, LARG - 76, ALT - 76);

  // --- in alto: bandiera del clan e nome dell'accampamento ---
  let xTesto = 90;
  if (bandiera) {
    disegnaContenendo(ctx, bandiera, 90, 100, 150, 150);
    xTesto = 275;
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORI.oro2;
  ctx.font = `600 40px ${FONT}`;
  for (const [i, riga] of inRighe(ctx, accampamento.nome, LARG - xTesto - 90, 2).entries()) {
    ctx.fillText(riga, xTesto, 150 + i * 50);
  }
  ctx.fillStyle = 'rgba(232,228,213,.65)';
  ctx.font = `400 30px ${FONT}`;
  ctx.fillText(accampamento.edizione || 'Montelago Celtic Festival', xTesto, 250);

  // --- in basso: il verdetto ---
  const positivo = evento.punti >= 0;
  let y = ALT - 470;

  ctx.fillStyle = COLORI.oro;
  ctx.font = `700 52px ${FONT}`;
  ctx.fillText(String(personaggio?.nome || '').toUpperCase(), 90, y);

  y += 90;
  ctx.fillStyle = COLORI.chiaro;
  ctx.font = `700 74px ${FONT}`;
  const righeRegola = inRighe(ctx, evento.regola_nome, LARG - 180, 3);
  for (const riga of righeRegola) {
    ctx.fillText(riga, 90, y);
    y += 86;
  }

  // --- il punteggio, grande quanto basta a leggerlo da lontano ---
  ctx.textAlign = 'right';
  ctx.fillStyle = positivo ? COLORI.verde : COLORI.rosso;
  ctx.font = `800 190px ${FONT}`;
  ctx.fillText(`${positivo ? '+' : ''}${evento.punti}`, LARG - 90, ALT - 255);

  // --- piede: logo e firma ---
  if (logo) ctx.drawImage(logo, 90, ALT - 235, 110, 110);

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORI.chiaro;
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText('FANTA MONTELAGO', 225, ALT - 175);
  ctx.fillStyle = 'rgba(232,228,213,.55)';
  ctx.font = `400 27px ${FONT}`;
  ctx.fillText('gioco amatoriale della Compagnia di Sotto Monte', 225, ALT - 135);

  return new Promise((ok) => canvas.toBlob(ok, 'image/png'));
}

/**
 * Passa l'immagine al menu di condivisione del telefono. Su desktop quel menu
 * non esiste, quindi si ripiega sullo scaricamento.
 */
export async function condividi(blob, nomeFile, testo) {
  const file = new File([blob], nomeFile, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: testo });
      return 'condivisa';
    } catch (e) {
      if (e.name === 'AbortError') return 'annullata';
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFile;
  a.click();
  URL.revokeObjectURL(url);
  return 'scaricata';
}

/** Recupera il necessario e produce la card di un evento gia' approvato. */
export async function condividiEvento(evento, personaggio, accampamento) {
  const [urlFoto, urlBandiera] = await Promise.all([
    api.urlFoto(evento.foto_path),
    api.urlFoto(accampamento.bandiera_path),
  ]);

  const blob = await cardEvento({ evento, personaggio, accampamento, urlFoto, urlBandiera });
  const nome = `fanta-montelago-${(personaggio?.nome || 'evento').toLowerCase().replace(/\W+/g, '-')}.png`;
  const testo = `${personaggio?.nome}: ${evento.regola_nome} (${evento.punti > 0 ? '+' : ''}${evento.punti}) — Fanta Montelago`;

  return condividi(blob, nome, testo);
}
