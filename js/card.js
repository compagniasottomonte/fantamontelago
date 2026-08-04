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

/** Velo scuro: senza, il testo chiaro sparirebbe su una foto luminosa. */
function stendiVelo(ctx, opacita = 1) {
  const velo = ctx.createLinearGradient(0, 0, 0, ALT);
  velo.addColorStop(0, `rgba(8,18,12,${0.72 * opacita})`);
  velo.addColorStop(0.35, `rgba(8,18,12,${0.28 * opacita})`);
  velo.addColorStop(0.62, `rgba(8,18,12,${0.80 * opacita})`);
  velo.addColorStop(1, `rgba(8,18,12,${0.97 * opacita})`);
  ctx.fillStyle = velo;
  ctx.fillRect(0, 0, LARG, ALT);
}

/**
 * Lo sfondo della card a partire dalla foto-prova.
 *
 * Una foto verticale riempie il formato e si lascia a tutto schermo. Una
 * orizzontale invece, ritagliata per riempire, perderebbe i due terzi della
 * scena: quasi sempre proprio le persone ai lati. In quel caso si mette la
 * foto intera al centro e dietro la stessa foto sfocata a riempire il vuoto,
 * cosi' niente viene tagliato e il formato resta verticale.
 */
function disegnaFondoConFoto(ctx, foto) {
  const rapportoCard = LARG / ALT;
  const rapportoFoto = foto.width / foto.height;

  // Quanta parte della foto sparirebbe riempiendo il formato. Si decide su
  // questo e non sulle proporzioni: un 3:4, che e' lo scatto piu' comune da
  // telefono, perderebbe un quarto della larghezza, cioe' le persone ai bordi.
  const ritaglio = rapportoFoto > rapportoCard
    ? 1 - rapportoCard / rapportoFoto
    : 1 - rapportoFoto / rapportoCard;

  if (ritaglio <= 0.18) {
    disegnaCoprendo(ctx, foto, 0, 0, LARG, ALT);
    stendiVelo(ctx);
    return;
  }

  // Sfondo sfocato, debordante per non lasciare bordi chiari ai lati.
  ctx.save();
  if ('filter' in ctx) ctx.filter = 'blur(44px)';
  disegnaCoprendo(ctx, foto, -60, -60, LARG + 120, ALT + 120);
  ctx.restore();
  stendiVelo(ctx, 0.85);

  // La foto intera, dentro la fascia libera fra intestazione e verdetto.
  const zona = { x: 60, y: 300, l: LARG - 120, a: 830 };
  const scala = Math.min(zona.l / foto.width, zona.a / foto.height);
  const l = foto.width * scala, a = foto.height * scala;
  const x = zona.x + (zona.l - l) / 2, y = zona.y + (zona.a - a) / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 34;
  ctx.drawImage(foto, x, y, l, a);
  ctx.restore();

  ctx.strokeStyle = 'rgba(217,164,65,.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, l, a);
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
export async function cardEvento({ evento, personaggio, accampamento, titolo, urlFoto, urlBandiera }) {
  const canvas = document.createElement('canvas');
  canvas.width = LARG;
  canvas.height = ALT;
  const ctx = canvas.getContext('2d');

  const foto = await immagine(urlFoto);

  if (foto) disegnaFondoConFoto(ctx, foto);
  else sfondoDecorativo(ctx);

  // --- cornice ---
  ctx.strokeStyle = COLORI.oro;
  ctx.lineWidth = 6;
  ctx.strokeRect(38, 38, LARG - 76, ALT - 76);

  await intestazione(ctx, accampamento, urlBandiera);

  // --- in basso: il verdetto ---
  //
  // Nome e punteggio condividono la stessa riga, e sotto scorre la regola.
  // Tenere il numero accanto al nome invece che in fondo evita che una regola
  // dal nome lungo, scendendo su tre righe, gli finisca addosso.
  // Con la nota da stampare serve piu' spazio, quindi il blocco parte piu'
  // in alto invece di schiacciarsi contro il piede.
  const positivo = evento.punti >= 0;
  const rigaVerdetto = ALT - (evento.nota ? 680 : 620);

  // Il nome si ferma a meta' larghezza: oltre finirebbe sotto al punteggio,
  // che occupa la meta' destra della stessa riga.
  ctx.fillStyle = COLORI.oro;
  ctx.font = `700 52px ${FONT}`;
  ctx.fillText(inRighe(ctx, String(personaggio?.nome || '').toUpperCase(), 480, 1)[0] || '', 90, rigaVerdetto);

  ctx.textAlign = 'right';
  ctx.fillStyle = positivo ? COLORI.verde : COLORI.rosso;
  ctx.font = `800 150px ${FONT}`;
  ctx.fillText(`${positivo ? '+' : ''}${evento.punti}`, LARG - 90, rigaVerdetto);

  ctx.textAlign = 'left';
  let y = rigaVerdetto;

  if (titolo) {
    y += 48;
    ctx.fillStyle = 'rgba(240,196,106,.85)';
    ctx.font = `italic 400 38px ${FONT}`;
    ctx.fillText(inRighe(ctx, titolo, LARG - 180, 1)[0], 90, y);
  }

  y += 90;
  ctx.fillStyle = COLORI.chiaro;
  ctx.font = `700 74px ${FONT}`;
  for (const riga of inRighe(ctx, evento.regola_nome, LARG - 180, evento.nota ? 2 : 3)) {
    ctx.fillText(riga, 90, y);
    y += 86;
  }

  // La nota e' il racconto dell'episodio: senza, la card dice cosa e' successo
  // ma non perche' faccia ridere.
  if (evento.nota) {
    y += 4;
    ctx.fillStyle = 'rgba(232,228,213,.82)';
    ctx.font = `italic 400 38px ${FONT}`;
    for (const riga of inRighe(ctx, `« ${evento.nota} »`, LARG - 180, 2)) {
      ctx.fillText(riga, 90, y);
      y += 44;
    }
  }

  await piede(ctx);
  return new Promise((ok) => canvas.toBlob(ok, 'image/png'));
}

/** Intestazione comune alle immagini finali: bandiera e nome del clan. */
async function intestazione(ctx, accampamento, urlBandiera) {
  const bandiera = await immagine(urlBandiera);
  let x = 90;
  if (bandiera) {
    disegnaContenendo(ctx, bandiera, 90, 100, 150, 150);
    x = 275;
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(232,228,213,.55)';
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText('ACCAMPAMENTO', x, 118);

  ctx.fillStyle = COLORI.oro2;
  ctx.font = `600 40px ${FONT}`;
  for (const [i, riga] of inRighe(ctx, accampamento.nome, LARG - x - 90, 2).entries()) {
    ctx.fillText(riga, x, 166 + i * 48);
  }
  ctx.fillStyle = 'rgba(232,228,213,.65)';
  ctx.font = `400 30px ${FONT}`;
  ctx.fillText(accampamento.edizione || 'Montelago Celtic Festival', x, 258);
}

/**
 * Piede comune: logo, nome del gioco e invito a richiedere l'app.
 * E' la parte che lavora quando la card finisce su Instagram davanti a
 * qualcuno che non sa cosa sia.
 */
async function piede(ctx) {
  const logo = await immagine('assets/icona-app-192.png');
  if (logo) ctx.drawImage(logo, 90, ALT - 230, 96, 96);

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORI.chiaro;
  ctx.font = `700 36px ${FONT}`;
  ctx.fillText('FANTA MONTELAGO', 210, ALT - 198);

  ctx.fillStyle = COLORI.oro2;
  ctx.font = `600 25px ${FONT}`;
  ctx.fillText(inRighe(ctx, 'Richiedi l\'app alla Compagnia di Sotto Monte su Instagram', 780, 1)[0],
    210, ALT - 164);

  ctx.fillStyle = 'rgba(232,228,213,.45)';
  ctx.font = `400 21px ${FONT}`;
  ctx.fillText(inRighe(ctx, 'progetto amatoriale dei fan · non è l\'app ufficiale del festival', 780, 1)[0],
    210, ALT - 134);
}

/** Una riga di statistica: etichetta a sinistra, valore a destra. */
function rigaDato(ctx, y, etichetta, valore, colore) {
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(232,228,213,.7)';
  ctx.font = `400 34px ${FONT}`;
  ctx.fillText(etichetta, 100, y);

  ctx.textAlign = 'right';
  ctx.fillStyle = colore || COLORI.chiaro;
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText(String(valore), LARG - 100, y);

  ctx.strokeStyle = 'rgba(44,70,50,.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(100, y + 24);
  ctx.lineTo(LARG - 100, y + 24);
  ctx.stroke();
}

/**
 * Il riepilogo personale di fine stagione: com'e' andata a una persona sola.
 * E' quello che si condivide piu' volentieri, perche' parla di chi lo guarda.
 */
export async function cardRecap({ personaggio, titolo, dati, accampamento, urlBandiera }) {
  const canvas = document.createElement('canvas');
  canvas.width = LARG;
  canvas.height = ALT;
  const ctx = canvas.getContext('2d');

  sfondoDecorativo(ctx);
  ctx.strokeStyle = COLORI.oro;
  ctx.lineWidth = 6;
  ctx.strokeRect(38, 38, LARG - 76, ALT - 76);

  await intestazione(ctx, accampamento, urlBandiera);

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(232,228,213,.6)';
  ctx.font = `400 32px ${FONT}`;
  ctx.fillText('IL MIO MONTELAGO', LARG / 2, 400);

  ctx.fillStyle = COLORI.oro;
  ctx.font = `700 76px ${FONT}`;
  ctx.fillText(inRighe(ctx, String(personaggio?.nome || '').toUpperCase(), LARG - 180, 1)[0] || '', LARG / 2, 490);

  if (titolo) {
    ctx.fillStyle = COLORI.oro2;
    ctx.font = `italic 400 44px ${FONT}`;
    ctx.fillText(inRighe(ctx, titolo, LARG - 180, 1)[0], LARG / 2, 555);
  }

  // Il totale, che e' il dato che tutti cercano per primo.
  const positivo = dati.punti >= 0;
  ctx.fillStyle = positivo ? COLORI.verde : COLORI.rosso;
  ctx.font = `800 210px ${FONT}`;
  ctx.fillText(`${positivo ? '+' : ''}${dati.punti}`, LARG / 2, 760);

  ctx.fillStyle = 'rgba(232,228,213,.6)';
  ctx.font = `400 32px ${FONT}`;
  ctx.fillText('punti totali', LARG / 2, 810);

  let y = 940;
  rigaDato(ctx, y, 'Posizione finale', `${dati.posizione}° su ${dati.suTotale}`, COLORI.oro2);
  y += 100;
  rigaDato(ctx, y, 'Imprese registrate', dati.eventi);
  y += 100;
  rigaDato(ctx, y, 'Giornate a referto', dati.giornate);

  if (dati.migliore) {
    y += 100;
    rigaDato(ctx, y, inRighe(ctx, dati.migliore.regola_nome, 560, 1)[0],
      `+${dati.migliore.punti}`, COLORI.verde);
  }
  if (dati.peggiore) {
    y += 100;
    rigaDato(ctx, y, inRighe(ctx, dati.peggiore.regola_nome, 560, 1)[0],
      String(dati.peggiore.punti), COLORI.rosso);
  }

  await piede(ctx);
  return new Promise((ok) => canvas.toBlob(ok, 'image/png'));
}

/** Il manifesto dell'accampamento: la classifica finale in bella copia. */
export async function cardPoster({ accampamento, classifica, urlBandiera }) {
  const canvas = document.createElement('canvas');
  canvas.width = LARG;
  canvas.height = ALT;
  const ctx = canvas.getContext('2d');

  sfondoDecorativo(ctx);
  ctx.strokeStyle = COLORI.oro;
  ctx.lineWidth = 6;
  ctx.strokeRect(38, 38, LARG - 76, ALT - 76);

  await intestazione(ctx, accampamento, urlBandiera);

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORI.oro;
  ctx.font = `700 58px ${FONT}`;
  ctx.fillText('CLASSIFICA FINALE', LARG / 2, 400);

  // Con tanti partecipanti si mostrano i primi e si conta il resto: meglio
  // dieci righe leggibili che venticinque francobolli.
  //
  // Lo spazio si calcola da dove finisce l'elenco, che cambia a seconda che ci
  // sia o meno il premio da stampare sotto: con misure fisse, il "e altri N"
  // andava a finire sopra al testo del premio.
  const yInizio = 490;
  const yFine = accampamento.premio ? 1440 : 1620;
  const spazio = yFine - yInizio;

  const massimo = Math.max(1, Math.min(12, Math.floor(spazio / 62)));
  const mostrati = classifica.slice(0, massimo);
  const restanti = classifica.length - mostrati.length;
  const passo = Math.min(96, Math.floor(spazio / Math.max(mostrati.length, 1)));

  let y = yInizio;

  for (const [i, p] of mostrati.entries()) {
    const medaglia = ['🥇', '🥈', '🥉'][i];

    ctx.textAlign = 'left';
    ctx.fillStyle = i < 3 ? COLORI.oro : 'rgba(232,228,213,.55)';
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText(medaglia ? `${i + 1}` : `${i + 1}`, 100, y);

    ctx.fillStyle = COLORI.chiaro;
    ctx.font = `${i < 3 ? 700 : 400} ${i < 3 ? 48 : 42}px ${FONT}`;
    ctx.fillText(inRighe(ctx, p.nome, 560, 1)[0] || '', 180, y);

    if (p.titolo) {
      ctx.fillStyle = 'rgba(240,196,106,.7)';
      ctx.font = `italic 400 28px ${FONT}`;
      ctx.fillText(inRighe(ctx, p.titolo, 560, 1)[0], 180, y + 34);
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = p.punti >= 0 ? COLORI.verde : COLORI.rosso;
    ctx.font = `700 48px ${FONT}`;
    ctx.fillText(`${p.punti > 0 ? '+' : ''}${p.punti}`, LARG - 100, y);

    y += passo;
  }

  if (restanti > 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(232,228,213,.5)';
    ctx.font = `400 32px ${FONT}`;
    ctx.fillText(`e altri ${restanti}`, LARG / 2, y + 10);
  }

  if (accampamento.premio) {
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORI.oro;
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText('PREMIO IN PALIO', LARG / 2, ALT - 400);
    ctx.fillStyle = COLORI.chiaro;
    ctx.font = `400 34px ${FONT}`;
    let yp = ALT - 350;
    for (const riga of inRighe(ctx, accampamento.premio, LARG - 200, 3)) {
      ctx.fillText(riga, LARG / 2, yp);
      yp += 44;
    }
  }

  await piede(ctx);
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
export async function condividiEvento(evento, personaggio, accampamento, titolo) {
  const [urlFoto, urlBandiera] = await Promise.all([
    api.urlFoto(evento.foto_path),
    api.urlFoto(accampamento.bandiera_path),
  ]);

  const blob = await cardEvento({
    evento, personaggio, accampamento, titolo, urlFoto, urlBandiera,
  });
  const nome = `fanta-montelago-${(personaggio?.nome || 'evento').toLowerCase().replace(/\W+/g, '-')}.png`;
  const testo = `${personaggio?.nome}: ${evento.regola_nome} (${evento.punti > 0 ? '+' : ''}${evento.punti}) — Fanta Montelago`;

  return condividi(blob, nome, testo);
}

/** Produce e condivide il riepilogo personale di fine stagione. */
export async function condividiRecap(personaggio, titolo, dati, accampamento) {
  const urlBandiera = await api.urlFoto(accampamento.bandiera_path);
  const blob = await cardRecap({ personaggio, titolo, dati, accampamento, urlBandiera });

  const nome = `il-mio-montelago-${(personaggio?.nome || 'recap').toLowerCase().replace(/\W+/g, '-')}.png`;
  const testo = `Il mio Montelago: ${dati.punti > 0 ? '+' : ''}${dati.punti} punti, ${dati.posizione}° su ${dati.suTotale}. ${titolo}`;

  return condividi(blob, nome, testo);
}

/** Produce e condivide il manifesto con la classifica finale. */
export async function condividiPoster(accampamento, classifica) {
  const urlBandiera = await api.urlFoto(accampamento.bandiera_path);
  const blob = await cardPoster({ accampamento, classifica, urlBandiera });

  const nome = `classifica-${(accampamento.nome || 'accampamento').toLowerCase().replace(/\W+/g, '-')}.png`;
  const vincitore = classifica[0];
  const testo = vincitore
    ? `Classifica finale di ${accampamento.nome}: vince ${vincitore.nome} con ${vincitore.punti} punti.`
    : `Classifica finale di ${accampamento.nome}`;

  return condividi(blob, nome, testo);
}
