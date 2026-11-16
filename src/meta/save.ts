// Versioned save in localStorage. Meta-progression (upgrades) hooks in via `upgrades`
// and `metaModifiers()`; the sim already computes stats as base + modifier list.
import type { Modifier } from '../sim/stats';
import { coinMultiplier, modifiersFromSave } from './upgrades';

export interface SaveData {
  version: 1;
  unlockedLevel: number;
  coins: number;
  stars: Record<string, number>; // best stars per level id
  upgrades: Record<string, number>; // reserved for the future upgrade shop
}

const KEY = 'swarmvanguard.save';
const OLD_KEY = 'squadrush.save'; // pre-rename saves are migrated on first load
const fresh = (): SaveData => ({ version: 1, unlockedLevel: 1, coins: 0, stars: {}, upgrades: {} });

function migrate(raw: any): SaveData {
  const s = fresh();
  if (!raw || typeof raw !== 'object') return s;
  // future: switch (raw.version) { case 1: ...upgrade to 2... }
  s.unlockedLevel = Math.max(1, Number(raw.unlockedLevel) || 1);
  s.coins = Math.max(0, Number(raw.coins) || 0);
  if (raw.stars && typeof raw.stars === 'object') s.stars = { ...raw.stars };
  if (raw.upgrades && typeof raw.upgrades === 'object') s.upgrades = { ...raw.upgrades };
  return s;
}

export function loadSave(): SaveData {
  try {
    const txt = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
    return txt ? migrate(JSON.parse(txt)) : fresh();
  } catch {
    return fresh();
  }
}

export function writeSave(s: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode / quota: progress just won't persist */
  }
}

/** Permanent upgrades (shop) become modifiers fed into the sim. */
export function metaModifiers(s: SaveData): Modifier[] {
  return modifiersFromSave(s);
}

export function starsFor(remaining: number, maxCount: number): number {
  const r = maxCount > 0 ? remaining / maxCount : 0;
  return r >= 0.75 ? 3 : r >= 0.4 ? 2 : 1;
}

/** Records a win; returns what was earned. */
export function recordWin(
  s: SaveData,
  levelId: number,
  levelCoins: number,
  remaining: number,
  maxCount: number,
  totalLevels: number,
  position: number, // 1-based place in the play order
  nextIsBonus = false,
  bonusCoins = 0,
) {
  const stars = starsFor(remaining, maxCount);
  const best = s.stars[levelId] ?? 0;
  const firstClear = best === 0;
  const coins = Math.round((levelCoins + bonusCoins + (stars - 1) * 5 + (firstClear ? levelCoins : 0)) * coinMultiplier(s));
  s.coins += coins;
  s.stars[levelId] = Math.max(best, stars);
  // a bonus level never blocks progress: clearing the level before it also unlocks the one after it
  s.unlockedLevel = Math.max(s.unlockedLevel, Math.min(totalLevels, position + (nextIsBonus ? 2 : 1)));
  writeSave(s);
  return { stars, coins, firstClear };
}
