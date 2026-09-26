// Affiche un toast Windows 11 (natif, sans module a installer) via PowerShell.
import { spawn } from "node:child_process";
import { config } from "../config.js";

function xmlEscape(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Script PowerShell : lit le XML du toast dans $env:NOTIF_XML et l'affiche.
const PS = `
$ErrorActionPreference='SilentlyContinue'
[Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime] | Out-Null
[Windows.UI.Notifications.ToastNotification,Windows.UI.Notifications,ContentType=WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument,Windows.Data.Xml.Dom,ContentType=WindowsRuntime] | Out-Null
$doc = [Windows.Data.Xml.Dom.XmlDocument]::new()
$doc.LoadXml($env:NOTIF_XML)
$toast = [Windows.UI.Notifications.ToastNotification]::new($doc)
$appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
`;

export function showToast(title, body) {
  if (process.platform !== "win32") {
    // Hors Windows (tests) : on loggue simplement.
    console.log(`[toast] ${title} — ${body}`);
    return Promise.resolve();
  }
  // Duree d'affichage.
  const d = config.toastDuration;
  let toastAttrs = ' duration="long"';
  let actions = "";
  if (d === "court" || d === "short") {
    toastAttrs = "";
  } else if (d === "persistant" || d === "persistent") {
    // scenario=reminder : le toast reste a l'ecran jusqu'a interaction.
    toastAttrs = ' scenario="reminder"';
    actions =
      "<actions>" +
      '<action content="Fermer" arguments="dismiss" activationType="system"/>' +
      "</actions>";
  }

  const xml =
    `<toast${toastAttrs}><visual><binding template="ToastGeneric">` +
    `<text>${xmlEscape(config.appName)}</text>` +
    `<text>${xmlEscape(title)}</text>` +
    `<text>${xmlEscape(body)}</text>` +
    `</binding></visual>${actions}</toast>`;

  return new Promise((resolve) => {
    const p = spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", PS], {
      windowsHide: true,
      env: { ...process.env, NOTIF_XML: xml },
    });
    p.on("close", () => resolve());
    p.on("error", () => resolve());
  });
}
