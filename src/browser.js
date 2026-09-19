// Rendu de la page d'impression RaceFacer en PDF via Chromium headless.
// On NE reconstruit PAS la feuille : Chromium ouvre la vraie page RaceFacer
// (authentifiee par le cookie) et on capture son PDF tel quel.
import puppeteer from "puppeteer-core";
import { config } from "./config.js";
import { findChrome } from "./chrome.js";
import { cookieHeaderToArray } from "./racefacer.js";

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    const executablePath = findChrome();
    browserPromise = puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) {
    try {
      const b = await browserPromise;
      await b.close();
    } catch {
      /* ignore */
    }
    browserPromise = null;
  }
}

// Ouvre `printUrl` avec le cookie de session et ecrit le PDF dans `outPath`.
export async function renderPrintUrlToPdf(printUrl, outPath) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const cookies = cookieHeaderToArray(config.cookie, config.baseUrl);
    if (cookies.length) await page.setCookie(...cookies);

    const resp = await page.goto(printUrl, { waitUntil: "networkidle2", timeout: 45000 });
    if (resp && (resp.status() === 401 || resp.status() === 403)) {
      throw new Error(`Auth refusee (${resp.status()}) sur la page d'impression (cookie expire ?).`);
    }
    // Laisse le temps aux scripts RaceFacer de peupler la matrice tour-par-tour.
    await new Promise((r) => setTimeout(r, 1200));

    await page.pdf({
      path: outPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "10mm", bottom: "10mm", left: "8mm", right: "8mm" },
    });
    return outPath;
  } finally {
    await page.close().catch(() => {});
  }
}
