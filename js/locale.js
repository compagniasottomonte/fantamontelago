// Nome:     locale.js
// Versione: 1.0
// Uso:      Copia sul telefono dell'ultimo caricamento e di chi sta usando
//           l'app, cosi' al festival, dove la rete manca, l'accampamento si
//           apre e si consulta lo stesso e si arriva alla schermata Segna.
// Autore:   Daniele Polucci

const CHIAVE_DATI = 'fantamontelago.dati';
const CHIAVE_UTENTE = 'fantamontelago.utente';

/**
 * Conserva l'ultimo caricamento riuscito.
 *
 * Il service worker si tiene alla larga dalle chiamate a Supabase, e ha
 * ragione: una risposta salvata a sua insaputa darebbe una classifica falsa
 * senza che nessuno se ne accorga. Qui invece la copia e' dichiarata, si sa
 * di quando e', e l'app lo scrive in faccia a chi guarda.
 */
export function salvaDati(campId, dati) {
  if (!campId || !dati) return;
  try {
    localStorage.setItem(CHIAVE_DATI, JSON.stringify({
      campId,
      quando: new Date().toISOString(),
      dati,
    }));
  } catch {
    // Spazio esaurito: si continua con quello che c'era. Perdere la copia e'
    // un peccato, fermare l'app che sta salvando un evento sarebbe peggio.
  }
}

/** La copia salvata, solo se e' di questo accampamento. */
export function datiSalvati(campId) {
  try {
    const salvato = JSON.parse(localStorage.getItem(CHIAVE_DATI) || 'null');
    if (!salvato || salvato.campId !== campId || !salvato.dati) return null;
    return salvato;
  } catch {
    return null;
  }
}

export function dimenticaDati() {
  localStorage.removeItem(CHIAVE_DATI);
}

/**
 * Ricorda chi e' entrato.
 *
 * Senza linea la sessione di Supabase non si rinnova e l'app tornerebbe alla
 * schermata di accesso, dove non si puo' fare niente: nemmeno segnare un
 * evento da mandare piu' tardi. Per stare offline non serve un permesso
 * valido, serve solo sapere chi siamo; il permesso vero si riprende appena
 * torna il campo.
 */
export function ricordaUtente(utente) {
  if (!utente?.id) return;
  localStorage.setItem(CHIAVE_UTENTE, JSON.stringify({
    id: utente.id,
    email: utente.email || '',
  }));
}

export function utenteRicordato() {
  try {
    const salvato = JSON.parse(localStorage.getItem(CHIAVE_UTENTE) || 'null');
    return salvato?.id ? salvato : null;
  } catch {
    return null;
  }
}

/** All'uscita dall'account non deve restare niente di chi c'era prima. */
export function dimenticaLocale() {
  localStorage.removeItem(CHIAVE_UTENTE);
  dimenticaDati();
}
