// Nome:     coda.js
// Versione: 1.0
// Uso:      Coda degli eventi segnati quando manca la linea: li conserva sul
//           telefono, foto compresa, e li spedisce da soli appena torna il
//           campo. E' la ragione per cui al festival si puo' segnare davvero.
// Autore:   Daniele Polucci

import * as api from './api.js';

const ARCHIVIO = 'fantamontelago';
const SCAFFALE = 'coda';

/**
 * Gli eventi in attesa stanno in IndexedDB e non fra le preferenze del
 * browser, perche' devono portarsi dietro la foto-prova: una foto compressa
 * pesa duecento chili di byte, e localStorage, che tiene solo testo e sta
 * stretto in cinque mega, si riempirebbe dopo una decina di segnalazioni.
 * Qui invece ci sta un festival intero.
 */
let apertura = null;

function archivio() {
  if (apertura) return apertura;
  apertura = new Promise((risolvi, rifiuta) => {
    const richiesta = indexedDB.open(ARCHIVIO, 1);
    richiesta.onupgradeneeded = () => {
      const db = richiesta.result;
      if (!db.objectStoreNames.contains(SCAFFALE)) {
        db.createObjectStore(SCAFFALE, { keyPath: 'id', autoIncrement: true });
      }
    };
    richiesta.onsuccess = () => risolvi(richiesta.result);
    richiesta.onerror = () => rifiuta(richiesta.error || new Error('Archivio locale non disponibile'));
  });
  return apertura;
}

/** Una transazione sola, avvolta in una promessa: IndexedDB parla per eventi. */
async function conScaffale(modo, lavoro) {
  const db = await archivio();
  return new Promise((risolvi, rifiuta) => {
    const transazione = db.transaction(SCAFFALE, modo);
    const scaffale = transazione.objectStore(SCAFFALE);
    let esito;
    try {
      esito = lavoro(scaffale);
    } catch (e) {
      rifiuta(e);
      return;
    }
    transazione.oncomplete = () => risolvi(esito?.result ?? esito);
    transazione.onerror = () => rifiuta(transazione.error);
    transazione.onabort = () => rifiuta(transazione.error || new Error('Salvataggio interrotto'));
  });
}

// ------------------------------------------------------------------
// Il contenuto della coda
// ------------------------------------------------------------------

/**
 * Mette in coda un evento.
 *
 * Della regola si salva anche nome e punti, ma solo per poterli mostrare
 * nell'elenco di chi aspetta: al momento della spedizione e' il database a
 * rileggerli dalla regola citata, come per ogni altro evento.
 */
export async function accoda(voce) {
  await conScaffale('readwrite', (scaffale) => scaffale.add({
    ...voce,
    creatoIl: voce.creatoIl || new Date().toISOString(),
    bloccata: false,
    motivo: '',
  }));
}

export async function voci() {
  const tutte = await conScaffale('readonly', (scaffale) => scaffale.getAll());
  return (tutte || []).sort((a, b) => String(a.creatoIl).localeCompare(String(b.creatoIl)));
}

export async function dimentica(id) {
  await conScaffale('readwrite', (scaffale) => scaffale.delete(id));
}

/** Rimette in gioco una segnalazione che il database aveva respinto. */
export async function riprova(id) {
  await conScaffale('readwrite', (scaffale) => {
    const lettura = scaffale.get(id);
    lettura.onsuccess = () => {
      const voce = lettura.result;
      if (voce) scaffale.put({ ...voce, bloccata: false, motivo: '' });
    };
  });
}

async function blocca(id, motivo) {
  await conScaffale('readwrite', (scaffale) => {
    const lettura = scaffale.get(id);
    lettura.onsuccess = () => {
      const voce = lettura.result;
      if (voce) scaffale.put({ ...voce, bloccata: true, motivo });
    };
  });
}

// ------------------------------------------------------------------
// La spedizione
// ------------------------------------------------------------------

let inCorso = false;

/**
 * Prova a spedire tutto quello che aspetta, dalla segnalazione piu' vecchia.
 *
 * Due modi diversi di fallire, e vanno distinti:
 *
 * - **manca la linea**: non si e' perso niente, si smette subito e si riprova
 *   al prossimo giro. Insistere sugli altri sprecherebbe solo batteria.
 * - **il database dice di no** (stagione chiusa, personaggio cancellato,
 *   regola sparita): riprovare non servira' mai. La segnalazione resta in
 *   coda, marcata col motivo, e la si mostra a chi l'ha scritta: e' roba sua,
 *   la buttiamo via solo se lo decide lui.
 */
export async function inviaCoda() {
  if (inCorso) return { inviati: 0, falliti: 0 };
  if (!navigator.onLine) return { inviati: 0, falliti: 0 };

  inCorso = true;
  let inviati = 0;
  let falliti = 0;
  try {
    for (const voce of await voci()) {
      if (voce.bloccata) continue;
      try {
        await api.creaEvento({
          accampamentoId: voce.accampamentoId,
          personaggioId: voce.personaggioId,
          regola: { id: voce.regolaId, nome: voce.regolaNome, punti: voce.regolaPunti },
          nota: voce.nota,
          giornata: voce.giornata,
          videoUrl: voce.videoUrl,
          fotoPronta: voce.foto,
          creatoIl: voce.creatoIl,
        });
        await dimentica(voce.id);
        inviati += 1;
      } catch (e) {
        if (api.senzaRete(e)) break;
        await blocca(voce.id, e.message || 'Rifiutato dal database');
        falliti += 1;
      }
    }
  } finally {
    inCorso = false;
  }
  return { inviati, falliti };
}
