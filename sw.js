// Nome:     sw.js
// Versione: 1.0
// Uso:      Service worker di Fanta Montelago. Tiene una copia dell'app sul
//           telefono, cosi' si apre anche senza connessione, e la rende
//           installabile come applicazione vera.
// Autore:   Daniele Polucci

// Cambiando questo numero si svuota la copia vecchia. Va alzato quando si
// pubblica una modifica che deve arrivare subito a tutti.
const VERSIONE = 'fanta-montelago-v2';

const GUSCIO = [
  './',
  './index.html',
  './guida.html',
  './manifest.webmanifest',
  './assets/style.css',
  './assets/logo-app.png',
  './assets/logo-compagnia.svg',
  './assets/icona-app-192.png',
  './assets/icona-app-512.png',
  './js/app.js',
  './js/api.js',
  './js/card.js',
  './js/coda.js',
  './js/config.js',
  './js/locale.js',
  './js/stato.js',
  './js/titoli.js',
  './js/ui.js',
  './js/views/accampamenti.js',
  './js/views/auth.js',
  './js/views/classifica.js',
  './js/views/diario.js',
  './js/views/gestione.js',
  './js/views/info.js',
  './js/views/proposte.js',
  './js/views/segna.js',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSIONE)
      // addAll fallirebbe tutto se un solo file mancasse: meglio salvare
      // quello che c'e' e lasciare che il resto arrivi dalla rete.
      .then((cache) => Promise.allSettled(GUSCIO.map((f) => cache.add(f))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomi) => Promise.all(
        nomi.filter((n) => n !== VERSIONE).map((n) => caches.delete(n)),
      ))
      .then(() => self.clients.claim()),
  );
});

/**
 * Rinuncia alla rete dopo qualche secondo.
 *
 * Al festival il campo non e' assente: e' pessimo, che e' peggio. Senza questo
 * limite il browser aspetterebbe anche mezzo minuto prima di arrendersi, e
 * l'app sembrerebbe piantata invece di aprirsi con la copia salvata.
 */
function conScadenza(richiesta, millisecondi) {
  return new Promise((risolvi, rifiuta) => {
    const timer = setTimeout(() => rifiuta(new Error('rete troppo lenta')), millisecondi);
    fetch(richiesta).then(
      (risposta) => { clearTimeout(timer); risolvi(risposta); },
      (errore) => { clearTimeout(timer); rifiuta(errore); },
    );
  });
}

/**
 * Prima la rete, la copia locale solo se la rete non risponde.
 *
 * L'ordine inverso sarebbe piu' veloce ma pericoloso per come lavoriamo: si
 * pubblicano modifiche di continuo, e servire la copia vecchia mescolata a
 * file nuovi rompe l'app. Cosi' invece, finche' c'e' campo si vede sempre
 * l'ultima versione, e quando il campo manca l'app si apre lo stesso.
 */
self.addEventListener('fetch', (evento) => {
  const richiesta = evento.request;
  if (richiesta.method !== 'GET') return;

  const url = new URL(richiesta.url);
  const nostro = url.origin === self.location.origin;
  const libreria = url.hostname === 'esm.sh';

  // Le chiamate a Supabase non si toccano: dati e foto devono essere sempre
  // quelli veri, e una risposta salvata darebbe una classifica falsa.
  if (!nostro && !libreria) return;

  evento.respondWith(
    conScadenza(richiesta, 4000)
      .then((risposta) => {
        if (risposta.ok) {
          const copia = risposta.clone();
          caches.open(VERSIONE).then((cache) => cache.put(richiesta, copia));
        }
        return risposta;
      })
      .catch(() => caches.match(richiesta).then((salvata) => salvata || (
        // Senza rete e senza copia, a una navigazione si risponde con la
        // pagina principale: e' comunque meglio dell'errore del browser.
        richiesta.mode === 'navigate' ? caches.match('./index.html') : undefined
      ))),
  );
});
