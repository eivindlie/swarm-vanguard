import { Rng } from './rng';
import { computeStat, type Modifier } from './stats';
import type { BlockReward, EnemyKind, GateSide, LevelDef } from './level';

export const DT = 1 / 60;
export const LANE_HALF = 4; // lane spans x in [-4, 4]
export const FORWARD_SPEED = 4;
export const LATERAL_SPEED = 9;
export const ACTIVATE_DIST = 32; // enemies wake up when this close
export const MAX_SHOTS = 16;
export const BULLET_RANGE = 22;
export const MAX_SQUAD = 300; // hard cap: keeps rendering/balance sane

export interface EnemyDef {
  hp: number;
  speed: number;
  contactDmg: number;
  radius: number;
}
export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  grunt: { hp: 3, speed: 2, contactDmg: 1, radius: 0.3 },
  runner: { hp: 2, speed: 4.5, contactDmg: 1, radius: 0.28 },
  brute: { hp: 24, speed: 1.4, contactDmg: 6, radius: 0.65 },
  boss: { hp: 400, speed: 0.8, contactDmg: 14, radius: 1.6 }, // contactDmg = soldiers lost per second while touching
};

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  awake: boolean;
  wobble: number;
}
export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  dmg: number;
  pierce: number;
  born: number;
}
export interface Block {
  id: number;
  x: number;
  y: number;
  w: number;
  d: number;
  hp: number;
  maxHp: number;
  reward: BlockReward;
}
export interface Counter {
  id: number;
  x: number;
  y: number;
  w: number;
  value: number;
  perHit: number;
  max: number;
}
export interface Gate {
  id: number;
  pair: number;
  x: number;
  y: number;
  w: number;
  side: GateSide;
  used: boolean;
}

export type GameEvent =
  | { t: 'shot'; n: number }
  | { t: 'hit'; x: number; y: number }
  | { t: 'kill'; x: number; y: number; kind: EnemyKind }
  | { t: 'blockHit'; x: number; y: number }
  | { t: 'counterHit'; x: number; y: number }
  | { t: 'blockBreak'; x: number; y: number; label: string }
  | { t: 'gate'; x: number; y: number; delta: number; label: string }
  | { t: 'squadHit'; lost: number }
  | { t: 'win' }
  | { t: 'lose' };

export type Phase = 'playing' | 'won' | 'lost';

export interface Input {
  targetX: number;
}

export function gateLabel(s: GateSide): string {
  switch (s.op) {
    case 'add': return `+${s.value}`;
    case 'sub': return `-${s.value}`;
    case 'mul': return `x${s.value}`;
    case 'div': return `/${s.value}`;
  }
}

export function applyGate(count: number, s: GateSide): number {
  switch (s.op) {
    case 'add': return count + s.value;
    case 'sub': return Math.max(0, count - s.value);
    case 'mul': return Math.floor(count * s.value);
    case 'div': return Math.max(0, Math.floor(count / s.value));
  }
}

export class Game {
  readonly level: LevelDef;
  readonly rng: Rng;
  mods: Modifier[];
  tick = 0;
  phase: Phase = 'playing';
  squad = { x: 0, y: 0, count: 0, startCount: 0, maxCount: 0 };
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  blocks: Block[] = [];
  gates: Gate[] = [];
  counters: Counter[] = [];
  events: GameEvent[] = [];
  kills = 0;
  private fireCd = 0;
  private grindAcc = 0;
  private nextId = 1;
  private spawnIdx = 0;
  private pendingSpawns: LevelDef['spawns'];
  private grid = new Map<number, Enemy[]>();

  constructor(level: LevelDef, seed = 1, mods: Modifier[] = []) {
    this.level = level;
    this.rng = new Rng(seed);
    this.mods = [...mods];
    this.pendingSpawns = [...level.spawns].sort((a, b) => a.y - b.y);
    const start = Math.round(computeStat('startSize', this.mods));
    this.squad.count = start;
    this.squad.startCount = start;
    this.squad.maxCount = start;
    // Pre-spawn everything near the start; the rest streams in ahead of the squad.
    this.streamSpawns();
  }

  get time(): number {
    return this.tick * DT;
  }

  stat(k: Parameters<typeof computeStat>[0]): number {
    return computeStat(k, this.mods);
  }

  squadRadius(): number {
    return Math.min(2.3, 0.4 + 0.2 * Math.sqrt(this.squad.count));
  }

  private streamSpawns(): void {
    const horizon = this.squad.y + 70;
    while (this.spawnIdx < this.pendingSpawns.length && this.pendingSpawns[this.spawnIdx].y <= horizon) {
      this.spawn(this.pendingSpawns[this.spawnIdx++]);
    }
  }

  /** Debug/test helper: drop `count` enemies just ahead of the squad. */
  debugSpawn(kind: EnemyKind, count: number, ahead = 14): void {
    this.spawn({ t: 'enemies', y: this.squad.y + ahead, x: 0, spreadX: LANE_HALF - 0.4, spreadY: 10, count, kind });
  }

  private spawn(s: LevelDef['spawns'][number]): void {
    if (s.t === 'enemies') {
      const def = ENEMY_DEFS[s.kind];
      for (let i = 0; i < s.count; i++) {
        this.enemies.push({
          id: this.nextId++,
          kind: s.kind,
          x: clamp(s.x + this.rng.range(-s.spreadX, s.spreadX), -LANE_HALF + 0.3, LANE_HALF - 0.3),
          y: s.y + this.rng.range(0, s.spreadY),
          hp: s.hp ?? def.hp * (this.level.hpMul ?? 1),
          maxHp: s.hp ?? def.hp * (this.level.hpMul ?? 1),
          awake: false,
          wobble: this.rng.range(0, 6.28),
        });
      }
    } else if (s.t === 'counter') {
      this.counters.push({ id: this.nextId++, x: s.x, y: s.y, w: s.w, value: s.start, perHit: s.perHit, max: s.max });
    } else if (s.t === 'gates') {
      const pair = this.nextId++;
      this.gates.push({ id: this.nextId++, pair, x: -LANE_HALF / 2, y: s.y, w: LANE_HALF, side: s.left, used: false });
      this.gates.push({ id: this.nextId++, pair, x: LANE_HALF / 2, y: s.y, w: LANE_HALF, side: s.right, used: false });
    } else {
      this.blocks.push({
        id: this.nextId++, x: s.x, y: s.y, w: s.w, d: 1.2, hp: s.hp, maxHp: s.hp, reward: s.reward,
      });
    }
  }

  private buildGrid(): void {
    this.grid.clear();
    for (const e of this.enemies) {
      const k = cellKey(e.x, e.y);
      const arr = this.grid.get(k);
      if (arr) arr.push(e);
      else this.grid.set(k, [e]);
    }
  }

  step(input: Input): void {
    if (this.phase !== 'playing') return;
    this.events.length = 0;
    this.tick++;
    const sq = this.squad;

    // --- squad lateral movement (clamped to lane) ---
    const maxX = LANE_HALF - this.squadRadius() * 0.6;
    const tx = clamp(input.targetX, -maxX, maxX);
    const dx = tx - sq.x;
    sq.x += clamp(dx, -LATERAL_SPEED * DT, LATERAL_SPEED * DT);
    sq.x = clamp(sq.x, -maxX, maxX);

    // --- forward movement, blocked by intact blocks directly ahead ---
    let blocked = false;
    const rr = this.squadRadius() * 0.6;
    for (const b of this.blocks) {
      const ahead = b.y - sq.y;
      if (ahead > -0.2 && ahead < 1.2 && Math.abs(b.x - sq.x) < b.w / 2 + rr) {
        blocked = true;
        break;
      }
    }
    // the squad halts at the finish line until the boss is dead
    const bossAlive = this.enemies.some((e) => e.kind === 'boss' && e.hp > 0);
    if (!blocked && !(sq.y >= this.level.length && bossAlive)) sq.y += FORWARD_SPEED * DT;

    this.streamSpawns();

    // --- auto fire ---
    this.fireCd -= DT;
    if (this.fireCd <= 0 && sq.count > 0) {
      this.fire();
      this.fireCd += this.stat('fireInterval');
    }

    this.moveBullets();
    this.moveEnemies();
    this.buildGrid();
    this.bulletCollisions();
    this.contacts();
    this.gateChecks();
    this.counterChecks();
    this.cleanup();

    // --- end conditions ---
    if (sq.count <= 0) {
      sq.count = 0;
      this.phase = 'lost';
      this.events.push({ t: 'lose' });
    } else if (sq.y >= this.level.length && !this.enemies.some((e) => e.kind === 'boss')) {
      this.phase = 'won';
      this.events.push({ t: 'win' });
    }
  }

  private fire(): void {
    const sq = this.squad;
    const shots = Math.min(sq.count, MAX_SHOTS);
    const dmg = (this.stat('damage') * sq.count) / shots;
    const pierce = Math.max(1, Math.round(this.stat('pierce')));
    const spread = this.stat('spread');
    const speed = this.stat('bulletSpeed');
    const width = Math.min(this.squadRadius() * 1.6, 3.2);
    for (let i = 0; i < shots; i++) {
      const f = shots === 1 ? 0 : i / (shots - 1) - 0.5;
      this.bullets.push({
        id: this.nextId++,
        x: sq.x + f * width,
        y: sq.y + 0.5,
        vx: f * spread * speed,
        dmg,
        pierce,
        born: this.tick,
      });
    }
    this.events.push({ t: 'shot', n: shots });
  }

  private moveBullets(): void {
    const speed = this.stat('bulletSpeed');
    for (const b of this.bullets) {
      b.y += speed * DT;
      b.x += b.vx * DT;
    }
  }

  private moveEnemies(): void {
    const sq = this.squad;
    for (const e of this.enemies) {
      const def = ENEMY_DEFS[e.kind];
      if (!e.awake) {
        if (e.y - sq.y < ACTIVATE_DIST) e.awake = true;
        else continue;
      }
      // advance toward the squad, drift sideways toward its x
      e.y -= def.speed * DT;
      const drift = clamp(sq.x - e.x, -1, 1) * def.speed * 0.35 * DT;
      e.x += drift;
      e.wobble += DT * 8;
    }
  }

  private bulletCollisions(): void {
    const range = BULLET_RANGE / this.stat('bulletSpeed') / DT;
    for (const b of this.bullets) {
      if (b.pierce <= 0) continue;
      if (this.tick - b.born > range) {
        b.pierce = 0;
        continue;
      }
      // blocks first (they physically stop bullets)
      let hitBlock = false;
      for (const bl of this.blocks) {
        if (bl.hp <= 0) continue;
        if (Math.abs(b.x - bl.x) < bl.w / 2 && Math.abs(b.y - bl.y) < bl.d / 2 + 0.2) {
          bl.hp -= b.dmg;
          b.pierce = 0;
          hitBlock = true;
          this.events.push({ t: 'blockHit', x: b.x, y: b.y });
          if (bl.hp <= 0) this.breakBlock(bl);
          break;
        }
      }
      if (hitBlock) continue;
      // counting blocks absorb bullets and grow
      let hitCounter = false;
      for (const c of this.counters) {
        if (Math.abs(b.x - c.x) < c.w / 2 && Math.abs(b.y - c.y) < 0.8) {
          c.value = Math.min(c.max, c.value + c.perHit);
          b.pierce = 0;
          hitCounter = true;
          this.events.push({ t: 'counterHit', x: b.x, y: b.y });
          break;
        }
      }
      if (hitCounter) continue;
      // enemies via spatial grid
      const cx = Math.floor(b.x + 8);
      const cy = Math.floor(b.y);
      outer: for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const arr = this.grid.get(gx * 100000 + gy);
          if (!arr) continue;
          for (const e of arr) {
            if (e.hp <= 0) continue;
            const r = ENEMY_DEFS[e.kind].radius + 0.12;
            const ddx = e.x - b.x;
            const ddy = e.y - b.y;
            if (ddx * ddx + ddy * ddy < r * r) {
              e.hp -= b.dmg;
              b.pierce--;
              this.events.push({ t: 'hit', x: e.x, y: e.y });
              if (e.hp <= 0) {
                this.kills++;
                this.events.push({ t: 'kill', x: e.x, y: e.y, kind: e.kind });
              }
              if (b.pierce <= 0) break outer;
            }
          }
        }
      }
    }
  }

  private breakBlock(bl: Block): void {
    const r = bl.reward;
    if (r.kind === 'soldiers') {
      this.squad.count = Math.min(MAX_SQUAD, this.squad.count + r.n);
      this.squad.maxCount = Math.max(this.squad.maxCount, this.squad.count);
      this.events.push({ t: 'blockBreak', x: bl.x, y: bl.y, label: `+${r.n}` });
    } else {
      this.mods.push({ stat: r.stat, add: r.add, mul: r.mul, source: 'block' });
      this.events.push({ t: 'blockBreak', x: bl.x, y: bl.y, label: r.label });
    }
  }

  private contacts(): void {
    const sq = this.squad;
    const r = this.squadRadius();
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const def = ENEMY_DEFS[e.kind];
      const dx = e.x - sq.x;
      const dy = e.y - sq.y;
      const rr = r + def.radius;
      if (dx * dx + dy * dy < rr * rr) {
        if (e.kind === 'boss') {
          // boss grinds the squad down continuously while in contact
          this.grindAcc += def.contactDmg * DT;
          const loss = Math.floor(this.grindAcc);
          if (loss > 0) {
            this.grindAcc -= loss;
            sq.count -= loss;
            this.events.push({ t: 'squadHit', lost: loss });
          }
        } else {
          sq.count -= def.contactDmg;
          e.hp = 0;
          this.kills++;
          this.events.push({ t: 'kill', x: e.x, y: e.y, kind: e.kind });
          this.events.push({ t: 'squadHit', lost: def.contactDmg });
        }
      }
    }
  }

  private gateChecks(): void {
    const sq = this.squad;
    for (const g of this.gates) {
      if (g.used || sq.y < g.y) continue;
      const inside = Math.abs(sq.x - g.x) <= g.w / 2;
      if (!inside) continue;
      for (const o of this.gates) if (o.pair === g.pair) o.used = true;
      const before = sq.count;
      sq.count = Math.min(MAX_SQUAD, applyGate(sq.count, g.side));
      sq.maxCount = Math.max(sq.maxCount, sq.count);
      this.events.push({ t: 'gate', x: g.x, y: g.y, delta: sq.count - before, label: gateLabel(g.side) });
    }
  }

  private counterChecks(): void {
    const sq = this.squad;
    const rr = this.squadRadius() * 0.6;
    for (const c of this.counters) {
      if (c.value <= 0 || sq.y < c.y) continue;
      if (Math.abs(sq.x - c.x) <= c.w / 2 + rr) {
        const gain = Math.floor(c.value);
        sq.count = Math.min(MAX_SQUAD, sq.count + gain);
        sq.maxCount = Math.max(sq.maxCount, sq.count);
        c.value = 0;
        this.events.push({ t: 'gate', x: c.x, y: c.y, delta: gain, label: `+${gain}` });
      }
    }
  }

  private cleanup(): void {
    const sq = this.squad;
    this.enemies = this.enemies.filter((e) => e.hp > 0 && e.y > sq.y - 3);
    this.bullets = this.bullets.filter((b) => b.pierce > 0);
    this.blocks = this.blocks.filter((b) => b.hp > 0 && b.y > sq.y - 3);
    this.gates = this.gates.filter((g) => g.y > sq.y - 3);
    this.counters = this.counters.filter((c) => c.value > 0 && c.y > sq.y - 3);
  }

  /** Compact, serialisable snapshot for the debug API and bots. */
  snapshot() {
    return {
      tick: this.tick,
      time: +this.time.toFixed(2),
      phase: this.phase,
      squad: { x: +this.squad.x.toFixed(2), y: +this.squad.y.toFixed(2), count: this.squad.count },
      progress: +(this.squad.y / this.level.length).toFixed(3),
      enemies: this.enemies.length,
      bullets: this.bullets.length,
      blocks: this.blocks.length,
      boss: (() => { const b = this.enemies.find((e) => e.kind === 'boss'); return b ? { hp: Math.ceil(b.hp), max: b.maxHp } : null; })(),
      kills: this.kills,
    };
  }
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

function cellKey(x: number, y: number): number {
  return Math.floor(x + 8) * 100000 + Math.floor(y);
}
