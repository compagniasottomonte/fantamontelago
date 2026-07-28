// Nome:     config.js
// Versione: 1.0
// Uso:      Credenziali del progetto Supabase. Se lasciate vuote, l'app mostra
//           una schermata di configurazione e le salva nel browser, cosi' si
//           puo' pubblicare il repository senza scriverci dentro le chiavi.
// Autore:   Daniele Polucci

// La chiave "anon" e' pubblica per progetto: e' pensata per stare nel codice
// del browser. A proteggere i dati sono le policy di Row Level Security
// definite in supabase/schema.sql, non la segretezza di questa stringa.
const DA_FILE = {
  url: 'https://vlrdtuwraujloyllkdcz.supabase.co',      // es. 'https://abcdefghijklm.supabase.co'
  anonKey: 'sb_publishable_hp6-lsZFqdT0dEpPRi0duA_zwF1BDJD',  // es. 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};

const CHIAVE_LOCALE = 'fantamontelago.config';

export function leggiConfig() {
  if (DA_FILE.url && DA_FILE.anonKey) return DA_FILE;
  try {
    const salvato = JSON.parse(localStorage.getItem(CHIAVE_LOCALE) || 'null');
    if (salvato?.url && salvato?.anonKey) return salvato;
  } catch { /* configurazione illeggibile: si ricomincia dal setup */ }
  return null;
}

export function salvaConfig(url, anonKey) {
  localStorage.setItem(CHIAVE_LOCALE, JSON.stringify({
    url: url.trim().replace(/\/+$/, ''),
    anonKey: anonKey.trim(),
  }));
}

export function dimenticaConfig() {
  localStorage.removeItem(CHIAVE_LOCALE);
}
