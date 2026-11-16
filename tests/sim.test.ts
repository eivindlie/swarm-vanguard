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
    const g = new Game(level01, 1);
    let sawGate = false;
    while (g.phase === 'playing' && g.tick < 3000) {
      g.step({ targetX: 2 });
      if (g.events.some((e) => e.t === 'gate')) { sawGate = true; break; }
    }
    expect(sawGate).toBe(true);
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
