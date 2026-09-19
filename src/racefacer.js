// Client RaceFacer : reprend le meme mecanisme de "fetch avec auth" que le
// repo Goplex-Lasertag (un wrapper api() unique + headers), mais cote serveur
// et sur les endpoints /ajax/session-management/... de RaceFacer.
import { config } from "./config.js";

// Headers repris du HAR d'une requete ajax reelle de la console RaceFacer.
function baseHeaders() {
  return {
    Accept: "application/json, text/plain, */*",
    "X-Requested-With": "XMLHttpRequest",
    Referer: `${config.baseUrl}/fr/administration/sessions/session-management`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36",
    Cookie: config.cookie,
  };
}

// Wrapper fetch unique (equivalent de api() dans l'autre repo).
async function api(pathAndQuery, opts = {}) {
  const url = `${config.baseUrl}${pathAndQuery}`;
  let res;
  try {
    res = await fetch(url, { ...opts, headers: { ...baseHeaders(), ...(opts.headers || {}) } });
  } catch (e) {
    throw new Error(`Reseau KO sur ${pathAndQuery}: ${e.message}`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `Auth refusee (${res.status}) sur ${pathAndQuery}. Le cookie RF_COOKIE est probablement expire.`,
    );
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${pathAndQuery}`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json")) {
    // Une page HTML de login = session perdue.
    throw new Error(`Reponse non-JSON sur ${pathAndQuery} (cookie expire ?)`);
  }
  return res.json();
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
