// Diagnostic : montre ce que le service voit dans le calendrier du jour
// (auth + fetch + detection), sans rien imprimer par defaut.
//   node src/test-detect.js            -> liste les courses (dry-run)
//   node src/test-detect.js --print    -> imprime EN PLUS la derniere course finie
import path from "node:path";
import fs from "node:fs";
import { config, validateConfig } from "./config.js";
import {
  getSchedule,
  getRaceHeat,
  isRaceHeat,
  isFinished,
  buildPrintUrl,
  todayLocal,
} from "./racefacer.js";
import { renderPrintUrlToPdf, closeBrowser } from "./browser.js";
import { printPdf } from "./printer.js";

const DO_PRINT = process.argv.includes("--print");

async function main() {
  const problems = validateConfig({ needPrintUrl: DO_PRINT });
  if (problems.length) {
    console.error("Configuration incomplete :\n - " + problems.join("\n - "));
    process.exit(1);
  }

  const date = config.date === "today" || !config.date ? todayLocal() : config.date;
  console.log(`Calendrier du ${date} (piste ${config.subTrackId})...`);
  const schedule = await getSchedule(date);

  const heats = schedule.filter((r) => isRaceHeat(r));
  const finished = heats.filter((r) => isFinished(r));
  const sessions = schedule.filter((r) => r.type === "session");

  console.log(`\n${schedule.length} entrees au total :`);
  console.log(`  - ${sessions.length} session(s) libre(s)  (ignorees)`);
  console.log(`  - ${heats.length} race_heat  dont ${finished.length} terminee(s)\n`);

  if (heats.length) {
    console.log("Courses (race_heat) :");
    for (const h of heats) {
      const flag = isFinished(h) ? "TERMINEE" : (h.status || "?").toUpperCase();
      console.log(`  [${flag}] ${h.label}  (${h.race_label || ""})  uuid=${h.uuid}`);
    }
  }

  if (DO_PRINT) {
    if (!finished.length) {
      console.log("\nAucune course terminee a imprimer.");
    } else {
      const last = finished[finished.length - 1];
      console.log(`\nImpression de la derniere course terminee : ${last.label}`);
      const sd = await getRaceHeat(last.uuid);
      const printUrl = buildPrintUrl(sd, last.uuid);
      fs.mkdirSync(config.outputDir, { recursive: true });
      const out = path.join(config.outputDir, "diagnostic.pdf");
      await renderPrintUrlToPdf(printUrl, out);
      const res = await printPdf(out);
      console.log(res.printed ? `Imprime (${res.mode}) : ${out}` : `PDF genere : ${out}`);
    }
  } else {
    console.log("\n(Aucune impression. Ajoute --print pour imprimer la derniere course finie.)");
  }

  await closeBrowser();
}

main().catch(async (e) => {
  console.error("Erreur:", e.message);
  await closeBrowser();
  process.exit(1);
});
