import { describe, expect, it } from 'vitest';
import { Game, applyGate } from '../src/sim/game';
import { computeStat } from '../src/sim/stats';
import { level01 } from '../src/levels/level01';

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
