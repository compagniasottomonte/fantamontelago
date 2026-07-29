// Nome:     ui.js
// Versione: 1.0
// Uso:      Funzioni di appoggio condivise dalle viste: escaping HTML,
//           formattazione dei punteggi, notifiche a comparsa, dialoghi di
//           conferma e compressione delle foto prima dell'upload.
// Autore:   Daniele Polucci

/** Neutralizza l'HTML nei dati inseriti dagli utenti. */
export function esc(valore) {
  return String(valore ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/** Punteggio con segno esplicito e colore secondo il segno. */
export function punti(n) {
  const classe = n > 0 ? 'pos' : n < 0 ? 'neg' : '';
  return `<span class="pts ${classe}">${n > 0 ? '+' : ''}${n}</span>`;
}

export function dataBreve(iso) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

export function dataOra(iso) {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/** Converte una data ISO nel formato che vuole <input type="datetime-local">. */
export function perCampoData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

let timerToast;
export function toast(messaggio, tipo = 'info') {
  const el = document.getElementById('toast');
  el.textContent = messaggio;
  el.className = `toast show ${tipo}`;
  clearTimeout(timerToast);
  timerToast = setTimeout(() => { el.className = 'toast'; }, 2600);
}

export function conferma(domanda) {
  return window.confirm(domanda);
}

/** Blocca l'interfaccia durante le operazioni di rete piu' lente. */
export function occupato(attivo, testo = 'Un attimo...') {
  const el = document.getElementById('busy');
  el.querySelector('span').textContent = testo;
  el.classList.toggle('show', attivo);
}

/** Ridisegna un file immagine su una tela piu' piccola, mantenendo le proporzioni. */
async function riduci(file, latoMax) {
  if (!file.type.startsWith('image/')) throw new Error('Il file non e\' un\'immagine');

  const bitmap = await createImageBitmap(file);
  const scala = Math.min(1, latoMax / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scala);
  canvas.height = Math.round(bitmap.height * scala);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas;
}

/**
 * Ridimensiona e ricomprime una foto lato browser.
 * Al festival la rete e' pessima: mandare 4 MB di JPEG originale significa
 * upload falliti, mentre 1600px a qualita' 0.72 sono ~250 KB e restano
 * ampiamente dentro il piano gratuito di Supabase.
 */
export async function comprimiImmagine(file, latoMax = 1600, qualita = 0.72) {
  const canvas = await riduci(file, latoMax);
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', qualita));
  if (!blob) throw new Error('Compressione non riuscita');
  return blob;
}

/**
 * Ridimensiona conservando la trasparenza.
 * Le bandiere dei clan sono quasi sempre PNG con lo sfondo trasparente:
 * convertirle in JPEG le chiuderebbe dentro un rettangolo bianco, che nelle
 * card stonerebbe su qualunque fondo.
 */
export async function ridimensionaPng(file, latoMax = 512) {
  const canvas = await riduci(file, latoMax);
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
  if (!blob) throw new Error('Conversione non riuscita');
  return blob;
}

/** Ripiego quando un accampamento non ha ancora caricato la sua bandiera. */
export function iniziali(nome) {
  return String(nome || '?')
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-Z]/.test(p))
    .slice(0, 3)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?';
}

/** Estrae un id di YouTube/Vimeo per l'anteprima, se riconoscibile. */
export function anteprimaVideo(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { tipo: 'youtube', id: yt[1] };
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return { tipo: 'vimeo', id: vm[1] };
  return null;
}

/** Accetta solo indirizzi http/https: evita link javascript: nei campi video. */
export function urlSicuro(url) {
  if (!url) return '';
  try {
    const u = new URL(url.trim());
    return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '';
  } catch {
    return '';
  }
}
