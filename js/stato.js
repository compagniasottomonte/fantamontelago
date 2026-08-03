// Nome:     stato.js
// Versione: 1.0
// Uso:      Stato condiviso dell'applicazione e "bus" di navigazione. Esiste
//           come modulo a se' per evitare import circolari fra app.js e le
//           singole viste.
// Autore:   Daniele Polucci

import { titoloAutomatico } from './titoli.js';

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

/**
 * La stagione e' chiusa se l'arbitro l'ha chiusa a mano oppure se la data
 * programmata e' passata. Nessun processo periodico: si confronta la data.
 */
export function stagioneChiusa() {
  const a = stato.dati?.accampamento;
  if (!a) return false;
  if (a.chiusa_il) return true;
  return !!a.chiude_il && new Date(a.chiude_il) < new Date();
}

/** I numeri che finiscono nel riepilogo personale. */
export function statistiche(personaggioId) {
  const suoi = eventiValidi().filter((e) => e.personaggio_id === personaggioId);
  const cl = classifica();
  const positivi = suoi.filter((e) => e.punti > 0).sort((a, b) => b.punti - a.punti);
  const negativi = suoi.filter((e) => e.punti < 0).sort((a, b) => a.punti - b.punti);

  return {
    punti: suoi.reduce((somma, e) => somma + e.punti, 0),
    eventi: suoi.length,
    giornate: new Set(suoi.map((e) => e.giornata)).size,
    posizione: cl.findIndex((x) => x.id === personaggioId) + 1,
    suTotale: cl.length,
    migliore: positivi[0] || null,
    peggiore: negativi[0] || null,
  };
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

/**
 * Il titolo di un personaggio: quello scritto a mano se c'e', altrimenti
 * quello dedotto dalle sue imprese.
 */
export function titoloDi(personaggioId) {
  return personaggio(personaggioId)?.titolo || titoloCalcolatoDi(personaggioId);
}

/** Il titolo che l'app assegnerebbe, ignorando quello scritto a mano. */
export function titoloCalcolatoDi(personaggioId) {
  if (!personaggio(personaggioId)) return '';
  const cl = classifica();
  return titoloAutomatico(
    eventiValidi().filter((e) => e.personaggio_id === personaggioId),
    cl.findIndex((x) => x.id === personaggioId) + 1,
    cl.length,
  );
}

/** Il personaggio in classifica abbinato a chi sta usando l'app, se si e' riconosciuto. */
export function mioPersonaggio() {
  const io = stato.dati?.io;
  if (!io) return null;
  return (stato.dati.personaggi || []).find((p) => p.membro_id === io.id) || null;
}

/** Il membro dietro un abbinamento, per mostrare chi si e' preso un personaggio. */
export function membroDaId(id) {
  return (stato.dati?.membri || []).find((m) => m.id === id) || null;
}

export function proposteInAttesa() {
  return (stato.dati?.eventi || []).filter((e) => e.stato === 'proposto');
}

/**
 * Lo stato di una regola, tollerante verso i database non ancora aggiornati.
 *
 * Il codice viene pubblicato prima che l'arbitro esegua la migrazione, e in
 * quella finestra la colonna "stato" non esiste ancora: senza questo
 * ripiego nessuna regola risulterebbe valida e non si potrebbe piu' segnare.
 * Una regola che c'era prima della novita' e' per definizione gia' approvata.
 */
function statoRegola(regola) {
  return regola.stato || 'approvata';
}

/** Le regole in vigore: approvate dall'arbitro e non spente. */
export function regoleAttive() {
  return (stato.dati?.regole || []).filter((r) => statoRegola(r) === 'approvata' && r.attiva);
}

/** Le regole approvate, spente comprese: e' l'elenco che l'arbitro gestisce. */
export function regoleApprovate() {
  return (stato.dati?.regole || []).filter((r) => statoRegola(r) === 'approvata');
}

export function regoleProposte() {
  return (stato.dati?.regole || []).filter((r) => statoRegola(r) === 'proposta');
}

/** Quante cose aspettano un giudizio, per il contatore sulla scheda Proposte. */
export function totaleInAttesa() {
  return proposteInAttesa().length + regoleProposte().length;
}
