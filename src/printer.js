// Envoi d'un PDF a l'imprimante physique, selon l'OS et PRINT_MODE.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

// Cherche SumatraPDF.exe dans SUMATRA_PATH puis les emplacements d'install usuels.
function findSumatra() {
  const cands = [config.sumatraPath];
  const pf = process.env["ProgramFiles"] || "C:\\Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const local = process.env["LOCALAPPDATA"];
  cands.push(path.join(pf, "SumatraPDF", "SumatraPDF.exe"));
  cands.push(path.join(pf86, "SumatraPDF", "SumatraPDF.exe"));
  if (local) {
    cands.push(path.join(local, "SumatraPDF", "SumatraPDF.exe"));
    cands.push(path.join(local, "Programs", "SumatraPDF", "SumatraPDF.exe"));
  }
  for (const c of cands) {
    try {
      if (c && fs.existsSync(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return "";
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} a quitte avec le code ${code}. ${err.trim()}`));
    });
  });
}

// PowerShell : imprime un PDF via l'application associee (verbe Print).
function printWindowsDefault(file) {
  // Start-Process -Verb Print utilise l'imprimante par defaut de Windows.
  const ps = `Start-Process -FilePath '${file.replace(/'/g, "''")}' -Verb Print -WindowStyle Hidden`;
  return run("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps]);
}

// SumatraPDF : impression 100% silencieuse, imprimante nommee ou par defaut.
function printSumatra(file) {
  const exe = findSumatra();
  if (!exe) {
    throw new Error(
      "SumatraPDF introuvable. Installe-le (https://www.sumatrapdfreader.org/) " +
        "ou renseigne SUMATRA_PATH dans .env.",
    );
  }
  const args = [];
  if (config.printerName) args.push("-print-to", config.printerName);
  else args.push("-print-to-default");
  args.push("-silent", file);
  return run(exe, args);
}

// CUPS / lp (Linux, mac).
function printLp(file) {
  const args = [];
  if (config.printerName) args.push("-d", config.printerName);
  if (config.printCopies > 1) args.push("-n", String(config.printCopies));
  args.push(file);
  return run("lp", args);
}

// Commande custom.
function printCommand(file) {
  const tpl = config.printCommand;
  const filled = tpl
    .replace(/\{file\}/g, file)
    .replace(/\{printer\}/g, config.printerName || "");
  const parts = filled.match(/(?:[^\s"]+|"[^"]*")+/g).map((s) => s.replace(/^"|"$/g, ""));
  return run(parts[0], parts.slice(1));
}

// Imprime `file` (PDF) `copies` fois selon le mode configure.
export async function printPdf(file) {
  if (!fs.existsSync(file)) throw new Error(`PDF introuvable : ${file}`);
  let mode = config.printMode;
  if (mode === "auto") {
    if (process.platform === "win32") mode = findSumatra() ? "sumatra" : "windows";
    else mode = "lp";
  }
  if (mode === "none") return { printed: false, mode };

  // lp gere le nombre de copies via -n ; les autres modes bouclent.
  const times = mode === "lp" ? 1 : config.printCopies;
  for (let i = 0; i < times; i++) {
    if (mode === "sumatra") await printSumatra(file);
    else if (mode === "windows") await printWindowsDefault(file);
    else if (mode === "lp") await printLp(file);
    else if (mode === "command") await printCommand(file);
    else throw new Error(`PRINT_MODE inconnu : ${mode}`);
  }
  return { printed: true, mode, copies: config.printCopies };
}
