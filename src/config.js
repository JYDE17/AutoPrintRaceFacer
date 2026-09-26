// Chargement de la configuration depuis l'environnement (+ .env optionnel).
// Zero dependance pour la config : petit parseur .env maison.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadDotEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  const txt = fs.readFileSync(envPath, "utf8");
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv();

const env = process.env;
const bool = (v, def) => (v === undefined || v === "" ? def : /^(1|true|yes|on)$/i.test(v));
const num = (v, def) => (v === undefined || v === "" ? def : Number(v));
const str = (v, def = "") => (v === undefined ? def : v);

function resolveMaybe(p) {
  if (!p) return "";
  return path.isAbsolute(p) ? p : path.resolve(ROOT, p);
}

export const config = {
  root: ROOT,
  baseUrl: str(env.RF_BASE_URL, "https://racefacer.brossard.goplex.ca").replace(/\/+$/, ""),
  subTrackId: str(env.RF_SUB_TRACK_ID, "1"),
  cookie: str(env.RF_COOKIE, ""),
  printUrl: str(env.RF_PRINT_URL, ""),
  // Identifiants RaceFacer pour l'auto-login (comme le repo lasertag).
  username: str(env.RF_USERNAME, ""),
  password: str(env.RF_PASSWORD, ""),
  // Profil Chrome persistant ou la session RaceFacer est conservee.
  profileDir: resolveMaybe(str(env.CHROME_PROFILE_DIR, "./.chrome-profile")),

  // Filtre des courses a imprimer.
  raceLabelMatch: str(env.RF_RACE_LABEL_MATCH, ""),
  stageMatch: str(env.RF_STAGE_MATCH, ""),
  requireConfirmed: bool(env.RF_REQUIRE_CONFIRMED, true),

  // Boucle.
  pollIntervalSeconds: num(env.POLL_INTERVAL_SECONDS, 20),
  date: str(env.RF_DATE, "today"),
  // Au demarrage, imprimer aussi les courses deja terminees (backlog) ?
  // false (defaut) = n'imprime que les heats qui finissent pendant le run.
  printBacklogOnStart: bool(env.PRINT_BACKLOG_ON_START, false),
  // Intervalle du message "veille OK" dans les logs (secondes). 0 = desactive.
  heartbeatSeconds: num(env.HEARTBEAT_SECONDS, 300),
  // Niveau de log : "error" (defaut, seulement les erreurs) ou "info".
  logLevel: str(env.LOG_LEVEL, "error").toLowerCase(),

  // --- Notifications vers les autres POS ---
  // Sur POS4 : demarre le serveur de notifications integre au service.
  alertServerEnabled: bool(env.ALERT_SERVER_ENABLED, true),
  alertServerPort: num(env.ALERT_SERVER_PORT, 8787),
  // Envoyer une notif "resultats prets" a chaque impression.
  notifyOnPrint: bool(env.NOTIFY_ON_PRINT, true),
  // Sur les autres POS (agent notifier) et pour la commande `alert` :
  // URL du serveur de POS4, ex. http://192.168.1.50:8787
  pos4Url: str(env.POS4_URL, "").replace(/\/+$/, ""),
  // Nom affiche dans les toasts.
  appName: str(env.APP_NAME, "Goplex - Resultats"),
  // Duree d'affichage du toast : "court" (~5s), "long" (~25s) ou
  // "persistant" (reste a l'ecran jusqu'a ce qu'on clique Fermer).
  toastDuration: str(env.TOAST_DURATION, "long").toLowerCase(),

  // Chromium / impression.
  chromePath: str(env.CHROME_PATH, ""),
  paperSize: str(env.PAPER_SIZE, "Letter"),
  printBackground: bool(env.PRINT_BACKGROUND, true),
  headerFooter: bool(env.PRINT_HEADER_FOOTER, true),
  printMargin: str(env.PRINT_MARGIN, "default"),
  printScale: num(env.PRINT_SCALE, 1),
  printMode: str(env.PRINT_MODE, "auto").toLowerCase(),
  printerName: str(env.PRINTER_NAME, ""),
  sumatraPath: str(env.SUMATRA_PATH, ""),
  printCommand: str(env.PRINT_COMMAND, ""),
  printCopies: Math.max(1, num(env.PRINT_COPIES, 1)),
  outputDir: resolveMaybe(str(env.OUTPUT_DIR, "./output")),

  // Etat.
  stateFile: resolveMaybe(str(env.STATE_FILE, "./state/printed.json")),
};

export function validateConfig({ needPrintUrl = true } = {}) {
  const problems = [];
  if (!config.baseUrl) problems.push("RF_BASE_URL est vide.");
  // L'auth se fait via le profil Chrome (npm run login), pas via un cookie.
  if (needPrintUrl && !config.printUrl) {
    problems.push(
      "RF_PRINT_URL est vide : c'est l'URL de la feuille de resultats RaceFacer a imprimer. " +
        "Lance `npm run discover` pour la trouver, puis colle-la dans .env.",
    );
  }
  return problems;
}
