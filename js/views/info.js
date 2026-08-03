// Nome:     info.js
// Versione: 1.1
// Uso:      Testi e marchi di presentazione dell'app: logo, introduzione per
//           chi non ha ancora fatto l'accesso, avviso sul funzionamento con
//           connessione e crediti della Compagnia di Sotto Monte.
// Autore:   Daniele Polucci

const INSTAGRAM_COMPAGNIA = 'https://www.instagram.com/compagnia_di_sotto_monte/';
const INSTAGRAM_AUTORE = 'https://www.instagram.com/madstoryteller11/';
const CONTATTO = 'compagniasottomonte@gmail.com';
const KOFI = 'https://ko-fi.com/compagniadisottomonte';

/** Logo dell'app: il mago di Fanta Montelago, su fondo trasparente. */
export function logoApp() {
  return `<img class="logo-app" src="assets/logo-app.png"
               alt="Fanta Montelago" width="340" height="373">`;
}

/** Stemma della Compagnia, schiarito per il tema scuro. */
export function stemma(classe = 'stemma') {
  return `<img class="${classe}" src="assets/logo-compagnia.svg"
               alt="La Compagnia di Sotto Monte" width="2160" height="2160">`;
}

/**
 * Il festival e' una manifestazione vera, con un nome che non e' nostro: va
 * detto chiaramente e in piu' punti che questo gioco non c'entra niente con
 * chi lo organizza.
 */
export function nonUfficiale() {
  return `
    <div class="card avviso">
      <h3>⚠️ Non è l'app ufficiale</h3>
      <p>
        Fanta Montelago è un <b>progetto amatoriale, fatto dai fan per i fan</b>.
        Non ha alcun legame con l'organizzazione del Montelago Celtic Festival,
        che non c'entra niente con questo gioco e non ne è in alcun modo
        responsabile.
      </p>
      <p class="muted">
        Il nome del festival appartiene ai suoi legittimi proprietari: qui è
        citato solo per dire di cosa stiamo parlando.
      </p>
    </div>`;
}

/** Riga breve, ripetuta in fondo a ogni schermata dell'app. */
export function piePagina() {
  return `
    <p class="non-ufficiale">
      Progetto amatoriale dei fan, senza alcun legame con l'organizzazione del
      Montelago Celtic Festival.
    </p>`;
}

/**
 * I cinque passaggi per installare l'app da Chrome, ricavati dalla
 * registrazione fatta al telefono. Le immagini stanno dentro un pannello
 * chiuso: cosi' le scarica solo chi lo apre, e non pesano su tutti gli altri.
 */
const PASSI_INSTALLAZIONE = [
  {
    figura: '1-apri.jpg',
    titolo: 'Apri il sito in Chrome',
    testo: 'Poi tocca i <b>tre puntini</b> in alto a destra.',
  },
  {
    figura: '2-menu.jpg',
    titolo: 'Scendi fino a «Installa e crea scorciatoia»',
    testo: 'Il menu è più lungo dello schermo: la voce non si vede subito, '
         + 'bisogna scorrerlo. Su qualche telefono è scritta di poco diversa.',
  },
  {
    figura: '3-installa.jpg',
    titolo: 'Scegli «Installa»',
    testo: '<b>Non «Crea scorciatoia»</b>: quella si aprirebbe comunque dentro '
         + 'Chrome, con la barra dell\'indirizzo e senza funzionare offline.',
  },
  {
    figura: '4-conferma.jpg',
    titolo: 'Conferma',
    testo: 'Tocca <b>Installa</b> nella finestrella che compare. '
         + 'L\'icona finisce fra le tue app, e da lì si apre a schermo intero '
         + 'e <b>anche senza campo</b>.',
  },
];

export function guidaInstallazione() {
  return `
    <details class="card">
      <summary class="tasto">📱 Come installare l'app da Chrome</summary>
      <div class="sep"></div>
      <p class="muted">
        Installandola hai l'icona fra le applicazioni, niente barra del browser
        e l'apertura anche senza connessione — che a Montelago non è poco.
      </p>
      ${PASSI_INSTALLAZIONE.map((p, i) => `
        <div class="passo-installa">
          <div class="riga">
            <span class="n">${i + 1}</span>
            <span class="grow">
              <b>${p.titolo}</b>
              <div class="muted">${p.testo}</div>
            </span>
          </div>
          <img src="assets/installa/${p.figura}" alt="${p.titolo}"
               loading="lazy" width="432" height="960">
        </div>`).join('')}
    </details>`;
}

/** Presentazione, avvertenza sulla connessione e crediti. */
export function introduzione() {
  return `
    <div class="card">
      <h3>Cos'è</h3>
      <p>
        Il fantagioco del Montelago Celtic Festival è qui! Crea il tuo
        accampamento/clan ed entra con un codice, e per tutto il festival ognuno
        si porta a casa bonus e malus: chi non trova la sua tenda, chi finisce
        nella cloaca ubriaco, chi regge fino all'alba e chi vomita anche l'anima.
        Tutto può essere registrato, anche regole personalizzate!
      </p>
      <p>
        Un arbitro tiene il banco e assegna i punti, gli altri segnalano quello
        che vedono con tanto di foto-prova. Alla fine del festival la classifica
        dice come sono andate davvero le cose, e il diario le racconta giornata
        per giornata.
      </p>
      <a class="link-guida" href="guida.html">📖 Guida: come si gioca</a>
    </div>

    ${guidaInstallazione()}

    ${nonUfficiale()}

    <div class="card avviso">
      <h3>📶 Serve internet</h3>
      <p>
        L'app funziona solo con la connessione, purtroppo, e a Montelago spesso
        non prende. Fa niente: resta <b>attiva fino a fine agosto</b>, così c'è
        tutto il tempo di compilarla con calma con le gesta dei Montelaghisti.
        Segnate quando vi torna la linea, o anche una volta tornati a casa.
      </p>
    </div>

    ${crediti()}`;
}

/** Crediti, avvertenze e contatti: in fondo alle schermate pubbliche. */
export function crediti() {
  return `
    <div class="card crediti">
      ${stemma('stemma piccolo')}
      <p class="firma">
        Creata da <b>MadStoryteller11</b><br>per <b>La Compagnia di Sotto Monte</b>
      </p>

      <a class="link-guida" href="guida.html">📖 Guida: come si gioca</a>

      <div class="social">
        <a href="${INSTAGRAM_COMPAGNIA}" target="_blank" rel="noopener noreferrer">
          La Compagnia di Sotto Monte
        </a>
        <a href="${INSTAGRAM_AUTORE}" target="_blank" rel="noopener noreferrer">
          MadStoryteller11
        </a>
      </div>

      <div class="sep"></div>

      <a class="dona" href="${KOFI}" target="_blank" rel="noopener noreferrer">
        🍺 Offri una birra alla Compagnia
      </a>
      <p class="muted centrato">
        Le donazioni sostengono la Compagnia e lo sviluppo dell'app.
        Nessun obbligo, ci mancherebbe.
      </p>

      <div class="sep"></div>

      <p class="muted">
        Questa app è <b>gratuita</b> ed è nata per passione e per divertimento,
        nel tempo libero e senza nessuna azienda dietro. Proprio per questo può
        capitare che qualcosa non funzioni come dovrebbe: se succede, portate
        pazienza.
      </p>
      <p class="muted">
        È un <b>progetto amatoriale, fatto dai fan per i fan</b>: non è l'app
        ufficiale del Montelago Celtic Festival e non ha alcun legame con chi
        lo organizza.
      </p>
      <p class="muted">
        Se il gioco vi piace e vi piacerebbe vederlo crescere, scrivete a
        <a href="mailto:${CONTATTO}">${CONTATTO}</a>.
      </p>
    </div>`;
}
