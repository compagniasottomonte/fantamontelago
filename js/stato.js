// Nome:     stato.js
// Versione: 1.0
// Uso:      Stato condiviso dell'applicazione e "bus" di navigazione. Esiste
//           come modulo a se' per evitare import circolari fra app.js e le
//           singole viste.
// Autore:   Daniele Polucci

export const stato = {
  sessione: null,   // sessione Supabase, null se non autenticato
  utente: null,     // utente corrente
  campId: null,     // accampamento aperto
  dati: null,       // risultato di api.caricaTutto()
  vista: 'classifica',
  bozza: {},        // campi di form da conservare fra un ridisegno e l'altro
};

/** Riempito da app.js all'avvio: permette alle viste di navigare e ridisegnare. */
export const bus = {
  disegna: () => {},
  ricarica: async () => {},
  vaiA: () => {},
};

const CHIAVE_CAMP = 'fantamontelago.camp';

export function ricordaCamp(id) {
  if (id) localStorage.setItem(CHIAVE_CAMP, id);
  else localStorage.removeItem(CHIAVE_CAMP);
}

export function campRicordato() {
  return localStorage.getItem(CHIAVE_CAMP);
}

// ------------------------------------------------------------------
// Calcoli derivati, usati da piu' viste
// ------------------------------------------------------------------

/** Solo gli eventi approvati fanno punteggio: le proposte non contano. */
export function eventiValidi() {
  return (stato.dati?.eventi || []).filter((e) => e.stato === 'approvato');
}

export function puntiDi(personaggioId) {
  return eventiValidi().reduce((somma, e) => (
    e.personaggio_id === personaggioId ? somma + e.punti : somma
  ), 0);
}

export function classifica() {
  return (stato.dati?.personaggi || [])
    .map((p) => ({
      ...p,
      punti: puntiDi(p.id),
      eventi: eventiValidi().filter((e) => e.personaggio_id === p.id).length,
    }))
    .sort((a, b) => b.punti - a.punti || a.nome.localeCompare(b.nome));
}

export function personaggio(id) {
  return (stato.dati?.personaggi || []).find((p) => p.id === id);
}

export function nomePersonaggio(id) {
  return personaggio(id)?.nome || 'Personaggio rimosso';
}

export function nomeMembro(userId) {
  const m = (stato.dati?.membri || []).find((x) => x.user_id === userId);
  return m?.nome_visualizzato || 'Qualcuno';
}

export function proposteInAttesa() {
  return (stato.dati?.eventi || []).filter((e) => e.stato === 'proposto');
}
