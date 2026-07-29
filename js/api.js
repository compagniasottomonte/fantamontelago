// Nome:     api.js
// Versione: 1.0
// Uso:      Unico punto di contatto con Supabase: autenticazione, lettura e
//           scrittura di accampamenti, personaggi, regole ed eventi, upload
//           delle foto-prova. Le viste non parlano mai direttamente col
//           database.
// Autore:   Daniele Polucci

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { leggiConfig } from './config.js';
import { comprimiImmagine, ridimensionaPng } from './ui.js';

let sb = null;

export function client() {
  if (sb) return sb;
  const cfg = leggiConfig();
  if (!cfg) throw new Error('Supabase non configurato');
  sb = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return sb;
}

/** Trasforma l'errore Postgres in un messaggio leggibile in italiano. */
function esplodi(errore) {
  if (!errore) return;
  const m = errore.message || 'Errore sconosciuto';
  if (/secret API key/i.test(m)) {
    throw new Error('Hai inserito la chiave segreta invece di quella pubblica (anon)');
  }
  // Il servizio email incluso in Supabase manda pochissimi messaggi all'ora:
  // senza una spiegazione chiara sembra che l'app sia rotta.
  if (/rate limit/i.test(m)) {
    throw new Error('Troppe email richieste in poco tempo. Aspetta un\'oretta e riprova: è un limite di Supabase, non un guasto.');
  }
  if (/only request this after (\d+)/i.test(m)) {
    const secondi = m.match(/after (\d+)/i)[1];
    throw new Error(`Aspetta ${secondi} secondi prima di richiedere un altro link.`);
  }
  if (/Email not confirmed/i.test(m)) {
    throw new Error('Devi prima aprire il link di conferma che ti è arrivato per email');
  }
  if (/Failed to fetch|NetworkError/i.test(m)) {
    throw new Error('Nessuna connessione. Riprova quando ti torna la linea.');
  }
  if (m.includes('row-level security')) {
    throw new Error('Non hai i permessi per questa operazione');
  }
  if (m.includes('duplicate key')) {
    throw new Error('Esiste gia\' un elemento con questo nome');
  }
  throw new Error(m);
}

// ------------------------------------------------------------------
// Autenticazione
// ------------------------------------------------------------------

export async function sessione() {
  const { data } = await client().auth.getSession();
  return data.session;
}

export function alCambioSessione(callback) {
  return client().auth.onAuthStateChange((_evento, sess) => callback(sess));
}

export async function inviaMagicLink(email, nome) {
  const { error } = await client().auth.signInWithOtp({
    email: email.trim(),
    options: {
      // Il link deve riportare esattamente qui, altrimenti Supabase rifiuta
      // il redirect. Va aggiunto anche fra le "Redirect URLs" del progetto.
      emailRedirectTo: window.location.origin + window.location.pathname,
      data: nome ? { nome: nome.trim() } : undefined,
    },
  });
  esplodi(error);
}

export async function esci() {
  await client().auth.signOut();
}

// ------------------------------------------------------------------
// Accampamenti
// ------------------------------------------------------------------

/**
 * Gli accampamenti a cui appartiene una persona.
 *
 * Il filtro su user_id e' indispensabile: le policy permettono di leggere
 * tutte le iscrizioni dei gruppi di cui si fa parte (serve per l'elenco dei
 * membri), quindi senza filtro un accampamento con tre membri tornerebbe tre
 * volte, per giunta con i ruoli altrui.
 */
export async function mieiAccampamenti(userId) {
  const { data, error } = await client()
    .from('membri')
    .select('ruolo, nome_visualizzato, accampamenti(id, nome, edizione, codice_invito, modalita)')
    .eq('user_id', userId)
    .order('entrato_il', { ascending: true });
  esplodi(error);
  return (data || [])
    .filter((r) => r.accampamenti)
    .map((r) => ({ ...r.accampamenti, ruolo: r.ruolo, nomeVisualizzato: r.nome_visualizzato }));
}

/**
 * Passa dalla funzione crea_accampamento invece che da una INSERT diretta:
 * creazione, iscrizione come arbitro e catalogo iniziale devono avvenire
 * insieme, altrimenti la policy di lettura nasconde a chi crea l'accampamento
 * la riga che ha appena creato.
 */
export async function creaAccampamento(nome, edizione) {
  const { data, error } = await client()
    .rpc('crea_accampamento', { nome: nome.trim(), edizione: (edizione || '').trim() });
  esplodi(error);
  return data;
}

export async function entraConCodice(codice, nome) {
  const { data, error } = await client()
    .rpc('entra_con_codice', { codice: codice.trim(), nome: (nome || '').trim() });
  esplodi(error);
  return data;
}

export async function aggiornaAccampamento(id, patch) {
  const { error } = await client().from('accampamenti').update(patch).eq('id', id);
  esplodi(error);
}

/**
 * Cancella l'accampamento e tutto quello che contiene. Le righe del database
 * spariscono a cascata, ma le foto nello storage no: vanno rimosse prima che
 * l'accampamento non esista piu', perche' e' l'essere arbitro di quel gruppo
 * a dare il permesso di cancellarle.
 */
export async function eliminaAccampamento(accampamentoId) {
  const { data: file } = await client().storage.from('prove')
    .list(accampamentoId, { limit: 1000 });

  if (file?.length) {
    await client().storage.from('prove')
      .remove(file.map((f) => `${accampamentoId}/${f.name}`));
  }

  const { error } = await client().from('accampamenti').delete().eq('id', accampamentoId);
  esplodi(error);
}

/**
 * Carica la bandiera del clan. Sta nello stesso archivio delle foto-prova e
 * sotto la stessa cartella dell'accampamento, cosi' valgono le regole di
 * accesso gia' definite: la vedono i membri, la sostituisce solo l'arbitro.
 */
export async function caricaBandiera(accampamentoId, file, pathPrecedente) {
  const blob = await ridimensionaPng(file, 512);
  const path = `${accampamentoId}/bandiera-${crypto.randomUUID()}.png`;

  const { error } = await client().storage.from('prove')
    .upload(path, blob, { contentType: 'image/png', upsert: false });
  esplodi(error);

  await aggiornaAccampamento(accampamentoId, { bandiera_path: path });

  if (pathPrecedente) {
    await client().storage.from('prove').remove([pathPrecedente]);
  }
  return path;
}

export async function rimuoviBandiera(accampamentoId, path) {
  await aggiornaAccampamento(accampamentoId, { bandiera_path: null });
  if (path) await client().storage.from('prove').remove([path]);
}

/**
 * Collega chi sta usando l'app al proprio personaggio in classifica.
 * Con personaggioId nullo scioglie l'abbinamento.
 */
export async function rivendicaPersonaggio(accampamentoId, personaggioId) {
  const { error } = await client()
    .rpc('rivendica_personaggio', { camp: accampamentoId, pers: personaggioId || null });
  esplodi(error);
}

/** Solo l'arbitro: scioglie un abbinamento sbagliato. */
export async function slegaPersonaggio(personaggioId) {
  const { error } = await client()
    .from('personaggi').update({ membro_id: null }).eq('id', personaggioId);
  esplodi(error);
}

export async function esciDaAccampamento(accampamentoId, userId) {
  const { error } = await client()
    .from('membri').delete()
    .eq('accampamento_id', accampamentoId).eq('user_id', userId);
  esplodi(error);
}

// ------------------------------------------------------------------
// Caricamento completo di un accampamento
// ------------------------------------------------------------------

/**
 * Scarica in un colpo solo tutto cio' che serve alle schermate.
 * I volumi in gioco sono piccoli (decine di persone, centinaia di eventi):
 * tenere tutto in memoria e ricalcolare la classifica lato client e' piu'
 * semplice e piu' reattivo che interrogare il database a ogni schermata.
 */
export async function caricaTutto(accampamentoId, userId) {
  const db = client();
  const [acc, membri, personaggi, regole, eventi] = await Promise.all([
    db.from('accampamenti').select('*').eq('id', accampamentoId).single(),
    db.from('membri').select('*').eq('accampamento_id', accampamentoId),
    db.from('personaggi').select('*').eq('accampamento_id', accampamentoId).order('nome'),
    db.from('regole').select('*').eq('accampamento_id', accampamentoId).order('punti', { ascending: false }),
    db.from('eventi').select('*').eq('accampamento_id', accampamentoId).order('creato_il', { ascending: false }),
  ]);
  [acc, membri, personaggi, regole, eventi].forEach((r) => esplodi(r.error));

  const io = (membri.data || []).find((m) => m.user_id === userId) || null;
  return {
    accampamento: acc.data,
    membri: membri.data || [],
    personaggi: personaggi.data || [],
    regole: regole.data || [],
    eventi: eventi.data || [],
    io,
    arbitro: io?.ruolo === 'arbitro',
  };
}

// ------------------------------------------------------------------
// Personaggi e regole (solo arbitro, imposto dalle policy)
// ------------------------------------------------------------------

export async function aggiungiPersonaggio(accampamentoId, nome, soprannome) {
  const { error } = await client().from('personaggi')
    .insert({ accampamento_id: accampamentoId, nome: nome.trim(), soprannome: (soprannome || '').trim() });
  esplodi(error);
}

export async function eliminaPersonaggio(id) {
  const { error } = await client().from('personaggi').delete().eq('id', id);
  esplodi(error);
}

export async function aggiungiRegola(accampamentoId, nome, punteggio) {
  const { error } = await client().from('regole')
    .insert({ accampamento_id: accampamentoId, nome: nome.trim(), punti: punteggio });
  esplodi(error);
}

export async function aggiornaRegola(id, patch) {
  const { error } = await client().from('regole').update(patch).eq('id', id);
  esplodi(error);
}

/** Rimette il regolamento ufficiale al posto delle regole attuali. */
export async function ricaricaRegoleBase(accampamentoId) {
  const { data, error } = await client()
    .rpc('ricarica_regole_base', { camp: accampamentoId });
  esplodi(error);
  return data;
}

export async function eliminaRegola(id) {
  const { error } = await client().from('regole').delete().eq('id', id);
  esplodi(error);
}

// ------------------------------------------------------------------
// Eventi
// ------------------------------------------------------------------

/**
 * Registra un evento. Se e' l'arbitro a segnarlo nasce gia' approvato, se e'
 * un giocatore resta in attesa: la decisione la prende il trigger sul
 * database, non questo codice, cosi' non e' aggirabile dal browser.
 */
export async function creaEvento({ accampamentoId, personaggioId, regola, nota, giornata, videoUrl, foto }) {
  let fotoPath = null;

  if (foto) {
    const blob = await comprimiImmagine(foto);
    // Il primo segmento del path e' l'id dell'accampamento: e' su quello che
    // le policy dello storage decidono chi puo' leggere il file.
    fotoPath = `${accampamentoId}/${crypto.randomUUID()}.jpg`;
    const { error } = await client().storage.from('prove')
      .upload(fotoPath, blob, { contentType: 'image/jpeg', upsert: false });
    esplodi(error);
  }

  const { error } = await client().from('eventi').insert({
    accampamento_id: accampamentoId,
    personaggio_id: personaggioId,
    regola_id: regola.id,
    regola_nome: regola.nome,
    punti: regola.punti,
    nota: (nota || '').trim(),
    giornata,
    video_url: videoUrl || null,
    foto_path: fotoPath,
  });
  esplodi(error);
}

export async function decidiEvento(id, stato) {
  const { error } = await client().from('eventi').update({ stato }).eq('id', id);
  esplodi(error);
}

export async function eliminaEvento(evento) {
  const { error } = await client().from('eventi').delete().eq('id', evento.id);
  esplodi(error);
  if (evento.foto_path) {
    // Se la riga sparisce ma il file resta, lo storage si riempie di orfani.
    await client().storage.from('prove').remove([evento.foto_path]);
  }
}

/**
 * Il bucket e' privato, quindi le foto si vedono solo tramite URL firmati.
 * Un'ora di validita' basta per una sessione di consultazione.
 */
const cacheUrl = new Map();
export async function urlFoto(path) {
  if (!path) return null;
  const inCache = cacheUrl.get(path);
  if (inCache && inCache.scadenza > Date.now()) return inCache.url;

  const { data, error } = await client().storage.from('prove').createSignedUrl(path, 3600);
  if (error) return null;
  cacheUrl.set(path, { url: data.signedUrl, scadenza: Date.now() + 3000 * 1000 });
  return data.signedUrl;
}
