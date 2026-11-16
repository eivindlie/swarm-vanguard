import { describe, expect, it } from 'vitest';
import { Game, applyGate, gateScore } from '../src/sim/game';
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
    expect(unlockedCount(loadSave(), LEVELS)).toBe(1);
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

describe('new mechanics', () => {
  it('an upgrade gate changes the weapon and not the head count', () => {
    const g = new Game(
      tiny([{ t: 'gates', y: 10, left: { op: 'upgrade', value: 0, upgrade: { kind: 'weaponType', weapon: 'rocket' }, label: 'ROCKETS' }, right: { op: 'add', value: 5 } }]),
      1,
    );
    for (let i = 0; i < 300; i++) g.step({ targetX: -2 });
    expect(g.weapon).toBe('rocket');
    expect(g.squad.count).toBe(5);
  });
  it('a stat upgrade gate adds a modifier', () => {
    const g = new Game(
      tiny([{ t: 'gates', y: 10, left: { op: 'upgrade', value: 0, upgrade: { kind: 'stat', stat: 'damage', mul: 2 }, label: 'DMG' }, right: { op: 'add', value: 5 } }]),
      1,
    );
    const before = g.stat('damage');
    for (let i = 0; i < 300; i++) g.step({ targetX: -2 });
    expect(g.stat('damage')).toBeCloseTo(before * 2, 5);
  });
  it('a barrel explodes when shot and kills the enemies standing next to it', () => {
    const g = withSquad(
      [
        { t: 'barrel', y: 14, x: 0 },
        { t: 'enemies', y: 14.8, x: 0, spreadX: 1, spreadY: 0.5, count: 8, kind: 'grunt' },
      ],
      8,
    );
    let boom = 0;
    for (let i = 0; i < 400 && g.barrels.length; i++) {
      g.step({ targetX: 0 });
      boom += g.events.filter((e) => e.t === 'explosion').length;
    }
    expect(boom).toBeGreaterThan(0);
    expect(g.kills).toBeGreaterThanOrEqual(6);
  });
  it('a splitter bursts into three minis when shot', () => {
    const g = withSquad([{ t: 'enemies', y: 22, x: 0, spreadX: 0, spreadY: 0, count: 1, kind: 'splitter' }], 12);
    let sawMini = 0;
    for (let i = 0; i < 400; i++) {
      g.step({ targetX: 0 });
      sawMini = Math.max(sawMini, g.enemies.filter((e) => e.kind === 'mini').length);
    }
    expect(sawMini).toBe(3);
  });
  it('the boss calls in reinforcements at 66% and 33% HP, once each', () => {
    const lvl: LevelDef = { id: 97, name: 'b', length: 30, coins: 1, bossAdds: 6, spawns: [{ t: 'enemies', y: 40, x: 0, spreadX: 0, spreadY: 0, count: 1, kind: 'boss', hp: 600 }] };
    const g = new Game(lvl, 1, [{ stat: 'startSize', add: 25 }]);
    let waves = 0;
    for (let i = 0; i < 3000 && g.phase === 'playing'; i++) {
      g.step({ targetX: 0 });
      waves += g.events.filter((e) => e.t === 'bossAdds').length;
    }
    expect(waves).toBe(2);
  });
  it('gateScore values an upgrade between nothing and a real gain', () => {
    const up = { op: 'upgrade', value: 0 } as const;
    expect(gateScore(20, up)).toBeGreaterThan(20);
    expect(gateScore(20, { op: 'add', value: 30 })).toBeGreaterThan(gateScore(20, up));
  });
});

import { recordWin, unlockedCount } from '../src/meta/save';
import tunedJson from '../src/levels/tuned.json';
import { LEVEL_COUNT } from '../src/levels';
import { policies, toInput } from '../src/sim/bots';

describe('bonus levels and jackpot rewards', () => {
  it('a multi reward applies every part at once', () => {
    const g = new Game(
      tiny([
        {
          t: 'block', y: 8, x: 0, w: 6, hp: 3,
          reward: { kind: 'multi', label: 'PACK', rewards: [{ kind: 'soldiers', n: 40 }, { kind: 'weapon', stat: 'damage', mul: 2, label: 'd' }, { kind: 'weaponType', weapon: 'laser', label: 'L' }] },
        },
      ]),
      1,
    );
    const dmg = g.stat('damage');
    for (let i = 0; i < 400 && g.blocks.length; i++) g.step({ targetX: 0 });
    expect(g.squad.count).toBeGreaterThanOrEqual(40);
    expect(g.stat('damage')).toBeCloseTo(dmg * 2, 5);
    expect(g.weapon).toBe('laser');
  });
  it('the game has 16 regular levels plus optional levels after each world, with unique ids', () => {
    expect(LEVELS.filter((l) => !l.bonus)).toHaveLength(LEVEL_COUNT);
    expect(LEVELS.filter((l) => l.bonus && l.bonus !== 'siege')).toHaveLength(4);
    expect(LEVELS.filter((l) => l.bonus === 'siege').length).toBeGreaterThanOrEqual(1);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
    // every optional level sits right after a world's fourth level (or after another optional one)
    for (const [i, l] of LEVELS.entries()) {
      if (!l.bonus) continue;
      let j = i - 1;
      while (LEVELS[j].bonus) j--;
      expect(LEVELS[j].id % 4, `${l.name} follows level ${LEVELS[j].id}`).toBe(0);
    }
  });
  it('bonus levels have no boss and bots clear them', () => {
    for (const l of LEVELS.filter((x) => x.bonus && x.bonus !== 'siege')) {
      expect(l.spawns.some((s) => s.t === 'enemies' && s.kind === 'boss')).toBe(false);
      const g = new Game(l, 1);
      while (g.phase === 'playing' && g.tick < 20000) g.step({ targetX: 0 });
      expect(g.phase, l.name).toBe('won');
    }
  });
  it('unlocks are derived from cleared levels: optional levels never block, however many come in a row', () => {
    const lv = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 101, bonus: true }, { id: 201, bonus: true }, { id: 5 }, { id: 6 }];
    const s = loadSave();
    expect(unlockedCount(s, lv)).toBe(1); // nothing cleared: only level 1
    for (const id of [1, 2, 3]) s.stars[id] = 3;
    expect(unlockedCount(s, lv)).toBe(4); // level 4 is the frontier
    s.stars[4] = 2;
    // the bonus AND the siege are open, and level 5 (position 7) is the continue target, not the siege
    expect(unlockedCount(s, lv)).toBe(7);
    s.stars[5] = 1;
    expect(unlockedCount(s, lv)).toBe(8);
    s.stars[6] = 1;
    expect(unlockedCount(s, lv)).toBe(lv.length); // all cleared
  });
  it('a v1 save (position-based unlockedLevel) migrates without losing progress', () => {
    // vitest runs in Node: provide a tiny localStorage
    const store = new Map<string, string>();
    (globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    localStorage.setItem('swarmvanguard.save', JSON.stringify({ version: 1, unlockedLevel: 11, coins: 123, stars: { 1: 3, 2: 3, 3: 2, 4: 3, 5: 3, 6: 2, 7: 3, 8: 3, 9: 1, 10: 2 }, upgrades: { size: 2 } }));
    const s = loadSave();
    expect(s.version).toBe(2);
    expect(s.coins).toBe(123);
    expect(s.upgrades.size).toBe(2);
    // levels 1-10 were cleared: the next regular level (id 11) is the frontier, wherever the optional levels sit
    const front = unlockedCount(s, LEVELS) - 1;
    expect(LEVELS[front].id).toBe(11);
    delete (globalThis as any).localStorage;
  });
  it('bonus coins add to the reward', () => {
    const a = loadSave();
    const b = loadSave();
    const ra = recordWin(a, 101, 60, 100, 100, 0);
    const rb = recordWin(b, 101, 60, 100, 100, 180);
    expect(rb.coins - ra.coins).toBe(180);
  });
});

describe('blocks are walls the squad can break', () => {
  it('a big pinned squad breaks a lane-wide block in about hp / dps (bullets start in front of the block)', () => {
    const hp = 3000;
    const lvl: LevelDef = { id: 90, name: 'pin', length: 80, coins: 1, spawns: [{ t: 'block', y: 14, x: 0, w: 6, hp, reward: { kind: 'soldiers', n: 1 } }] };
    for (const n of [60, 150, 300]) {
      const g = new Game(lvl, 1, [{ stat: 'startSize', add: n - 5 }]);
      while (g.phase === 'playing' && g.blocks.length && g.tick < 6000) g.step({ targetX: 0 });
      const ideal = hp / ((g.stat('damage') * n) / g.stat('fireInterval'));
      expect(g.blocks.length, `${n} soldiers never broke the block`).toBe(0);
      expect(g.tick / 60, `${n} soldiers`).toBeLessThan(ideal * 1.4 + 4);
    }
  });
});

describe('elites and carpets', () => {
  it('an elite survives contact and grinds the squad until it is killed', () => {
    const g = withSquad([{ t: 'enemies', y: 14, x: 0, spreadX: 0, spreadY: 0, count: 1, kind: 'elite', hp: 99999 }], 40);
    const start = g.squad.count;
    for (let i = 0; i < 400 && g.phase === 'playing'; i++) g.step({ targetX: 0 });
    expect(g.enemies.some((e) => e.kind === 'elite')).toBe(true); // still alive
    expect(g.squad.count).toBeLessThan(start); // and it ate soldiers
  });
  it('an elite can be shot down, and the kill event carries its id', () => {
    const g = withSquad([{ t: 'enemies', y: 25, x: 0, spreadX: 0, spreadY: 0, count: 1, kind: 'elite' }], 60);
    let killId = 0;
    for (let i = 0; i < 900 && g.enemies.length; i++) {
      g.step({ targetX: 0 });
      for (const e of g.events) if (e.t === 'kill' && e.kind === 'elite') killId = e.id;
    }
    expect(g.enemies.length).toBe(0);
    expect(killId).toBeGreaterThan(0);
  });
  it('grid carpets pack into rows across the lane without overlapping bodies', () => {
    const g = new Game(tiny([{ t: 'enemies', y: 30, x: 0, spreadX: 3.7, spreadY: 5, count: 140, kind: 'grunt', grid: true }], 200), 1);
    const es = g.enemies;
    expect(es.length).toBe(140);
    for (const e of es) expect(Math.abs(e.x)).toBeLessThanOrEqual(3.7 + 0.01);
    let minD = Infinity;
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) minD = Math.min(minD, Math.hypot(es[i].x - es[j].x, es[i].y - es[j].y));
    expect(minD).toBeGreaterThan(0.25);
    const ys = new Set(es.map((e) => Math.round(e.y / 0.55)));
    expect(ys.size).toBeGreaterThanOrEqual(8); // ~10 rows of 14
  });
});

describe('an elite pins the squad', () => {
  it('the squad stops advancing while an elite touches it and moves on once the elite is dead', () => {
    const g = withSquad([{ t: 'enemies', y: 14, x: 0, spreadX: 0, spreadY: 0, count: 1, kind: 'elite', hp: 500 }], 250);
    let pinnedY = -1;
    let pinnedTicks = 0;
    for (let i = 0; i < 1500 && g.phase === 'playing'; i++) {
      const y0 = g.squad.y;
      g.step({ targetX: 0 });
      if (g.enemies.some((e) => e.kind === 'elite') && Math.abs(g.squad.y - y0) < 1e-9 && g.tick > 20) {
        pinnedTicks++;
        pinnedY = g.squad.y;
      }
    }
    expect(pinnedTicks).toBeGreaterThan(10); // it did hold the squad for a while
    expect(g.enemies.some((e) => e.kind === 'elite')).toBe(false); // and was killed
    expect(g.squad.y).toBeGreaterThan(pinnedY); // the squad resumed its advance
  });
});

describe('siege (arena) rules', () => {
  const arena = {
    half: 5.5, depth: 24, minY: 1, maxY: 8, bottom: -1.5, startX: 0, startY: 2,
    escalate: { every: 1e9, count: 20, growth: 1.1, kind: 'grunt' as const }, // off here: the real levels escalate so runs end
  };
  const siegeLevel = (spawns: LevelDef['spawns']): LevelDef => ({ id: 299, name: 's', length: 24, coins: 1, spawns, bonus: 'siege', arena });
  const keystone = (hp = 300): LevelDef['spawns'][number] => ({
    t: 'block', x: 3.9, y: 19.2, w: 2.4, hp, keystone: true, reward: { kind: 'multi', label: 'COLLAPSE', rewards: [{ kind: 'soldiers', n: 10 }] },
  });

  it('the squad does not advance on its own; it walks freely in y within its range', () => {
    const g = new Game(siegeLevel([keystone()]), 1);
    for (let i = 0; i < 120; i++) g.step({ targetX: 0 });
    expect(g.squad.y).toBeCloseTo(2, 5); // no auto-advance
    for (let i = 0; i < 300; i++) g.step({ targetX: 0, targetY: 50 });
    expect(g.squad.y).toBeCloseTo(arena.maxY, 5); // clamped well below the nest
    for (let i = 0; i < 300; i++) g.step({ targetX: 0, targetY: -50 });
    expect(g.squad.y).toBeCloseTo(arena.minY, 5);
  });

  it('lane levels ignore targetY', () => {
    const g = new Game(tiny([]), 1);
    for (let i = 0; i < 60; i++) g.step({ targetX: 0, targetY: 5 });
    expect(g.squad.y).toBeGreaterThan(3.5); // it advanced on its own at 4 u/s
    expect(g.squad.y).toBeLessThan(4.5);
  });

  it('waves spawn awake at their time and walk south; one that reaches the bottom line costs a soldier', () => {
    const g = new Game(siegeLevel([keystone(), { t: 'wave', at: 1, count: 1, kind: 'grunt', x: -5, spreadX: 0 }]), 1);
    for (let i = 0; i < 50; i++) g.step({ targetX: 5, targetY: 8 });
    expect(g.enemies.length).toBe(0); // not yet
    let leaked = 0;
    let spawned = false;
    const start = g.squad.count;
    for (let i = 0; i < 1500; i++) {
      g.step({ targetX: 5, targetY: 8 }); // the squad stays far from the enemy's column
      if (g.enemies.length) spawned = true;
      if (spawned && g.enemies[0]) expect(g.enemies[0].awake).toBe(true);
      leaked += g.events.filter((e) => e.t === 'leak').length;
    }
    expect(spawned).toBe(true);
    expect(leaked).toBe(1);
    expect(g.squad.count).toBeLessThanOrEqual(start - 1);
    expect(g.enemies.length).toBe(0);
  });

  it('destroying the keystone wins at once, crushes everything alive and announces the collapse', () => {
    const g = new Game(siegeLevel([keystone(60), { t: 'wave', at: 0.2, count: 12, kind: 'grunt', x: -3, spreadX: 1 }]), 1, [{ stat: 'startSize', add: 40 }]);
    let collapse = 0;
    for (let i = 0; i < 1800 && g.phase === 'playing'; i++) {
      g.step({ targetX: 3.9, targetY: 3 });
      collapse += g.events.filter((e) => e.t === 'collapse').length;
    }
    expect(g.phase).toBe('won');
    expect(collapse).toBe(1);
    expect(g.enemies.length).toBe(0);
  });

  it('floor tiles are collected by walking over them', () => {
    const g = new Game(siegeLevel([keystone(), { t: 'tile', x: -4, y: 5, value: 10 }, { t: 'tile', x: 4, y: 3, value: 1 }]), 1);
    const start = g.squad.count;
    for (let i = 0; i < 200; i++) g.step({ targetX: -4, targetY: 5 });
    expect(g.pickups.length).toBe(1);
    expect(g.squad.count).toBe(start + 10);
    for (let i = 0; i < 200; i++) g.step({ targetX: 4, targetY: 3 });
    expect(g.pickups.length).toBe(0);
    expect(g.squad.count).toBe(start + 11);
  });

  it('crates and tiles are not culled when they end up behind the squad', () => {
    const g = new Game(siegeLevel([keystone(), { t: 'block', x: -4, y: 1.5, w: 2, hp: 99999, reward: { kind: 'soldiers', n: 5 } }, { t: 'tile', x: 4, y: 1.2, value: 3 }]), 1);
    for (let i = 0; i < 300; i++) g.step({ targetX: 0, targetY: 8 }); // walk far above them
    expect(g.blocks.some((b) => !b.keystone)).toBe(true);
    expect(g.pickups.length).toBe(1);
  });

  it('every policy ends the first siege (waves escalate), standing still or parking loses and balanced wins', () => {
    const lvl = LEVELS.find((l) => l.id === 201)!;
    const results: Record<string, { won: number; unfinished: number }> = {};
    for (const name of ['naive', 'park', 'pure-fight', 'greedy-expand', 'balanced']) {
      results[name] = { won: 0, unfinished: 0 };
      for (let seed = 1; seed <= 4; seed++) {
        const g = new Game(lvl, seed);
        while (g.phase === 'playing' && g.tick < 40000) g.step(toInput(policies[name](g)));
        if (g.phase === 'playing') results[name].unfinished++;
        if (g.phase === 'won') results[name].won++;
      }
    }
    for (const name of Object.keys(results)) expect(results[name].unfinished, `${name} never finished`).toBe(0);
    expect(results.naive.won).toBe(0);
    expect(results.park.won).toBe(0);
    expect(results.balanced.won).toBeGreaterThanOrEqual(3);
  });
});

describe('level data hygiene', () => {
  it('every regular level above 1 has a tuned difficulty (a missing entry silently means k = 1)', () => {
    for (let id = 2; id <= LEVEL_COUNT; id++) expect((tunedJson as Record<string, number>)[String(id)], `level ${id}`).toBeGreaterThan(0);
  });
  it('the first minute of every regular level is survivable for the balanced bot (no lethal first wave)', () => {
    for (const l of LEVELS.filter((x) => !x.bonus)) {
      const g = new Game(l, 1);
      for (let i = 0; i < 300 && g.phase === 'playing'; i++) g.step(toInput(policies.balanced(g)));
      expect(g.phase, `${l.name} (${l.id})`).toBe('playing');
      expect(g.squad.count, `${l.name} (${l.id}) squad after 5 s`).toBeGreaterThanOrEqual(5);
    }
  });
});
