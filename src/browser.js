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

    // Marges : "default" reproduit les marges par defaut de Chrome (~10mm),
    // avec un peu plus en haut/bas quand l'en-tete/pied de page est actif.
    let margin;
    if (config.printMargin === "default" || config.printMargin === "") {
      margin = config.headerFooter
        ? { top: "14mm", bottom: "14mm", left: "10mm", right: "10mm" }
        : { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" };
    } else if (config.printMargin === "none" || config.printMargin === "0") {
      margin = { top: "0", bottom: "0", left: "0", right: "0" };
    } else {
      const m = config.printMargin;
      margin = { top: m, bottom: m, left: m, right: m };
    }

    // En-tete / pied de page facon Chrome (date + titre en haut, URL + pagination en bas).
    const headerTemplate =
      `<div style="font-size:9px;width:100%;padding:0 10mm;` +
      `display:flex;justify-content:space-between;color:#666;">` +
      `<span class="date"></span><span class="title"></span></div>`;
    const footerTemplate =
      `<div style="font-size:9px;width:100%;padding:0 10mm;` +
      `display:flex;justify-content:space-between;color:#666;">` +
      `<span class="url"></span>` +
      `<span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`;

    await page.pdf({
      path: outPath,
      format: config.paperSize, // "Letter" par defaut (comme demande)
      landscape: false,
      printBackground: config.printBackground,
      scale: config.printScale,
      displayHeaderFooter: config.headerFooter,
      headerTemplate: config.headerFooter ? headerTemplate : "",
      footerTemplate: config.headerFooter ? footerTemplate : "",
      margin,
    });
    return outPath;
  } finally {
    await page.close().catch(() => {});
  }
}
