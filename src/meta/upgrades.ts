import type { Modifier } from '../sim/stats';
import type { SaveData } from './save';

// Permanent upgrades bought with coins. They only ever become sim modifiers (base + modifier list);
// the difficulty tuner and the bots always run with zero upgrades.
export interface UpgradeDef {
  id: 'size' | 'damage' | 'rate' | 'coins' | 'pierce' | 'armory';
  name: string;
  icon: string;
  max: number;
  cost(level: number): number; // price of buying level+1
  effect(level: number): string;
  modifiers(level: number): Modifier[];
}

/** Levels past the old cap (10) get steeply more expensive: they are the long-term coin sink. */
const tail = (base: number, l: number, from = 10): number => (l < from ? base : Math.round(base * Math.pow(1.3, l - from + 1) * 1.6));
const WEAPON_NAMES = ['Rifle', 'Shotgun', 'Rocket launcher', 'Laser'];

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'size', name: 'Squad size', icon: '👥', max: 20,
    cost: (l) => tail(40 + 25 * l, l),
    effect: (l) => `+${l} starting soldiers`,
    modifiers: (l) => (l ? [{ stat: 'startSize', add: l, source: 'meta' }] : []),
  },
  {
    id: 'damage', name: 'Firepower', icon: '🔥', max: 20,
    cost: (l) => tail(50 + 30 * l, l),
    effect: (l) => `+${l * 6}% damage`,
    modifiers: (l) => (l ? [{ stat: 'damage', mul: 1 + 0.06 * l, source: 'meta' }] : []),
  },
  {
    id: 'rate', name: 'Fire rate', icon: '⚡', max: 15,
    cost: (l) => tail(50 + 30 * l, l),
    effect: (l) => `+${l * 5}% fire rate`,
    modifiers: (l) => (l ? [{ stat: 'fireInterval', mul: 1 / (1 + 0.05 * l), source: 'meta' }] : []),
  },
  {
    id: 'coins', name: 'Loot bonus', icon: '💰', max: 10,
    cost: (l) => tail(60 + 40 * l, l, 5),
    effect: (l) => `+${l * 10}% coins`,
    modifiers: () => [],
  },
  {
    id: 'pierce', name: 'Piercing rounds', icon: '🎯', max: 3,
    cost: (l) => 600 + 900 * l,
    effect: (l) => `bullets pass through ${l + 1} enemies`,
    modifiers: (l) => (l ? [{ stat: 'pierce', add: l, source: 'meta' }] : []),
  },
  {
    id: 'armory', name: 'Armory', icon: '🧰', max: 3,
    cost: (l) => [1500, 4500, 11000][l],
    effect: (l) => `start every level with: ${WEAPON_NAMES[l]}`,
    modifiers: (l) => (l ? [{ stat: 'startWeapon', add: l, source: 'meta' }] : []),
  },
];

/**
 * The upgrades a typical player is assumed to own when they reach this far into the game (1 = first level,
 * 32 = last). The bots and the difficulty tuner play with these, so the game gets harder as upgrades pile up
 * instead of being tuned for a player with nothing. Players who buy everything are still ahead of it.
 */
export function profileLevels(progress: number): Partial<Record<UpgradeDef['id'], number>> {
  const f = Math.max(0, Math.min(1, (progress - 1) / 31));
  return {
    size: Math.round(f * 15),
    damage: Math.round(f * 15),
    rate: Math.round(f * 10),
    pierce: f > 0.85 ? 2 : f > 0.5 ? 1 : 0,
    armory: f > 0.8 ? 2 : f > 0.45 ? 1 : 0,
  };
}

export function profileModifiers(progress: number): Modifier[] {
  const lv = profileLevels(progress);
  return UPGRADES.flatMap((u) => u.modifiers(Math.min(lv[u.id] ?? 0, u.max)));
}

/** How far into the game a level is: regular levels by id; bonus levels and sieges by the world they close. */
export function progressOf(level: { id: number; bonus?: string; world?: number }): number {
  return level.bonus ? ((level.world ?? 0) + 1) * 4 : level.id;
}

export const levelOf = (s: SaveData, id: UpgradeDef['id']): number => Math.min(s.upgrades[id] ?? 0, UPGRADES.find((u) => u.id === id)!.max);

export function modifiersFromSave(s: SaveData): Modifier[] {
  return UPGRADES.flatMap((u) => u.modifiers(levelOf(s, u.id)));
}

export function coinMultiplier(s: SaveData): number {
  return 1 + 0.1 * levelOf(s, 'coins');
}

/** Returns true when the purchase went through (enough coins, below max). */
export function buy(s: SaveData, id: UpgradeDef['id']): boolean {
  const def = UPGRADES.find((u) => u.id === id)!;
  const lvl = levelOf(s, id);
  if (lvl >= def.max) return false;
  const cost = def.cost(lvl);
  if (s.coins < cost) return false;
  s.coins -= cost;
  s.upgrades[id] = lvl + 1;
  return true;
}
