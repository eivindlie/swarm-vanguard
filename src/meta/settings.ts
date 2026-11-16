// Per-device preferences (separate from game progress so they survive save migrations).
export interface Settings {
  haptics: boolean;
  reduceShake: boolean;
  music: boolean;
  hintSeen: boolean;
  installed: boolean; // added to the home screen
  installDismissedAt: number; // ms timestamp of the last "Not now" (0 = never)
}

const KEY = 'swarmvanguard.settings';
const DEFAULTS: Settings = { haptics: true, reduceShake: false, music: true, hintSeen: false, installed: false, installDismissedAt: 0 };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: settings just won't persist */
  }
}
