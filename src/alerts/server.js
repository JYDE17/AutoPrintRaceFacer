// Serveur de notifications (sur POS4). Integre au service principal.
// Les autres POS s'y connectent en SSE (/events) et recoivent chaque alerte
// en temps reel. On peut aussi POSTer une alerte custom sur /alert.
import http from "node:http";

let clients = [];

function randomId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

// Diffuse une alerte a tous les POS connectes.
export function broadcastAlert(alert) {
  const payload = JSON.stringify({
    id: alert.id || randomId(),
    type: alert.type || "info",
    title: alert.title || "Alerte",
    body: alert.body || "",
    at: new Date().toISOString(),
  });
  const frame = `data: ${payload}\n\n`;
  for (const c of clients) {
    try {
      c.write(frame);
    } catch {
      /* ignore */
    }
  }
  return JSON.parse(payload);
}

export function clientCount() {
  return clients.length;
}

export function startAlertServer(port, onLog = () => {}) {
  const server = http.createServer((req, res) => {
    // CORS simple (au cas ou un POS ecoute via une page).
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (req.url === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write("retry: 3000\n\n");
      clients.push(res);
      onLog(`notif: POS connecte (${clients.length} au total)`);
      req.on("close", () => {
        clients = clients.filter((c) => c !== res);
        onLog(`notif: POS deconnecte (${clients.length} restants)`);
      });
      return;
    }

    if (req.url === "/alert" && req.method === "POST") {
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", () => {
        try {
          const a = JSON.parse(body || "{}");
          const sent = broadcastAlert(a);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, delivered: clients.length, alert: sent }));
        } catch {
          res.writeHead(400);
          res.end("bad request");
        }
      });
      return;
    }

    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, clients: clients.length }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.on("error", (e) => onLog(`[err] serveur notif: ${e.message}`));
  server.listen(port, () => onLog(`notif: serveur pret sur le port ${port}`));

  // Keep-alive : commentaire SSE toutes les 25s (evite les coupures).
  setInterval(() => {
    for (const c of clients) {
      try {
        c.write(": ping\n\n");
      } catch {
        /* ignore */
      }
    }
  }, 25000);

  return server;
}
