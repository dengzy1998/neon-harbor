// The save file: one JSON record in localStorage — cash, story progress, where
// Jett was standing, and whether the sound is off. Continue picks it all back up.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: Number.isFinite(data.cash) ? data.cash : 0,
      missionIndex: Number.isFinite(data.missionIndex) ? data.missionIndex : 0,
      jobsDone: Number.isFinite(data.jobsDone) ? data.jobsDone : 0,
      muted: !!data.muted,
      pos: data.pos && Number.isFinite(data.pos.x) ? data.pos : null,
    };
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // A browser that refuses storage just loses the save; the game goes on.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
