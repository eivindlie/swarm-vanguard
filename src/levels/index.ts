import type { LevelDef } from '../sim/level';
import { Rng } from '../sim/rng';
import tuned from './tuned.json';
import { LevelBuilder, add, mul, sub, div, soldiers, dmgUp, rateUp, pierceUp, spreadUp } from './builder';

// --- Hand-built intro levels: teach gates, shoot-blocks, counting blocks, brutes. ---
type Overrides = Record<number, number>;

function makeHand(K: (id: number) => number): LevelDef[] {
  const l1 = new LevelBuilder(K(1))
    .horde(10).gates(add(5), mul(2)).block(-2, 18, soldiers(12)).horde(22)
    .gates(sub(4), add(8)).horde(36).block(2, 30, dmgUp).counter(-2.2, 4, 1, 40, 14).horde(50, 'grunt', { after: 22 })
    .build(1, 'First Steps', 150, 20);

  const l2 = new LevelBuilder(K(2))
    .horde(14).gates(add(3), mul(2)).block(-2, 22, soldiers(10)).horde(28)
    .gates(add(6), div(2)).horde(20, 'runner').horde(34).counter(2.2, 5, 1, 45, 14).horde(48, 'grunt', { after: 20 })
    .build(2, 'Dust Road', 320, 25);

  const l3 = new LevelBuilder(K(3))
    .horde(18).gates(mul(2), add(10)).block(2, 26, rateUp).horde(30).horde(2, 'brute', { after: 16 })
    .gates(sub(6), mul(2)).block(-2, 36, soldiers(16)).horde(46).counter(-2.2, 6, 1, 50, 14)
    .horde(30, 'runner').horde(3, 'brute', { after: 14 }).horde(60, 'grunt', { after: 20 })
    .build(3, 'Cactus Pass', 520, 30);

  return [l1, l2, l3];
}

// --- Levels 4-10: same ingredients, deterministic seeded layouts, rising pressure. ---
function generated(id: number, K: (id: number) => number): LevelDef {
  const rng = new Rng(id * 7919);
  const b = new LevelBuilder(K(id));
  const waves = 4 + Math.floor(id / 3);
  const scale = Math.pow(1.13, id);
  const weapons = [dmgUp, rateUp, pierceUp, spreadUp];
  // a free opening gate: the squad gets its first growth before the first horde arrives
  b.gates(add(4 + id), add(4 + id), 12);
  for (let w = 0; w < waves; w++) {
    // soft start, heavy finish
    const prog = 0.2 + 1.6 * Math.pow(w / (waves - 1), 1.5);
    const n = Math.round(10 * scale * prog);
    const rewardX = rng.next() < 0.5 ? -2 : 2;
    // the horde lingers on the side AWAY from the reward: grabbing it costs you leakage
    b.horde(n, 'grunt', { x: -rewardX * 0.55, w: 2.4 });
    if (id >= 5 && w % 2 === 1) b.horde(Math.round(n * 0.35), 'runner', { x: -rewardX * 0.5, w: 2.4, after: 8 });
    if (id >= 4 && w % 3 === 2) b.horde(Math.max(2, Math.round(id / 2)), 'brute', { x: -rewardX * 0.5, w: 2, after: 11 });
    // a gate pair: one decent side, one trap
    const side = rng.next() < 0.5;
    const good = rng.next() < 0.3 ? mul(2) : add(4 + id);
    const bad = rng.next() < 0.5 ? sub(3 + id * 2) : rng.next() < 0.5 ? div(2) : div(3);
    b.gates(side ? good : bad, side ? bad : good);
    const roll = rng.next();
    if (roll < 0.45) b.block(rewardX, Math.round(14 * scale * prog), soldiers(Math.round(6 * Math.pow(1.1, id))));
    else if (roll < 0.75) b.counter(rewardX * 1.1, 3 + Math.floor(id / 2), 1, 30 + id * 4, 12);
    else b.block(rewardX, Math.round(16 * scale * prog), weapons[Math.floor(rng.next() * weapons.length)]);
  }
  b.horde(Math.round(14 * scale), 'grunt', { after: 18 });
  return b.build(id, ['', '', '', '', 'Sun Rise', 'Red Canyon', 'Bone Dunes', 'Mesa Run', 'Hornet Nest', 'The Gauntlet', 'Final Stand'][id] ?? `Level ${id}`, Math.round(260 * id * 1.3), 20 + id * 5);
}



/** Build all levels; `over` lets the tuner try other difficulty multipliers. */
export function makeLevels(over: Overrides = {}): LevelDef[] {
  const K = (id: number) => over[id] ?? (tuned as Record<string, number>)[String(id)] ?? 1;
  return [...makeHand(K), ...[4, 5, 6, 7, 8, 9, 10].map((id) => generated(id, K))];
}

export const LEVELS: LevelDef[] = makeLevels();
