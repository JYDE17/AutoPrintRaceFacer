# AutoPrint RaceFacer

Service **headless** (aucune interface) qui surveille RaceFacer et **imprime
automatiquement la feuille de résultats** de chaque **course de compétition**
(`race_heat`) dès qu'elle est terminée. Les sessions libres (`session`) sont
ignorées.

La feuille imprimée est **la vraie feuille RaceFacer** (avec la matrice
tour-par-tour, les pénalités, etc.) : le service ouvre la page d'impression de
RaceFacer dans un Chromium invisible, la rend en PDF et l'envoie à l'imprimante.
Rien n'est reconstruit à la main.

Même logique que le repo `Goplex-Lasertag` : un simple `fetch` authentifié vers
les endpoints RaceFacer, mais côté serveur et sans plateforme visuelle.

---

## `session` vs `race_heat` : la vraie différence

| | `type: "session"` | `type: "race_heat"` |
|---|---|---|
| Nature | Chrono libre / drop-in, chacun roule | Manche d'une **compétition structurée** |
| Structure | `session_id` numérique isolé | `race_id` → `stage` (PRATIQUE/FINALE) → `heat` (Heat A) |
| Données | `runs.data[]` : `rank`, `best_lap` | `race_heat_runs[]` : `pos`, `grid_position`, `gap`, pénalités |
| Course | Pas de grille ni de drapeaux | Grille de départ, green/checkered flag, pénalités, DNF/DSQ, points, équipes |

**On n'imprime que les `race_heat`.** (Filtrable plus finement par nom de course
ou par stage — voir config.)

---

## Comment ça marche

1. Toutes les `POLL_INTERVAL_SECONDS`, le service appelle
   `sessions-schedule?date=...` (le calendrier du jour).
2. Il garde les lignes `type = race_heat` au statut `finished`.
3. Pour chacune, il récupère le détail (`session?type=race_heat&uuid=...`) et
   vérifie que les résultats sont confirmés.
4. Il ouvre la **page d'impression RaceFacer** (`RF_PRINT_URL`) dans Chromium
   headless (session authentifiée du profil), la rend en PDF, puis l'envoie à
   l'imprimante.
5. Chaque heat n'est imprimée **qu'une seule fois** (mémorisé dans
   `state/printed.json`).

---

## Installation

Prérequis : **Node.js ≥ 18** et un **Chrome / Chromium / Edge** installé.

```bash
npm install
cp .env.example .env      # puis remplis .env (voir ci-dessous)
```

---

## Configuration (`.env`)

Les valeurs indispensables :

| Variable | Rôle |
|---|---|
| `RF_USERNAME` / `RF_PASSWORD` | Identifiants RaceFacer — le service se connecte tout seul et se reconnecte si la session expire |
| `RF_PRINT_URL` | URL de la feuille de résultats à imprimer (déjà pré-remplie) |
| `RF_SUB_TRACK_ID` | La piste à surveiller (défaut `1`) |

Toutes les autres options (filtres, imprimante, réglages d'impression...) sont
documentées dans `.env.example`.

### Authentification

Le service ne copie **aucun cookie** : il se connecte à RaceFacer avec
`RF_USERNAME` / `RF_PASSWORD` (comme le repo lasertag) et garde la session dans
un profil Chrome persistant (`.chrome-profile/`). Si la session expire, il se
reconnecte automatiquement.

- **Automatique (recommandé)** : renseigne `RF_USERNAME` et `RF_PASSWORD`.
- **Manuel (fallback, ex. 2FA)** : laisse-les vides et lance `npm run login`
  une fois — un navigateur s'ouvre, tu te connectes, tu fermes. La session est
  gardée dans le profil.

### Trouver `RF_PRINT_URL` (déjà fait pour cette instance)

L'URL est déjà pré-remplie dans `.env.example`. Pour une autre instance,
`npm run discover` ouvre un navigateur : clique **Imprimer** une fois sur une
course, repère la ligne `<<< PROBABLE PAGE D'IMPRESSION`, remplace l'id par
`{id}` (et l'uuid de course par `{race_uuid}`).

---

## Lancer

```bash
npm start          # service en continu (à laisser tourner sur la borne)
npm run once       # un seul passage (test)
npm run test-print -- <uuid-du-heat>   # imprime une course précise, tout de suite
```

---

## Impression

`PRINT_MODE` (dans `.env`) :

- `auto` (défaut) — Windows : SumatraPDF si dispo, sinon impression via
  PowerShell ; Linux/mac : `lp` (CUPS).
- `sumatra` — [SumatraPDF](https://www.sumatrapdfreader.org/) pour un print
  **100 % silencieux** sur Windows (recommandé pour une borne). Renseigne
  `SUMATRA_PATH`.
- `lp` — CUPS (Linux/mac).
- `command` — commande custom via `PRINT_COMMAND` (`{file}` = le PDF).
- `none` — génère seulement le PDF dans `OUTPUT_DIR`, sans imprimer.

`PRINTER_NAME` vide = imprimante par défaut du système.

---

## Démarrage automatique (borne) — sans rien lancer le matin

**Windows (recommandé)** — installe le service en **une commande** (à faire une
seule fois). Il démarrera tout seul à chaque ouverture de session, tournera en
**arrière-plan sans aucune fenêtre**, et se **relancera automatiquement** s'il
s'arrête :

```powershell
npm run service:install
```

Puis pour le lancer tout de suite (sans redémarrer) :

```powershell
npm run service:start
```

Autres commandes :

```powershell
npm run service:stop        # arreter
npm run service:uninstall   # desinstaller la tache
```

> La tâche s'exécute **sous ta session utilisateur** (pour voir l'imprimante par
> défaut). Si la borne démarre directement sur le bureau (connexion Windows
> automatique), le service se lance donc au boot. Sinon il démarre à l'ouverture
> de session.
>
> Logs en direct : `logs\service.log`.

**Alternative** — [nssm](https://nssm.cc/) pour un vrai service Windows
(nécessite alors une imprimante nommée dans `PRINTER_NAME`, car un service
système ne voit pas l'imprimante par défaut de l'utilisateur).

**Linux** — un service `systemd` qui lance `npm start` dans le dossier du projet.

---

## Structure

```
src/
  index.js       Boucle principale (poll + impression, anti-doublon)
  racefacer.js   Client RaceFacer (schedule, détail heat, URL d'impression)
  browser.js     Chromium persistant : auto-login, fetch JSON, page d'impression -> PDF
  printer.js     Envoi du PDF à l'imprimante (Windows / CUPS / custom)
  chrome.js      Détection de l'exécutable Chrome/Chromium/Edge
  store.js       Mémoire des heats déjà imprimées
  login.js       Connexion manuelle (fallback / 2FA)
  discover.js    Aide à trouver RF_PRINT_URL
  test-print.js  Impression manuelle d'une course
```
