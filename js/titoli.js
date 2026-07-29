// Nome:     titoli.js
// Versione: 1.0
// Uso:      Assegna a ogni personaggio un titolo derivato da come ha fatto
//           punti, tipo "Il Cloacale" o "Il Reclutatore". Serve a rendere
//           personali la classifica e le immagini da condividere.
// Autore:   Daniele Polucci

/**
 * I titoli si riconoscono da parole chiave e non dal nome esatto della regola:
 * ogni accampamento riscrive il proprio regolamento, e cercare la stringa
 * precisa farebbe fallire tutto al primo sinonimo.
 *
 * Vince il titolo di peso piu' alto fra quelli che si attivano, cosi' una
 * stranezza rara batte sempre una tendenza generica.
 */
const TITOLI = [
  // --- imprese leggendarie ---
  { nome: 'Il Ben10',            peso: 100, quando: (s) => s.conta(/ben\s*10/i) > 0 },
  { nome: 'Il Dionisiaco',       peso: 96,  quando: (s) => s.conta(/orgia|some\b/i) > 0 },
  { nome: 'Il Marchiato',        peso: 92,  quando: (s) => s.conta(/chiappa|stella/i) > 0 },
  { nome: 'Il Nuovo Valerio',    peso: 90,  quando: (s) => s.conta(/valerio/i, (e) => e.punti > 0) > 0 },
  { nome: 'Lo Zerbino di Valerio', peso: 88, quando: (s) => s.conta(/valerio/i, (e) => e.punti < 0) > 0 },
  { nome: 'Lo Sposo Celtico',    peso: 86,  quando: (s) => s.conta(/matrimonio/i) > 0 },

  // --- disastri memorabili ---
  { nome: 'Il Paziente Zero',    peso: 82,  quando: (s) => s.conta(/croce rossa/i) > 0 },
  { nome: 'Il Cloacale',         peso: 80,  quando: (s) => s.conta(/cloaca/i) > 0 },
  { nome: 'Il Vulcano',          peso: 78,  quando: (s) => s.conta(/vomit/i) > 0 },
  { nome: 'Il Denudato',         peso: 76,  quando: (s) => s.conta(/denuda/i) > 0 },

  // --- vizi ricorrenti ---
  { nome: 'Il Barile',           peso: 66,  quando: (s) => s.conta(/ubriac/i) >= 3 },
  { nome: 'Il Paparazzo',        peso: 64,  quando: (s) => s.conta(/foto con/i) >= 3 },
  { nome: 'Il Nomade',           peso: 62,  quando: (s) => s.conta(/si perde|sbaglia tenda|bosco/i) >= 2 },
  { nome: 'Lo Smemorato',        peso: 60,  quando: (s) => s.conta(/telefono|braccialett|bigliett/i, (e) => e.punti < 0) >= 2 },
  { nome: 'Il Gambero',          peso: 56,  quando: (s) => s.conta(/scottat/i) > 0 },
  { nome: 'Il Pantofolaio',      peso: 54,  quando: (s) => s.conta(/abbandona|prima delle|va a dormire/i) >= 2 },

  // --- virtu' ---
  { nome: 'Il Reclutatore',      peso: 70,  quando: (s) => s.conta(/nuov[ae] person/i) > 0 },
  { nome: 'Il Pilastro',         peso: 68,  quando: (s) => s.conta(/cucina|ghiaccio|ripara|approvigionament|monta la tenda/i) >= 2 },
  { nome: 'Il Mecenate',         peso: 58,  quando: (s) => s.conta(/offre da bere/i) >= 2 },
  { nome: 'Il Cacciatore',       peso: 57,  quando: (s) => s.conta(/pomiciat|instagram|telefono di/i, (e) => e.punti > 0) >= 2 },
  { nome: 'Il Celta Vero',       peso: 52,  quando: (s) => s.conta(/kilt|celta|celtic|trucco|tatoo|tatuagg/i) >= 2 },
  { nome: 'Il Dignitoso',        peso: 50,  quando: (s) => s.conta(/brillo/i) >= 2 },

  // --- tendenze generali, valide in qualunque regolamento ---
  { nome: 'L\'Irreprensibile',   peso: 30,  quando: (s) => s.nEventi >= 4 && s.negativi === 0 },
  { nome: 'Il Disastro',         peso: 28,  quando: (s) => s.negativi >= 4 && s.negativi > s.positivi * 2 },
  { nome: 'Il Temerario',        peso: 26,  quando: (s) => s.positivi >= 3 && s.negativi >= 3 },
  { nome: 'Il Passivo',          peso: 24,  quando: (s) => s.totale < 0 },
];

/** Ripiego per chi non fa scattare nessuna regola: dipende dalla posizione. */
function titoloDiRipiego(s) {
  if (s.nEventi === 0) return 'Il Fantasma';
  if (s.posizione === 1) return 'Miglior Montelaghista';
  if (s.posizione === 2) return 'Il Vice';
  if (s.posizione === s.suTotale && s.suTotale > 2) return 'Il Fanalino';
  return 'Il Montelaghista';
}

/**
 * Calcola il titolo di un personaggio.
 * Riceve gia' filtrati i suoi eventi validi e la sua posizione, cosi' resta
 * una funzione pura e facile da provare.
 */
export function titoloAutomatico(eventi, posizione, suTotale) {
  const s = {
    nEventi: eventi.length,
    positivi: eventi.filter((e) => e.punti > 0).length,
    negativi: eventi.filter((e) => e.punti < 0).length,
    totale: eventi.reduce((a, e) => a + e.punti, 0),
    posizione,
    suTotale,
    conta: (schema, filtro) => eventi.filter((e) =>
      schema.test(e.regola_nome || '') && (!filtro || filtro(e))).length,
  };

  const vincente = TITOLI
    .filter((t) => t.quando(s))
    .sort((a, b) => b.peso - a.peso)[0];

  return vincente ? vincente.nome : titoloDiRipiego(s);
}
