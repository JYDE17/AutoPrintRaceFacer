// Persistance de l'etat : quelles heats ont deja ete imprimees (anti-doublon).
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

let state = { printed: {} };

export function loadState() {
  try {
    if (fs.existsSync(config.stateFile)) {
      state = JSON.parse(fs.readFileSync(config.stateFile, "utf8"));
      if (!state.printed) state.printed = {};
    }
  } catch (e) {
    console.warn(`[state] lecture impossible (${e.message}), on repart a vide.`);
    state = { printed: {} };
  }
  return state;
}

function save() {
  try {
    fs.mkdirSync(path.dirname(config.stateFile), { recursive: true });
    fs.writeFileSync(config.stateFile, JSON.stringify(state, null, 2));
  } catch (e) {
    console.warn(`[state] ecriture impossible : ${e.message}`);
  }
}

export function alreadyPrinted(uuid) {
  return Boolean(state.printed[uuid]);
}

export function markPrinted(uuid, meta = {}) {
  state.printed[uuid] = { at: new Date().toISOString(), ...meta };
  save();
}
