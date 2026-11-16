import type { LevelDef } from '../sim/level';
import { Rng } from '../sim/rng';
import tuned from './tuned.json';
import { siege, siegeParams } from './siege';
import variants from './variants.json';
import {
  LevelBuilder, add, mul, sub, div, soldiers, multi, dmgUp, rateUp, pierceUp, spreadUp, shotgun, rocket, laser,
  upShotgun, upRocket, upLaser, upDamage, upRate, upPierce,
} from './builder';

export const LEVEL_COUNT = 16;

// Four worlds of four levels each (see render/themes.ts): desert, canyon, frost, volcano.
const NAMES = [
  'First Steps', 'Dust Road', 'Cactus Pass', 'Sun Rise',
  'Red Canyon', 'Echo Gorge', 'Rust Bridge', 'Mesa Run',
  'Frozen Lake', 'Snow Drift', 'Ice Gate', 'Whiteout',
  'Ember Road', 'Ash Fields', 'Magma Pass', 'The Core',
];

type Overrides = Record<number, number>;

// --- Hand-built intro levels: teach gates, shoot-blocks, barrels, upgrade gates, counting blocks, brutes. ---
function makeHand(K: (id: number) => number): LevelDef[] {
  // Level 1 is the tutorial: a free gate first (like every other level), so a new player who has not yet
  // learned to steer is not overrun before the first gate. Its difficulty is set by hand, not by the tuner.
  const l1 = new LevelBuilder(K(1))
    .gates(add(6), add(6), 14).horde(10).gates(add(5), mul(2)).block(-2, 18, soldiers(12)).horde(22)
    .gates(sub(4), add(8)).horde(36).block(2, 30, dmgUp).counter(-2.2, 4, 1, 40, 14).horde(50, 'grunt', { after: 22 })
    .build(1, NAMES[0], 150, 20, undefined, 4);

  // Hordes right after a shoot-block sit on the OPPOSITE side, so grabbing the reward costs some leakage
  // rather than getting the squad pinned against the block.
  const l2 = new LevelBuilder(K(2))
    .gates(add(4), add(6)).horde(10, 'grunt', { x: 1.7 }).block(-2, 22, soldiers(10)).horde(14, 'grunt', { x: 1.7 })
    .block(2, 24, shotgun).barrel(-1.7, 1.5).horde(18, 'grunt', { x: -1.7 })
    .gates(add(6), div(2)).horde(12, 'runner', { x: 1.7 }).horde(22, 'grunt', { x: -1.7 }).counter(2.2, 5, 1, 45, 14).horde(30, 'grunt', { x: -1.7, after: 20 })
    .build(2, NAMES[1], 320, 25, undefined, 6);

  const l3 = new LevelBuilder(K(3))
    .gates(mul(2), add(10)).horde(12, 'grunt', { x: -1.7 }).block(2, 26, rocket).horde(20, 'grunt', { x: -1.7 }).horde(2, 'brute', { x: 1.5, after: 16 })
    .gates(upRate, add(8)).block(-2, 36, soldiers(16)).horde(30, 'grunt', { x: 1.7 }).counter(-2.2, 6, 1, 50, 14)
    .horde(20, 'runner', { x: 1.7 }).horde(3, 'brute', { x: -1.5, after: 14 }).horde(40, 'grunt', { x: 1.7, after: 20 })
    .build(3, NAMES[2], 520, 30, undefined, 8);

  return [l1, l2, l3];
}

// --- Levels 4+: same ingredients, deterministic seeded layouts, rising pressure. ---
function generated(id: number, K: (id: number) => number, variant = (variants as Record<string, number>)[String(id)] ?? 0): LevelDef {
  // `variant` re-rolls the layout of one level (tools/reroll.ts picks one where standing still loses)
  const rng = new Rng(id * 7919 + variant * 104729);
  const b = new LevelBuilder(K(id));
  const waves = 4 + Math.floor(id / 4);
  const scale = Math.pow(1.13, id);
  const weapons = [dmgUp, rateUp, pierceUp, spreadUp, shotgun, rocket, laser];
  const upgrades = [upLaser, upRocket, upShotgun, upDamage, upRate, upPierce];
  // a free opening gate: the squad gets its first growth before the first horde arrives
  b.gates(add(4 + id), add(4 + id), 12);
  for (let w = 0; w < waves; w++) {
    // soft start, heavy finish
    const prog = 0.2 + 1.6 * Math.pow(w / (waves - 1), 1.5);
    const n = Math.round(10 * scale * prog);
    const rewardX = rng.next() < 0.5 ? -2 : 2;
    const hx = -rewardX * 0.9; // the horde lingers on the side AWAY from the reward: grabbing it costs leakage
    // an explosive barrel inside the column rewards lining up on the horde
    if (id >= 4 && rng.next() < 0.55) b.barrel(hx, 1.5);
    b.horde(n, 'grunt', { x: hx, w: 1.7 });
    if (id >= 5 && w % 2 === 1) b.horde(Math.round(n * 0.35), 'runner', { x: hx, w: 1.7, after: 8 });
    if (id >= 4 && w % 3 === 2) b.horde(Math.max(2, Math.round(id / 2)), 'brute', { x: hx, w: 1.6, after: 11 });
    if (id >= 6 && w % 3 === 1) b.horde(Math.max(2, Math.round(2 + id / 3)), 'splitter', { x: hx, w: 1.5, after: 10 });
    // an elite Warlord: tough, does not die on contact and grinds the squad until it is killed
    if (id >= 6 && w % 4 === 3) b.horde(id >= 12 ? 2 : 1, 'elite', { x: hx, w: 1.2, after: 12 });
    // a gate pair: one decent side, one trap. From level 3 on, many pairs offer an upgrade instead.
    // alternate which side is good (trap on the LEFT first): standing still in the middle always picks the
    // left gate, so it must not be the lucky side by chance in some levels
    rng.next();
    const side = w % 2 === 1;
    let left;
    let right;
    if (id >= 3 && rng.next() < 0.4) {
      const up = upgrades[Math.floor(rng.next() * upgrades.length)];
      const other = rng.next() < 0.5 ? add(4 + id) : rng.next() < 0.4 ? sub(3 + id * 2) : div(2);
      [left, right] = side ? [up, other] : [other, up];
    } else {
      const good = rng.next() < 0.3 ? mul(2) : add(4 + id);
      // traps must matter against a big squad: usually they halve or third it, only sometimes a flat loss
      const bad = rng.next() < 0.25 ? sub(3 + id * 2) : rng.next() < 0.55 ? div(2) : div(3);
      [left, right] = side ? [good, bad] : [bad, good];
    }
    b.gates(left, right);
    const roll = rng.next();
    if (roll < 0.45) b.block(rewardX, Math.round(14 * scale * prog), soldiers(Math.round(6 * Math.pow(1.1, id))));
    else if (roll < 0.75) b.counter(rewardX * 1.1, 3 + Math.floor(id / 2), 1, 30 + id * 4, 12);
    else b.block(rewardX, Math.round(16 * scale * prog), weapons[Math.floor(rng.next() * weapons.length)]);
  }
  // the last level of a world ends with a mega horde (an endless red mass, as in the ads)
  if (id % 4 === 0) {
    b.horde(1, 'elite', { x: 0, w: 1.0, after: 14 }); // a Warlord leads the carpet
    b.swarm(80 + id * 40, 'grunt', 22);
  }
  b.horde(Math.round(14 * scale), 'grunt', { after: 18 });
  return b.build(id, NAMES[id - 1] ?? `Level ${id}`, Math.round(260 * id * 1.3), 20 + id * 5, undefined, 4 + id * 1.2);
}

// --- Bonus levels: one after each world. Jackpot = giant blocks with absurd reward packs and no danger;
// swarm = a power-fantasy horde of hundreds to thousands. Ids 101+ keep them out of the regular numbering. ---
function jackpot(id: number, world: number, name: string, big: number): LevelDef {
  const w = { w: 6, after: 16 };
  return new LevelBuilder(1)
    .meta({ bonus: 'jackpot', world })
    .gates(add(10), mul(2), 12)
    .block(0, Math.round(200 * big), multi('POWER UP', soldiers(40), dmgUp), w)
    .gates(mul(2), mul(3), 12)
    .block(0, Math.round(4000 * big), multi('RAPID FIRE', soldiers(70), rateUp, pierceUp), w)
    .counter(0, 30, 4, 320, 14)
    .block(0, Math.round(7000 * big), multi('ARSENAL', soldiers(110), rocket, dmgUp), w)
    .gates(mul(2), mul(2), 12)
    .block(0, Math.round(13000 * big), multi('MEGA PACK', soldiers(150), rateUp, dmgUp, laser), w)
    .block(0, Math.round(24000 * big), multi('JACKPOT!!!', soldiers(300), dmgUp, rateUp, dmgUp, rateUp), { w: 6, after: 20 })
    .build(id, name, 0, 60, 1, 0);
}

function swarmBonus(id: number, world: number, name: string, sizes: [number, number, number], K: (id: number) => number): LevelDef {
  const hpMul = 1 + 0.15 * (world * 4);
  return new LevelBuilder(K(id))
    .meta({ bonus: 'swarm', world })
    .gates(mul(3), mul(2), 12)
    .block(0, 150, multi('ROCKET PACK', rocket, soldiers(60), dmgUp), { w: 6, after: 16 })
    .swarm(sizes[0], 'grunt', 22, 26)
    .gates(mul(2), add(80), 12)
    .swarm(sizes[1], 'grunt', 22, 26)
    .gates(mul(2), mul(2), 12)
    .swarm(sizes[2], 'grunt', 20, 26)
    .build(id, name, 0, 70, hpMul, 0);
}

function makeBonus(K: (id: number) => number): Record<number, LevelDef> {
  return {
    4: jackpot(101, 0, 'Jackpot Vault', 1),
    8: swarmBonus(102, 1, 'Horde Slaughter', [700, 1100, 1500], K),
    12: jackpot(103, 2, 'Treasure Glacier', 1.1),
    16: swarmBonus(104, 3, 'Inferno Swarm', [1000, 1600, 2200], K),
  };
}

/** Build all levels in play order (a bonus level follows each world); `over` lets the tuner try other multipliers. */
export function makeLevels(over: Overrides = {}, variantOver: Overrides = {}): LevelDef[] {
  const K = (id: number) => over[id] ?? (tuned as Record<string, number>)[String(id)] ?? 1;
  const ids = Array.from({ length: LEVEL_COUNT - 3 }, (_, i) => i + 4);
  const regular = [...makeHand(K), ...ids.map((id) => generated(id, K, variantOver[id]))];
  const bonus = makeBonus(K);
  const sieges = siegeParams();
  // after each world: its bonus level, then its siege
  return regular.flatMap((l) => [l, ...(bonus[l.id] ? [bonus[l.id]] : []), ...(sieges[l.id] ? [siege(sieges[l.id], K(sieges[l.id].id))] : [])]);
}

export const LEVELS: LevelDef[] = makeLevels();
