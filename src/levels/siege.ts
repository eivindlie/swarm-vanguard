import type { ArenaDef, EnemyKind, LevelDef, Spawn } from '../sim/level';
import { Rng } from '../sim/rng';

// Siege levels: a fixed screen, the squad walks freely, the nest under the roof sends timed waves, and the level
// is won by destroying the keystone pillar. Tiles on the floor and crates give the squad its growth.

export interface SiegeParams {
  id: number;
  world: number; // 0-based world index (sets the look)
  name: string;
  keystoneHp: number;
  hpMul: number; // enemy HP multiplier
  /** Scheduled waves: [seconds, count, kind]. Counts are multiplied by the difficulty `k`. */
  waves: [number, number, EnemyKind][];
  escalate: { every: number; count: number; growth: number; kind: EnemyKind };
  /** Extra growth lying around: crates (hp, soldiers) and how many +1 / +10 tiles. */
  crates: { x: number; y: number; hp: number; soldiers: number; weapon?: 'rocket' | 'laser' }[];
  tiles1: number;
  tiles10: number;
  coins: number;
}

export function siege(p: SiegeParams, k = 1): LevelDef {
  const arena: ArenaDef = {
    half: 5.5,
    depth: 24,
    minY: 1,
    maxY: 8,
    bottom: -1.5,
    startX: 0,
    startY: 2,
    escalate: p.escalate, // the escalation is the clock: it is NOT scaled by the difficulty
  };
  const spawns: Spawn[] = [];
  const rng = new Rng(p.id * 31);

  // the keystone: a pillar on the right that holds the roof up; shoot it down to win
  spawns.push({
    // difficulty `k` scales the pillar's HP: a tougher pillar means a longer siege under ever bigger waves
    t: 'block', x: 3.9, y: 19.2, w: 2.4, hp: Math.round(p.keystoneHp * k), keystone: true,
    reward: { kind: 'multi', label: 'COLLAPSE', rewards: [{ kind: 'soldiers', n: 60 }] },
  });

  // crates along the left edge: breakable growth that also shields a corner of the arena
  for (const c of p.crates) {
    spawns.push({
      t: 'block', x: c.x, y: c.y, w: 2.2, hp: c.hp,
      reward: c.weapon ? { kind: 'weaponType', weapon: c.weapon, label: c.weapon === 'rocket' ? 'ROCKETS' : 'LASER' } : { kind: 'soldiers', n: c.soldiers },
    });
  }

  // a diagonal trail of +1 tiles up the left side (the squad must leave the pillar to collect them)...
  for (let i = 0; i < p.tiles1; i++) {
    const f = i / Math.max(1, p.tiles1 - 1);
    spawns.push({ t: 'tile', x: -4.7 + f * 2.6 + rng.range(-0.1, 0.1), y: 2.0 + f * 6.0, value: 1 });
  }
  // ...and a few golden +10 tiles on the pillar side
  for (let i = 0; i < p.tiles10; i++) {
    // far from the start, on the pillar side: collecting them means leaving the waves' path for a while
    spawns.push({ t: 'tile', x: 3.0 + (i % 2) * 1.8, y: 5.2 + i * 1.2, value: 10 });
  }

  // the waves come from under the roof, left of the pillar
  for (const [at, count, kind] of p.waves) {
    spawns.push({ t: 'wave', at, count, kind, x: -1.2, spreadX: 3.0 });
  }

  return {
    id: p.id,
    name: p.name,
    length: arena.depth,
    spawns,
    coins: p.coins,
    hpMul: p.hpMul,
    bonus: 'siege',
    world: p.world,
    arena,
  };
}

/** The sieges, one per world, each harder than the last. Difficulty `k` multiplies the keystone's HP. */
export function siegeParams(): Record<number, SiegeParams> {
  return {
    4: {
      id: 201, world: 0, name: 'Sun Dunes Keep', keystoneHp: 3000, hpMul: 1.2,
      waves: [[2, 10, 'grunt'], [7, 14, 'grunt'], [12, 8, 'runner'], [17, 20, 'grunt'], [22, 3, 'splitter'], [27, 26, 'grunt'], [32, 14, 'runner'], [37, 34, 'grunt']],
      escalate: { every: 5, count: 40, growth: 1.1, kind: 'grunt' },
      crates: [{ x: -4.2, y: 9.5, hp: 40, soldiers: 18 }, { x: -4.2, y: 13, hp: 70, soldiers: 0, weapon: 'rocket' }],
      tiles1: 16, tiles10: 3, coins: 90,
    },
    8: {
      id: 202, world: 1, name: 'Red Canyon Fort', keystoneHp: 4200, hpMul: 1.9,
      waves: [[2, 12, 'grunt'], [6, 16, 'runner'], [11, 24, 'grunt'], [16, 4, 'splitter'], [21, 22, 'runner'], [26, 34, 'grunt'], [31, 5, 'brute'], [36, 40, 'grunt'], [42, 26, 'runner'], [48, 46, 'grunt']],
      escalate: { every: 4.5, count: 52, growth: 1.1, kind: 'grunt' },
      crates: [{ x: -4.2, y: 9.5, hp: 70, soldiers: 22 }, { x: -4.2, y: 13, hp: 110, soldiers: 0, weapon: 'laser' }, { x: 4.4, y: 10.5, hp: 60, soldiers: 18 }],
      tiles1: 18, tiles10: 3, coins: 110,
    },
    12: {
      id: 203, world: 2, name: 'Frozen Citadel', keystoneHp: 4000, hpMul: 2.6,
      waves: [[2, 14, 'grunt'], [6, 20, 'runner'], [10, 28, 'grunt'], [15, 5, 'splitter'], [19, 26, 'runner'], [24, 40, 'grunt'], [29, 6, 'brute'], [34, 48, 'grunt'], [40, 32, 'runner'], [46, 6, 'splitter'], [52, 56, 'grunt']],
      escalate: { every: 4, count: 64, growth: 1.1, kind: 'grunt' },
      crates: [{ x: -4.2, y: 9.5, hp: 90, soldiers: 26 }, { x: -4.2, y: 13, hp: 130, soldiers: 0, weapon: 'rocket' }, { x: 4.4, y: 10.5, hp: 80, soldiers: 22 }],
      tiles1: 20, tiles10: 4, coins: 130,
    },
    16: {
      id: 204, world: 3, name: 'Ember Stronghold', keystoneHp: 6800, hpMul: 3.4,
      waves: [[2, 16, 'grunt'], [5, 24, 'runner'], [9, 32, 'grunt'], [13, 6, 'splitter'], [17, 30, 'runner'], [22, 46, 'grunt'], [27, 7, 'brute'], [32, 56, 'grunt'], [38, 38, 'runner'], [44, 8, 'splitter'], [50, 66, 'grunt'], [56, 8, 'brute']],
      escalate: { every: 3.6, count: 76, growth: 1.1, kind: 'grunt' },
      crates: [{ x: -4.2, y: 9.5, hp: 110, soldiers: 30 }, { x: -4.2, y: 13, hp: 160, soldiers: 0, weapon: 'laser' }, { x: 4.4, y: 10.5, hp: 100, soldiers: 26 }],
      tiles1: 22, tiles10: 4, coins: 150,
    },
  };
}
