import type { Modifier } from '../sim/stats';
import type { SaveData } from './save';

// Permanent upgrades bought with coins. They only ever become sim modifiers (base + modifier list);
// the difficulty tuner and the bots always run with zero upgrades.
export interface UpgradeDef {
  id: 'size' | 'damage' | 'rate' | 'coins';
  name: string;
  icon: string;
  max: number;
  cost(level: number): number; // price of buying level+1
  effect(level: number): string;
  modifiers(level: number): Modifier[];
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'size', name: 'Squad size', icon: '👥', max: 10,
    cost: (l) => 40 + 25 * l,
    effect: (l) => `+${l} starting soldiers`,
    modifiers: (l) => (l ? [{ stat: 'startSize', add: l, source: 'meta' }] : []),
  },
  {
    id: 'damage', name: 'Firepower', icon: '🔥', max: 10,
    cost: (l) => 50 + 30 * l,
    effect: (l) => `+${l * 6}% damage`,
    modifiers: (l) => (l ? [{ stat: 'damage', mul: 1 + 0.06 * l, source: 'meta' }] : []),
  },
  {
    id: 'rate', name: 'Fire rate', icon: '⚡', max: 10,
    cost: (l) => 50 + 30 * l,
    effect: (l) => `+${l * 5}% fire rate`,
    modifiers: (l) => (l ? [{ stat: 'fireInterval', mul: 1 / (1 + 0.05 * l), source: 'meta' }] : []),
  },
  {
    id: 'coins', name: 'Loot bonus', icon: '💰', max: 5,
    cost: (l) => 60 + 40 * l,
    effect: (l) => `+${l * 10}% coins`,
    modifiers: () => [],
  },
];

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
