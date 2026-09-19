// Client RaceFacer : meme idee que le repo Goplex-Lasertag (un fetch authentifie
// unique), mais l'auth passe par le profil Chrome persistant. Les JSON sont donc
// recuperes DANS le contexte du navigateur connecte (voir browser.fetchJson).
import { config } from "./config.js";
import { fetchJson } from "./browser.js";

// Wrapper unique (equivalent de api() dans l'autre repo).
async function api(pathAndQuery) {
  return fetchJson(pathAndQuery);
}

// Date locale au format YYYY-MM-DD.
export function todayLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Le calendrier du jour : melange de "session" (libres) et "race_heat" (courses).
export async function getSchedule(date) {
  const q = `/ajax/session-management/sessions-schedule?date=${encodeURIComponent(
    date,
  )}&session_sub_track_id=${encodeURIComponent(config.subTrackId)}`;
  const j = await api(q);
  return j?.schedule?.data || [];
}

// Detail complet d'une manche de course (resultats).
export async function getRaceHeat(uuid) {
  const q = `/ajax/session-management/session?type=race_heat&uuid=${encodeURIComponent(
    uuid,
  )}&sub_track_id=${encodeURIComponent(config.subTrackId)}`;
  const j = await api(q);
  return j?.session_data || null;
}

// Detail d'une session libre (non utilise pour l'impression, fourni par symetrie).
export async function getSession(uuid) {
  const q = `/ajax/session-management/session?type=session&uuid=${encodeURIComponent(
    uuid,
  )}&sub_track_id=${encodeURIComponent(config.subTrackId)}`;
  const j = await api(q);
  return j?.session_data || null;
}

// --- Difference session vs race_heat ---------------------------------------
// session   : chrono libre / drop-in. Cle = session_id numerique. Pas de grille,
//             pas de drapeaux, pas de penalites. runs.data[] plat.
// race_heat : manche d'une competition structuree (race_id -> stage -> heat).
//             Grille de depart, green/checkered flag, penalites, DNF/DSQ, points,
//             equipes. race_heat_runs[] avec pos/grid/gap.
// On n'imprime QUE les race_heat.
export function isRaceHeat(row) {
  return row?.type === "race_heat";
}

// Une race_heat est-elle terminee ? (statut cote calendrier)
export function isFinished(row) {
  return String(row?.status || "").toLowerCase() === "finished";
}

// Construit l'URL de la page d'impression a partir du template RF_PRINT_URL et
// des donnees du heat (session_data). Remplace les placeholders {uuid}, etc.
export function buildPrintUrl(sd, rowUuid) {
  const tpl = config.printUrl;
  if (!tpl) return "";
  const vals = {
    uuid: sd?.uuid || rowUuid || "",
    id: sd?.id ?? "", // id numerique du heat, utilise par la page print-results
    race_uuid: sd?.race_uuid || "",
    race_stage_id: sd?.race_stage_id ?? "",
    race_id: sd?.race_id ?? "",
    sub_track_id: sd?.sub_track_id ?? config.subTrackId,
  };
  let url = tpl.replace(/\{(\w+)\}/g, (m, k) => (vals[k] !== undefined ? String(vals[k]) : m));
  if (/^https?:\/\//i.test(url)) return url;
  return `${config.baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

// Transforme la string cookie "a=1; b=2" en tableau d'objets pour Playwright/Chromium.
export function cookieHeaderToArray(cookieStr, baseUrl) {
  const url = new URL(baseUrl);
  const domain = url.hostname;
  const out = [];
  for (const part of String(cookieStr || "").split(";")) {
    const s = part.trim();
    if (!s) continue;
    const eq = s.indexOf("=");
    if (eq === -1) continue;
    out.push({
      name: s.slice(0, eq).trim(),
      value: s.slice(eq + 1).trim(),
      domain,
      path: "/",
    });
  }
  return out;
}
