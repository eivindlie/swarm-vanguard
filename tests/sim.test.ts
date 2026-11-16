import { describe, expect, it } from 'vitest';
import { Game, applyGate } from '../src/sim/game';
import { computeStat } from '../src/sim/stats';
import { LEVELS } from '../src/levels';
const level01 = LEVELS[0];

function run(seed: number, targetX: (g: Game) => number, maxTicks = 6000) {
  const g = new Game(level01, seed);
  while (g.phase === 'playing' && g.tick < maxTicks) g.step({ targetX: targetX(g) });
  return g;
}

describe('stats', () => {
  it('base + adds then multipliers', () => {
    expect(computeStat('damage', [])).toBe(1);
    expect(computeStat('damage', [{ stat: 'damage', add: 1 }, { stat: 'damage', mul: 2 }])).toBe(4);
  });
});

describe('gates', () => {
  it('applies math ops', () => {
    expect(applyGate(10, { op: 'add', value: 5 })).toBe(15);
    expect(applyGate(10, { op: 'mul', value: 2 })).toBe(20);
    expect(applyGate(3, { op: 'sub', value: 9 })).toBe(0);
    expect(applyGate(10, { op: 'div', value: 3 })).toBe(3);
  });
});

describe('determinism', () => {
  it('same seed gives identical outcome', () => {
    const a = run(7, () => 0).snapshot();
    const b = run(7, () => 0).snapshot();
    expect(a).toEqual(b);
  });
});

describe('game rules', () => {
  it('squad auto-advances and shoots', () => {
    const g = new Game(level01, 1);
    for (let i = 0; i < 120; i++) g.step({ targetX: 0 });
    expect(g.squad.y).toBeGreaterThan(5);
    expect(g.bullets.length).toBeGreaterThan(0);
  });
  it('takes the right gate when steering right', () => {
    const g = new Game(
      { id: 98, name: 'g', length: 60, coins: 1, spawns: [{ t: 'gates', y: 20, left: { op: 'sub', value: 3 }, right: { op: 'add', value: 5 } }] },
      1,
    );
    for (let i = 0; i < 600 && g.phase === 'playing'; i++) g.step({ targetX: 2 });
    expect(g.squad.count).toBe(10);
  });
  it('ends the game (win or lose) within the time limit', () => {
    const g = run(3, () => 0);
    expect(['won', 'lost']).toContain(g.phase);
  });
});

import { MAX_SQUAD } from '../src/sim/game';
import type { LevelDef } from '../src/sim/level';
import { starsFor, loadSave } from '../src/meta/save';

const tiny = (spawns: LevelDef['spawns'], length = 40): LevelDef => ({ id: 99, name: 't', length, spawns, coins: 1 });

describe('counting block', () => {
  it('grows when shot and pays out when the squad walks through', () => {
    const g = new Game(tiny([{ t: 'counter', y: 20, x: 0, w: 3, start: 2, perHit: 1, max: 30 }]), 1);
    const before = g.squad.count;
    let hits = 0;
    while (g.phase === 'playing' && g.counters.length && g.tick < 2000) {
      g.step({ targetX: 0 });
      hits += g.events.filter((e) => e.t === 'counterHit').length;
    }
    expect(hits).toBeGreaterThan(3);
    expect(g.squad.count).toBeGreaterThan(before + 2);
  });
});

describe('boss', () => {
  it('holds the squad at the finish line until it is dead', () => {
    const g = new Game(tiny([{ t: 'enemies', y: 52, x: 0, spreadX: 0, spreadY: 0, count: 1, kind: 'boss', hp: 5000 }]), 1);
    for (let i = 0; i < 1200 && g.phase === 'playing'; i++) g.step({ targetX: 0 });
    expect(g.squad.y).toBeLessThanOrEqual(g.level.length + 0.01);
    expect(g.phase).not.toBe('won');
  });
  it('is beatable', () => {
    const g = new Game(tiny([{ t: 'enemies', y: 52, x: 0, spreadX: 0, spreadY: 0, count: 1, kind: 'boss', hp: 20 }]), 1);
    while (g.phase === 'playing' && g.tick < 3000) g.step({ targetX: 0 });
    expect(g.phase).toBe('won');
  });
});

describe('squad cap and meta', () => {
  it('never exceeds MAX_SQUAD', () => {
    const g = new Game(tiny([{ t: 'gates', y: 8, left: { op: 'mul', value: 99 }, right: { op: 'mul', value: 99 } }]), 1);
    for (let i = 0; i < 400; i++) g.step({ targetX: 0 });
    expect(g.squad.count).toBeLessThanOrEqual(MAX_SQUAD);
  });
  it('awards stars by survivors', () => {
    expect(starsFor(80, 100)).toBe(3);
    expect(starsFor(50, 100)).toBe(2);
    expect(starsFor(10, 100)).toBe(1);
  });
  it('load falls back to a fresh save without storage', () => {
    expect(loadSave().unlockedLevel).toBe(1);
  });
});

import { halfWidth, slot } from '../src/sim/formation';
import { ENEMY_DEFS } from '../src/sim/game';

const withSquad = (spawns: LevelDef['spawns'], count: number) =>
  new Game(tiny(spawns, 200), 1, [{ stat: 'startSize', add: count - 5 }]);
const grunt = (x: number, y = 30, n = 1) =>
  ({ t: 'enemies', y, x, spreadX: 0, spreadY: 0, count: n, kind: 'grunt' }) as LevelDef['spawns'][number];

describe('shots cover the squad width', () => {
  for (const count of [5, 12, 40, 150]) {
    it(`no enemy within the squad's width survives to reach it (${count} soldiers)`, () => {
      const hw = halfWidth(count);
      for (let x = -hw; x <= hw; x += 0.15) {
        const g = withSquad([grunt(x)], count);
        let hits = 0;
        for (let i = 0; i < 900 && g.phase === 'playing'; i++) {
          g.step({ targetX: 0 });
          hits += g.events.filter((e) => e.t === 'squadHit').length;
          if (g.enemies.length === 0) break;
        }
        expect(g.enemies.length, `x=${x.toFixed(2)}`).toBe(0);
        expect(hits, `reached the squad at x=${x.toFixed(2)}`).toBe(0);
      }
    });
  }
  it('the formation never leaves the lane', () => {
    for (const n of [1, 5, 40, 120, 300]) {
      expect(halfWidth(n)).toBeLessThanOrEqual(3.4 + 1e-9);
      for (let i = 0; i < n; i++) expect(Math.abs(slot(i, n).dx)).toBeLessThanOrEqual(3.2 + 1e-9);
    }
  });
});

describe('arcade enemy movement', () => {
  it('enemies walk straight: x never changes', () => {
    const g = withSquad([grunt(3, 20)], 5);
    const e0 = g.enemies[0];
    const x0 = e0.x;
    for (let i = 0; i < 120; i++) g.step({ targetX: -2 });
    expect(e0.x).toBe(x0);
    expect(e0.y).toBeLessThan(20);
  });
  it('an enemy that slips past the squad costs lives at the bottom', () => {
    const g = withSquad([grunt(3.4, 12)], 5);
    let leaked = false;
    for (let i = 0; i < 600 && g.phase === 'playing'; i++) {
      g.step({ targetX: -2 });
      if (g.events.some((e) => e.t === 'leak')) leaked = true;
    }
    expect(leaked).toBe(true);
    expect(g.squad.count).toBe(4);
  });
  it('a boss that gets past the squad is a defeat', () => {
    const g = withSquad([{ t: 'enemies', y: 20, x: 3, spreadX: 0, spreadY: 0, count: 1, kind: 'boss', hp: 99999 }], 5);
    for (let i = 0; i < 1500 && g.phase === 'playing'; i++) g.step({ targetX: -3 });
    expect(g.phase).toBe('lost');
  });
});

describe('weapon types', () => {
  it('a weapon block switches the weapon', () => {
    const g = withSquad([{ t: 'block', y: 10, x: 0, w: 3, hp: 2, reward: { kind: 'weaponType', weapon: 'laser', label: 'LASER' } }], 5);
    for (let i = 0; i < 300 && g.weapon === 'rifle'; i++) g.step({ targetX: 0 });
    expect(g.weapon).toBe('laser');
  });
  it('rockets explode and hurt neighbours', () => {
    const g = withSquad([{ t: 'enemies', y: 25, x: 0, spreadX: 0.5, spreadY: 0.5, count: 8, kind: 'grunt' }], 12);
    g.weapon = 'rocket';
    let explosions = 0;
    for (let i = 0; i < 900 && g.enemies.length; i++) {
      g.step({ targetX: 0 });
      explosions += g.events.filter((e) => e.t === 'explosion').length;
    }
    expect(explosions).toBeGreaterThan(0);
    expect(g.enemies.length).toBe(0);
  });
  it('a piercing bullet passes through an enemy and hits it only once', () => {
    const g = withSquad([grunt(3.2, 20)], 5);
    const e = g.enemies[0];
    e.hp = e.maxHp = 100;
    e.awake = true;
    g.bullets.push({ id: 9999, x: 3.2, y: e.y - 1, vx: 0, vy: 42, dmg: 1, pierce: 3, born: 0, maxAge: 120, kind: 'laser', splash: 0, hit: [] });
    for (let i = 0; i < 20; i++) g.step({ targetX: -3 });
    expect(e.hp).toBeCloseTo(99, 5);
    expect(ENEMY_DEFS.grunt.hp).toBeGreaterThan(0);
  });
});
