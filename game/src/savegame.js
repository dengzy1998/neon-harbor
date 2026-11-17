// savegame.js — the whole save system is one localStorage record: cash,
// story progress, where Reyes was standing, and lifetime stats. Written on
// mission completions and whenever the game pauses; read by Continue.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      missionIndex: state.missionIndex,
      storyDone: state.storyDone,
      x: Math.round(state.playerPos.x * 10) / 10,
      z: Math.round(state.playerPos.z * 10) / 10,
      earnings: state.earnings,
      busts: state.busts,
      version: 1,
    }));
  } catch {
    // Storage can be unavailable (private mode); the game simply goes on.
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing to clear */ }
}
