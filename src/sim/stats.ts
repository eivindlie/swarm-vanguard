// All combat stats are "base + modifier list". Powerups, weapon pickups and
// (later) permanent meta upgrades are just sources of modifiers.
export type StatKey = 'damage' | 'fireInterval' | 'startSize' | 'bulletSpeed' | 'pierce' | 'spread';

export interface Modifier {
  stat: StatKey;
  add?: number;
  mul?: number;
  source?: string;
}

export const BASE_STATS: Record<StatKey, number> = {
  damage: 1,
  fireInterval: 0.5,
  startSize: 5,
  bulletSpeed: 22,
  pierce: 1,
  spread: 0,
};

export function computeStat(stat: StatKey, mods: readonly Modifier[]): number {
  let add = 0;
  let mul = 1;
  for (const m of mods) {
    if (m.stat !== stat) continue;
    add += m.add ?? 0;
    mul *= m.mul ?? 1;
  }
  return (BASE_STATS[stat] + add) * mul;
}
