export const SAVE_KEY = 'neon-harbor-save-v2';

export function loadSave() {
  try {
    const value = JSON.parse(globalThis.localStorage.getItem(SAVE_KEY));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    globalThis.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Restricted storage should not interrupt play.
  }
}

export function clearSave() {
  try {
    globalThis.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be disabled by the browser.
  }
}
