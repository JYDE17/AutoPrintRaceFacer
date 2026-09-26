// Envoie une alerte custom a TOUS les POS (via le serveur de POS4).
// Usage :
//   node src/send-alert.js "Message"
//   node src/send-alert.js "Titre" "Message"
//   node src/send-alert.js --type=pause "Pause" "Retour dans 15 min"
import http from "node:http";
import { config } from "./config.js";

const args = process.argv.slice(2);
let type = "info";
const rest = [];
for (const a of args) {
  if (a.startsWith("--type=")) type = a.slice(7);
  else rest.push(a);
}
if (!rest.length) {
  console.error('Usage: node src/send-alert.js [--type=xxx] "Titre" "Message"');
  process.exit(1);
}
const title = rest.length > 1 ? rest[0] : "Alerte";
const body = rest.length > 1 ? rest.slice(1).join(" ") : rest[0];

// Par defaut on parle au serveur local (POS4 lui-meme) si POS4_URL absent.
const base = config.pos4Url || `http://127.0.0.1:${config.alertServerPort}`;
const url = new URL(base + "/alert");
const data = JSON.stringify({ type, title, body });

const req = http.request(
  {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
  },
  (res) => {
    let out = "";
    res.on("data", (d) => (out += d));
    res.on("end", () => {
      try {
        const j = JSON.parse(out);
        console.log(`Alerte envoyee a ${j.delivered} POS.`);
      } catch {
        console.log("Reponse:", out);
      }
    });
  },
);
req.on("error", (e) => {
  console.error(`Envoi impossible (${e.message}). Le serveur de POS4 tourne-t-il ? (${base})`);
  process.exit(1);
});
req.write(data);
req.end();
