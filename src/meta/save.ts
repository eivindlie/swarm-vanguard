// Versioned save in localStorage. Meta-progression (upgrades) hooks in via `upgrades`
// and `metaModifiers()`; the sim already computes stats as base + modifier list.
import type { Modifier } from '../sim/stats';
import { coinMultiplier, modifiersFromSave } from './upgrades';

export interface SaveData {
  version: 2;
  /** Legacy (v1): a POSITION in play order, which shifts whenever levels are inserted. Ignored: unlocks are derived from `stars`. */
  unlockedLevel?: number;
  coins: number;
  stars: Record<string, number>; // best stars per cleared level id: the source of truth for progress
  upgrades: Record<string, number>; // reserved for the future upgrade shop
}

const KEY = 'swarmvanguard.save';
const OLD_KEY = 'squadrush.save'; // pre-rename saves are migrated on first load
const fresh = (): SaveData => ({ version: 2, coins: 0, stars: {}, upgrades: {} });

function migrate(raw: any): SaveData {
  const s = fresh();
  if (!raw || typeof raw !== 'object') return s;
  // v1 -> v2: progress is now derived from the cleared levels (`stars`, keyed by stable level ids), not from a
  // position in the play order that shifts when levels are added. `unlockedLevel` is dropped.
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

/** Minimal level shape needed for unlock logic (optional levels are bonus/siege levels). */
export interface LevelRef {
  id: number;
  bonus?: unknown;
}

/**
 * How many levels (counted in play order) are open: everything up to and including the first REGULAR level that has
 * not been cleared. Optional levels (bonus, siege) never block progress, so the ones before the frontier are open too.
 */
export function unlockedCount(s: SaveData, levels: LevelRef[]): number {
  for (let i = 0; i < levels.length; i++) {
    if (!levels[i].bonus && !((s.stars[levels[i].id] ?? 0) > 0)) return i + 1;
  }
  return levels.length;
}

/** Records a win; returns what was earned. */
export function recordWin(s: SaveData, levelId: number, levelCoins: number, remaining: number, maxCount: number, bonusCoins = 0) {
  const stars = starsFor(remaining, maxCount);
  const best = s.stars[levelId] ?? 0;
  const firstClear = best === 0;
  const coins = Math.round((levelCoins + bonusCoins + (stars - 1) * 5 + (firstClear ? levelCoins : 0)) * coinMultiplier(s));
  s.coins += coins;
  s.stars[levelId] = Math.max(best, stars);
  writeSave(s);
  return { stars, coins, firstClear };
}
