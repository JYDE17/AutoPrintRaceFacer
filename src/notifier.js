// Agent de notification a lancer sur CHAQUE autre POS.
// Se connecte au serveur de POS4 (POS4_URL) et affiche un toast Windows 11
// pour chaque alerte recue. Se reconnecte tout seul si la connexion tombe.
import http from "node:http";
import { config } from "./config.js";
import { showToast } from "./alerts/notify.js";

function log(...a) {
  console.log(new Date().toLocaleTimeString("fr-CA", { hour12: false }), ...a);
}

if (!config.pos4Url) {
  console.error(
    "POS4_URL manquant. Mets dans .env l'URL du serveur de POS4, " +
      "ex. POS4_URL=http://192.168.1.50:8787",
  );
  process.exit(1);
}

const seen = new Set();

function handleEvent(dataStr) {
  let a;
  try {
    a = JSON.parse(dataStr);
  } catch {
    return;
  }
  if (a.id && seen.has(a.id)) return;
  if (a.id) seen.add(a.id);
  log(`notif recue : ${a.title} — ${a.body}`);
  showToast(a.title || "Alerte", a.body || "");
}

function connect() {
  const url = new URL(config.pos4Url + "/events");
  const req = http.get(
    { hostname: url.hostname, port: url.port, path: url.pathname, headers: { Accept: "text/event-stream" } },
    (res) => {
      if (res.statusCode !== 200) {
        log(`connexion refusee (${res.statusCode}), nouvelle tentative dans 5s...`);
        res.resume();
        return setTimeout(connect, 5000);
      }
      log(`connecte a POS4 (${config.pos4Url}). En attente des alertes...`);
      res.setEncoding("utf8");
      let buf = "";
      res.on("data", (chunk) => {
        buf += chunk;
        let idx;
        // Les evenements SSE sont separes par une ligne vide.
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          for (const line of raw.split("\n")) {
            if (line.startsWith("data:")) handleEvent(line.slice(5).trim());
          }
        }
      });
      res.on("end", () => {
        log("connexion fermee, reconnexion dans 5s...");
        setTimeout(connect, 5000);
      });
    },
  );
  req.on("error", (e) => {
    log(`POS4 injoignable (${e.message}), nouvelle tentative dans 5s...`);
    setTimeout(connect, 5000);
  });
}

log(`Agent notifier demarre. Serveur POS4 : ${config.pos4Url}`);
connect();
