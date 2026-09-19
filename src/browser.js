// Acces a RaceFacer via un Chromium persistant et authentifie.
// Auth = un profil Chrome (userDataDir) ou tu te connectes UNE fois
// (`npm run login`). Le service reutilise ce profil : plus aucun cookie a copier.
// Tout passe par ce navigateur : le fetch des JSON (schedule/detail) ET le
// rendu de la page d'impression -> les cookies de session partent automatiquement.
import puppeteer from "puppeteer-core";
import { config } from "./config.js";
import { findChrome } from "./chrome.js";

let browserPromise = null;

async function launch(headless) {
  const executablePath = findChrome();
  try {
    return await puppeteer.launch({
      executablePath,
      headless,
      userDataDir: config.profileDir,
      defaultViewport: headless ? { width: 1280, height: 1600 } : null,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
      ].concat(headless ? [] : ["--start-maximized"]),
    });
  } catch (e) {
    // Profil deja ouvert par une autre instance (ex. le service tourne).
    if (/ProcessSingleton|profile appears to be in use|SingletonLock|being used/i.test(e.message)) {
      throw new Error(
        "Le profil Chrome est deja utilise par une autre instance (le service tourne " +
          "probablement). Arrete-le d'abord :  npm run service:stop  (puis relance apres le test).",
      );
    }
    throw e;
  }
}

async function getBrowser() {
  if (!browserPromise) browserPromise = launch(true);
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

function isLoginUrl(u) {
  return /\/auth\/login/i.test(u || "");
}

class NotLoggedIn extends Error {
  constructor() {
    super("NOT_LOGGED_IN");
  }
}

let loginInFlight = null;

// Connexion automatique via RF_USERNAME / RF_PASSWORD sur /fr/auth/login.
async function doLogin() {
  if (!config.username || !config.password) {
    throw new Error(
      "Pas connecte a RaceFacer et RF_USERNAME/RF_PASSWORD absents. " +
        "Renseigne-les dans .env, ou connecte-toi manuellement avec `npm run login`.",
    );
  }
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(`${config.baseUrl}/fr/auth/login`, { waitUntil: "networkidle2", timeout: 45000 });
    if (!isLoginUrl(page.url())) return; // deja connecte (redirige ailleurs)

    // Champs : on essaie les selecteurs les plus probables, avec repli.
    const userSel = await firstSelector(page, [
      'input[name="username"]',
      'input[name="email"]',
      'input[name="login"]',
      'input[type="text"]',
      'input:not([type="password"]):not([type="hidden"]):not([type="checkbox"])',
    ]);
    const passSel = await firstSelector(page, ['input[name="password"]', 'input[type="password"]']);
    if (!userSel || !passSel) throw new Error("Formulaire de login RaceFacer introuvable (selecteurs).");

    await page.type(userSel, config.username, { delay: 15 });
    await page.type(passSel, config.password, { delay: 15 });

    await Promise.all([
      page.keyboard.press("Enter").catch(() => {}),
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 45000 }).catch(() => {}),
    ]);
    // Si le Enter n'a pas suffi, on clique le bouton de soumission.
    if (isLoginUrl(page.url())) {
      const btn = await firstSelector(page, [
        'button[type="submit"]',
        'input[type="submit"]',
        "button",
      ]);
      if (btn) {
        await Promise.all([
          page.click(btn).catch(() => {}),
          page.waitForNavigation({ waitUntil: "networkidle2", timeout: 45000 }).catch(() => {}),
        ]);
      }
    }
    if (isLoginUrl(page.url())) {
      throw new Error("Echec de connexion RaceFacer : verifie RF_USERNAME / RF_PASSWORD.");
    }
  } finally {
    await page.close().catch(() => {});
  }
}

async function firstSelector(page, selectors) {
  for (const sel of selectors) {
    const found = await page.$(sel);
    if (found) return sel;
  }
  return null;
}

// Assure une session valide (login unique, meme si appele en parallele).
async function ensureLoggedIn() {
  if (!loginInFlight) {
    loginInFlight = doLogin().finally(() => {
      loginInFlight = null;
    });
  }
  return loginInFlight;
}

// Execute `fn` ; si NOT_LOGGED_IN, se connecte puis reessaie une fois.
async function withAuth(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NotLoggedIn || e.message === "NOT_LOGGED_IN") {
      await ensureLoggedIn();
      return await fn();
    }
    throw e;
  }
}

// Fetch d'un JSON RaceFacer DANS le contexte authentifie du navigateur.
export async function fetchJson(pathAndQuery) {
  const url = `${config.baseUrl}${pathAndQuery}`;
  return withAuth(async () => {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      const result = await page.evaluate(async (u) => {
        const r = await fetch(u, {
          headers: {
            Accept: "application/json, text/plain, */*",
            "X-Requested-With": "XMLHttpRequest",
          },
          credentials: "include",
        });
        const text = await r.text();
        return { status: r.status, url: r.url, ct: r.headers.get("content-type") || "", text };
      }, url);

      if (isLoginUrl(result.url) || result.status === 401 || result.status === 403) {
        throw new NotLoggedIn();
      }
      if (!result.ct.includes("json")) throw new NotLoggedIn();
      return JSON.parse(result.text);
    } finally {
      await page.close().catch(() => {});
    }
  });
}

// Ouvre la page d'impression RaceFacer (authentifiee) et ecrit le PDF.
export async function renderPrintUrlToPdf(printUrl, outPath) {
  return withAuth(() => doRenderPdf(printUrl, outPath));
}

async function doRenderPdf(printUrl, outPath) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const resp = await page.goto(printUrl, { waitUntil: "networkidle2", timeout: 45000 });
    if (isLoginUrl(page.url()) || (resp && (resp.status() === 401 || resp.status() === 403))) {
      throw new NotLoggedIn();
    }
    // Laisse le temps aux scripts RaceFacer de peupler la matrice tour-par-tour.
    await new Promise((r) => setTimeout(r, 1200));

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
      format: config.paperSize,
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

// Ouvre un navigateur VISIBLE sur la page de login pour se connecter une fois.
export async function openLoginWindow() {
  const browser = await launch(false);
  const [page] = await browser.pages();
  await page.goto(`${config.baseUrl}/fr/auth/login`, { waitUntil: "domcontentloaded" }).catch(() => {});
  return browser;
}
