// Aide a trouver l'URL de la feuille d'impression RaceFacer + le cookie.
// Lance un navigateur VISIBLE. Connecte-toi, va sur une course, clique le bouton
// d'impression UNE fois : ce script affiche l'URL de la page qui s'ouvre (a coller
// dans RF_PRINT_URL) ainsi que le cookie de session (a coller dans RF_COOKIE).
import puppeteer from "puppeteer-core";
import { config } from "./config.js";
import { findChrome } from "./chrome.js";

const HINT = /print|imprim|result|resultat|report|rapport|pdf|heat/i;

function banner(msg) {
  console.log("\n" + "=".repeat(70) + "\n" + msg + "\n" + "=".repeat(70) + "\n");
}

async function dumpCookie(page) {
  try {
    const cookies = await page.cookies();
    if (!cookies.length) return;
    const str = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    banner("COOKIE (colle-le dans RF_COOKIE de ton .env) :");
    console.log(str + "\n");
  } catch {
    /* ignore */
  }
}

async function main() {
  const executablePath = findChrome();
  const startUrl = `${config.baseUrl}/fr/administration/sessions/session-management`;

  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized", "--no-first-run"],
  });

  const seen = new Set();
  const note = (label, url) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    const flag = HINT.test(url) ? "  <<< PROBABLE PAGE D'IMPRESSION" : "";
    console.log(`[${label}] ${url}${flag}`);
  };

  browser.on("targetcreated", async (t) => {
    try {
      if (t.type() === "page") note("nouvelle-fenetre", t.url());
    } catch {
      /* ignore */
    }
  });

  const wire = (page) => {
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame()) note("navigation", f.url());
    });
    page.on("request", (req) => {
      if (req.resourceType() === "document") note("document", req.url());
    });
    page.on("popup", (p) => {
      note("popup", p.url());
      wire(p);
    });
  };

  const [page] = await browser.pages();
  wire(page);
  await page.goto(startUrl, { waitUntil: "domcontentloaded" }).catch(() => {});

  banner(
    "1) Connecte-toi si besoin.\n" +
      "2) Ouvre une COURSE (race_heat) terminee et clique le bouton IMPRIMER.\n" +
      "3) Repere ci-dessous la ligne marquee '<<< PROBABLE PAGE D'IMPRESSION'.\n" +
      "   Remplace l'uuid par {uuid} et colle le resultat dans RF_PRINT_URL.\n" +
      "4) Ferme le navigateur pour terminer (le cookie s'affichera).",
  );

  browser.on("disconnected", async () => {
    process.exit(0);
  });

  // Dump du cookie toutes les 20s (au cas ou tu te connectes maintenant).
  setInterval(() => dumpCookie(page).catch(() => {}), 20000);
}

main().catch((e) => {
  console.error("Erreur:", e.message);
  process.exit(1);
});
