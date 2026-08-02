// Nome:     auth.js
// Versione: 1.0
// Uso:      Schermate di ingresso: configurazione iniziale di Supabase e
//           accesso senza password tramite magic link via email.
// Autore:   Daniele Polucci

import * as api from '../api.js';
import { salvaConfig, dimenticaConfig } from '../config.js';
import { esc, toast, occupato } from '../ui.js';
import { bus } from '../stato.js';
import { logoApp, introduzione } from './info.js';

let mailInviataA = null;

// ------------------------------------------------------------------
// Configurazione (mostrata solo se config.js e' vuoto)
// ------------------------------------------------------------------

export function renderConfig() {
  return `
    <div class="hero">
      <div class="logo">☘</div>
      <h1>Fanta Montelago</h1>
      <p class="muted">Prima accensione: collega il tuo progetto Supabase.</p>
    </div>
    <div class="card">
      <div class="field">
        <label for="cfgUrl">Project URL</label>
        <input id="cfgUrl" placeholder="https://xxxxxxxx.supabase.co" autocapitalize="off" spellcheck="false">
      </div>
      <div class="field">
        <label for="cfgKey">Chiave anon public</label>
        <textarea id="cfgKey" rows="3" placeholder="eyJhbGciOi..." autocapitalize="off" spellcheck="false"></textarea>
      </div>
      <button class="primary block" data-act="salva-config">Collega</button>
      <p class="muted mt">
        Li trovi su supabase.com nel tuo progetto, in <b>Settings › API</b>.
        Restano salvati solo su questo dispositivo.
      </p>
    </div>`;
}

// ------------------------------------------------------------------
// Accesso
// ------------------------------------------------------------------

export function renderLogin() {
  if (mailInviataA) {
    return `
      <div class="hero">
        <div class="logo">✉</div>
        <h1>Controlla la posta</h1>
        <p class="muted">
          Ho mandato un codice a <b>${esc(mailInviataA)}</b>.
        </p>
      </div>

      <div class="card">
        <div class="field">
          <label for="codiceAccesso">Codice ricevuto</label>
          <input id="codiceAccesso" inputmode="numeric" autocomplete="one-time-code"
                 maxlength="8" placeholder="000000"
                 style="text-align:center;letter-spacing:.3em;font-size:1.6rem">
        </div>
        <button class="primary block" data-act="verifica-codice">Entra</button>
        <p class="muted mt">
          Nella stessa mail c'è anche un link, ma <b>conviene digitare il codice
          qui</b>: toccando il link dall'app della posta si apre spesso un
          browser diverso da questo, e l'accesso finisce lì invece che qui.
        </p>
      </div>

      <div class="card">
        <p class="muted">Non arriva? Guarda nello spam, poi riprova fra qualche minuto.</p>
        <button class="block ghost" data-act="cambia-email">Usa un altro indirizzo</button>
      </div>`;
  }

  return `
    <div class="hero">
      ${logoApp()}
      <p class="muted">Il fantagioco del tuo accampamento.</p>
    </div>
    <div class="card">
      <div class="field">
        <label for="email">La tua email</label>
        <input id="email" type="email" inputmode="email" autocomplete="email"
               placeholder="nome@esempio.it" autocapitalize="off" spellcheck="false">
      </div>
      <div class="field">
        <label for="nomeUtente">Come ti chiami</label>
        <input id="nomeUtente" placeholder="es. Daniele" autocomplete="given-name">
      </div>
      <button class="primary block" data-act="magic-link">Ricevi il link di accesso</button>
      <p class="muted mt">
        Niente password: ti arriva una mail con un link che ti fa entrare.
      </p>
    </div>
    ${introduzione()}
    ${scappatoia()}`;
}

/**
 * Via d'uscita se le credenziali salvate sono sbagliate: senza di questa
 * l'unico modo per correggerle sarebbe svuotare a mano la memoria del browser.
 */
function scappatoia() {
  return `
    <div class="card">
      <button class="block ghost" data-act="reset-config">Cambia progetto Supabase</button>
      <p class="muted mt">Usalo se hai incollato le credenziali sbagliate.</p>
    </div>`;
}

const val = (id) => (document.getElementById(id)?.value || '').trim();

/**
 * Riconosce la chiave segreta di Supabase, che scavalca ogni regola di
 * sicurezza e non deve mai finire in un browser. Copiarla al posto di quella
 * pubblica e' l'errore piu' facile da commettere, perche' sulla stessa pagina
 * le due chiavi si somigliano.
 */
function chiaveSegreta(chiave) {
  if (/^sb_secret_/.test(chiave)) return true;
  const parti = chiave.split('.');
  if (parti.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parti[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

export const azioni = {
  async 'salva-config'() {
    const url = val('cfgUrl');
    const key = val('cfgKey');
    if (!url || !key) return toast('Servono sia URL sia chiave', 'error');
    // Accetta anche i domini personalizzati, ma pretende https: su http il
    // browser bloccherebbe comunque le chiamate da una pagina sicura.
    try {
      if (new URL(url).protocol !== 'https:') throw new Error();
    } catch {
      return toast('URL non valido: deve iniziare con https://', 'error');
    }
    if (chiaveSegreta(key)) {
      return toast('Questa è la chiave SEGRETA: serve quella pubblica (anon)', 'error');
    }
    salvaConfig(url, key);
    // Il client Supabase si costruisce al primo uso leggendo la config: un
    // reload garantisce che nessun modulo tenga ancora quella vecchia.
    window.location.reload();
  },

  async 'magic-link'() {
    const email = val('email');
    const nome = val('nomeUtente');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return toast('Controlla l\'indirizzo email', 'error');
    }
    occupato(true, 'Invio in corso...');
    try {
      await api.inviaMagicLink(email, nome);
      mailInviataA = email;
      bus.disegna();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      occupato(false);
    }
  },

  async 'verifica-codice'() {
    const codice = val('codiceAccesso');
    if (codice.length < 6) return toast('Il codice ha sei cifre', 'error');

    occupato(true, 'Verifico...');
    try {
      await api.verificaCodice(mailInviataA, codice);
      mailInviataA = null;
      // Il cambio di sessione fa ridisegnare tutto da solo, tramite app.js.
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      occupato(false);
    }
  },

  'cambia-email'() {
    mailInviataA = null;
    bus.disegna();
  },

  'reset-config'() {
    dimenticaConfig();
    window.location.reload();
  },
};
