// Connexion manuelle a RaceFacer (fallback si tu ne veux pas mettre le mot de
// passe dans .env, ou en cas de 2FA). Ouvre un navigateur visible sur le meme
// profil que le service : connecte-toi, puis ferme la fenetre. La session est
// conservee dans le profil et reutilisee par `npm start`.
import { openLoginWindow, closeBrowser } from "./browser.js";

async function main() {
  console.log("Ouverture de RaceFacer... connecte-toi, puis FERME la fenetre.");
  const browser = await openLoginWindow();
  await new Promise((resolve) => browser.on("disconnected", resolve));
  console.log("Session enregistree dans le profil. Tu peux lancer `npm start`.");
  await closeBrowser();
  process.exit(0);
}

main().catch((e) => {
  console.error("Erreur:", e.message);
  process.exit(1);
});
