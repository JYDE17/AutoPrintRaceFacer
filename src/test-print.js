// Test manuel : rend une feuille et l'imprime, sans attendre le polling.
// Usage :
//   node src/test-print.js <uuid-du-heat>
//   node src/test-print.js https://.../print-heat/xxxx   (URL complete)
import fs from "node:fs";
import path from "node:path";
import { config, validateConfig } from "./config.js";
import { getRaceHeat, buildPrintUrl } from "./racefacer.js";
import { renderPrintUrlToPdf, closeBrowser } from "./browser.js";
import { printPdf } from "./printer.js";

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: node src/test-print.js <uuid-du-heat | url-complete>");
  process.exit(1);
}

async function main() {
  let printUrl;
  let name = "test";
  if (/^https?:\/\//i.test(arg)) {
    printUrl = arg;
  } else {
    const problems = validateConfig();
    if (problems.length) {
      console.error("Configuration incomplete :\n - " + problems.join("\n - "));
      process.exit(1);
    }
    const sd = await getRaceHeat(arg);
    if (!sd) throw new Error(`Aucun detail pour l'uuid ${arg}`);
    printUrl = buildPrintUrl(sd, arg);
    name = (sd.label || arg).replace(/[^\w\-. ]+/g, "_").slice(0, 60);
    console.log("Feuille :", sd.label, "| URL :", printUrl);
  }

  fs.mkdirSync(config.outputDir, { recursive: true });
  const out = path.join(config.outputDir, `${name}.pdf`);
  await renderPrintUrlToPdf(printUrl, out);
  console.log("PDF genere :", out);
  const res = await printPdf(out);
  console.log(res.printed ? `Imprime (${res.mode}).` : "Mode 'none' : PDF non imprime.");
  await closeBrowser();
}

main().catch(async (e) => {
  console.error("Erreur:", e.message);
  await closeBrowser();
  process.exit(1);
});
