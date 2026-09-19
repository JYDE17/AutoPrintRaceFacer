// Detection de l'executable Chrome / Chromium / Edge selon l'OS.
import fs from "node:fs";
import { config } from "./config.js";

const CANDIDATES = {
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ],
  linux: [
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ],
};

export function findChrome() {
  if (config.chromePath) {
    if (fs.existsSync(config.chromePath)) return config.chromePath;
    throw new Error(`CHROME_PATH pointe vers un fichier inexistant : ${config.chromePath}`);
  }
  const list = CANDIDATES[process.platform] || CANDIDATES.linux;
  for (const p of list) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  throw new Error(
    "Aucun Chrome/Chromium/Edge trouve. Installe Chrome, ou renseigne CHROME_PATH dans .env.",
  );
}
