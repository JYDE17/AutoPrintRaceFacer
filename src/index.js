// AutoPrint RaceFacer - service headless.
// Poll le calendrier RaceFacer et imprime automatiquement la feuille de
// resultats (la vraie page RaceFacer, rendue en PDF) de chaque race_heat des
// qu'elle est terminee. Ignore totalement les "session" libres.
import fs from "node:fs";
import path from "node:path";
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
import { loadState, alreadyPrinted, markPrinted } from "./store.js";

const ONCE = process.argv.includes("--once");

// Niveau de log : "error" (defaut) = seulement les erreurs (peu d'ecriture disque).
//                 "info"           = erreurs + impressions + veille + demarrage.
const INFO = config.logLevel === "info" || config.logLevel === "debug";

function stamp() {
  return new Date().toLocaleTimeString("fr-CA", { hour12: false });
}
// Toujours ecrit (erreurs).
function logErr(...a) {
  console.log(stamp(), ...a);
}
// Ecrit seulement en LOG_LEVEL=info.
function log(...a) {
  if (INFO) console.log(stamp(), ...a);
}

function matchFilters(row, sd) {
  if (config.raceLabelMatch) {
    const re = new RegExp(config.raceLabelMatch, "i");
    if (!re.test(row.race_label || sd?.race_label || "")) return false;
  }
  if (config.stageMatch) {
    const re = new RegExp(config.stageMatch, "i");
    if (!re.test(sd?.stage_label || "")) return false;
  }
  return true;
}

function safeName(sd, uuid) {
  const base = [sd?.race_label, sd?.stage_label, sd?.race_heat_label]
    .filter(Boolean)
    .join(" - ")
    .replace(/[^\w\-. ]+/g, "_")
    .slice(0, 80);
  return `${base || "heat"}_${uuid.slice(0, 8)}.pdf`;
}

// Traite une manche terminee : rend le PDF et imprime (une seule fois).
async function handleHeat(row) {
  const uuid = row.uuid;
  if (!uuid || alreadyPrinted(uuid)) return;

  const sd = await getRaceHeat(uuid);
  if (!sd) {
    log(`[skip] detail introuvable pour ${uuid}`);
    return;
  }
  if (config.requireConfirmed && sd.is_results_confirmed === false) {
    log(`[wait] resultats pas encore confirmes : ${sd.label || uuid}`);
    return;
  }
  if (!matchFilters(row, sd)) {
    markPrinted(uuid, { skipped: "filtre" }); // ne pas re-tester en boucle
    log(`[filtre] ignore : ${sd.label || uuid}`);
    return;
  }

  const printUrl = buildPrintUrl(sd, uuid);
  if (!printUrl) throw new Error("RF_PRINT_URL non configure : impossible de rendre la feuille.");

  fs.mkdirSync(config.outputDir, { recursive: true });
  const outPath = path.join(config.outputDir, safeName(sd, uuid));

  log(`[print] ${sd.label || uuid}  ->  ${printUrl}`);
  await renderPrintUrlToPdf(printUrl, outPath);

  const res = await printPdf(outPath);
  markPrinted(uuid, { label: sd.label, file: outPath, mode: res.mode });
  log(`[ok] ${res.printed ? `imprime (${res.mode})` : "PDF genere (mode none)"} : ${outPath}`);
}

let firstTick = true;
let lastBeat = 0;

async function tick() {
  const date = config.date === "today" || !config.date ? todayLocal() : config.date;
  const schedule = await getSchedule(date);
  const allHeats = schedule.filter((r) => isRaceHeat(r));
  const heats = allHeats.filter((r) => isFinished(r));

  // Battement de coeur : confirme que la lecture du calendrier fonctionne,
  // sans noyer le log (une ligne toutes les HEARTBEAT_SECONDS).
  if (config.heartbeatSeconds > 0 && !firstTick) {
    const now = Date.now();
    if (now - lastBeat >= config.heartbeatSeconds * 1000) {
      lastBeat = now;
      const inProgress = allHeats.filter((r) => !isFinished(r)).length;
      log(
        `[veille] lecture OK — ${allHeats.length} course(s), ${heats.length} terminee(s), ` +
          `${inProgress} a venir/en cours. En attente des prochaines fins.`,
      );
    }
  }

  // Au demarrage : les courses DEJA terminees sont du backlog. On les memorise
  // sans les imprimer, pour n'imprimer ensuite QUE celles qui viennent de finir
  // pendant que le service tourne. (Desactivable avec PRINT_BACKLOG_ON_START=true.)
  if (firstTick && !config.printBacklogOnStart) {
    firstTick = false;
    let seeded = 0;
    for (const row of heats) {
      if (row.uuid && !alreadyPrinted(row.uuid)) {
        markPrinted(row.uuid, { skipped: "backlog-demarrage", label: row.label });
        seeded++;
      }
    }
    log(
      `Demarrage : ${heats.length} course(s) deja terminee(s) memorisee(s) sans impression ` +
        `(${seeded} nouvelle(s)). J'imprimerai les prochaines des qu'elles finiront.`,
    );
    return;
  }
  firstTick = false;

  for (const row of heats) {
    try {
      await handleHeat(row);
    } catch (e) {
      logErr(`[err] heat ${row.uuid}: ${e.message}`);
    }
  }
}

async function main() {
  const problems = validateConfig();
  if (problems.length) {
    console.error("Configuration incomplete :\n - " + problems.join("\n - "));
    process.exit(1);
  }
  loadState();
  log(
    `AutoPrint RaceFacer demarre. Piste=${config.subTrackId}, ` +
      `poll=${config.pollIntervalSeconds}s, mode impression=${config.printMode}` +
      (ONCE ? " (un seul passage)" : ""),
  );

  const shutdown = async () => {
    await closeBrowser();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  if (ONCE) {
    await tick();
    await closeBrowser();
    return;
  }
  // Boucle infinie.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await tick();
    } catch (e) {
      logErr(`[err] tick: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, config.pollIntervalSeconds * 1000));
  }
}

main().catch((e) => {
  console.error("Erreur fatale:", e);
  process.exit(1);
});
