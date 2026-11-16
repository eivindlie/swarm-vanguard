import { Rng } from './rng';
import { computeStat, type Modifier } from './stats';
import type { BlockReward, EnemyKind, GateSide, LevelDef, Upgrade, WeaponType } from './level';
import { halfDepth, halfWidth } from './formation';

export const DT = 1 / 60;
export const LANE_HALF = 4; // lane spans x in [-4, 4]
export const FORWARD_SPEED = 4;
export const LATERAL_SPEED = 9;
export const ACTIVATE_DIST = 32; // enemies wake up when this close
export const BULLET_SPACING = 0.4; // max gap between bullets across the squad: no unhittable gaps
export const BULLET_HALF_WIDTH = 0.2;

export interface WeaponDef {
  name: string;
  dmgMul: number; // TOTAL volley damage multiplier (spread over all bullets)
  intervalMul: number;
  speed: number;
  pierce: number; // extra pierce on top of the pierce stat
  cone: number; // total cone angle in radians (0 = straight)
  pelletMul: number; // bullets per volley relative to the width-based count
  range: number;
  splash: number; // explosion radius (0 = none)
}
export const WEAPONS: Record<WeaponType, WeaponDef> = {
  rifle: { name: 'RIFLE', dmgMul: 1, intervalMul: 1, speed: 26, pierce: 0, cone: 0, pelletMul: 1, range: 32, splash: 0 },
  shotgun: { name: 'SHOTGUN', dmgMul: 1.3, intervalMul: 0.9, speed: 23, pierce: 0, cone: 0.8, pelletMul: 3, range: 18, splash: 0 },
  rocket: { name: 'ROCKET', dmgMul: 1.75, intervalMul: 1.7, speed: 15, pierce: 0, cone: 0, pelletMul: 0.5, range: 32, splash: 1.8 },
  laser: { name: 'LASER', dmgMul: 0.8, intervalMul: 0.6, speed: 42, pierce: 5, cone: 0, pelletMul: 1, range: 44, splash: 0 },
};
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
  splitter: { hp: 14, speed: 1.5, contactDmg: 2, radius: 0.5 },
  mini: { hp: 2, speed: 3.2, contactDmg: 1, radius: 0.22 },
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
  vy: number;
  dmg: number;
  pierce: number;
  born: number;
  maxAge: number; // ticks
  kind: WeaponType;
  splash: number;
  hit: number[]; // ids already hit (so piercing bullets pass through each enemy once)
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
export interface Barrel {
  id: number;
  x: number;
  y: number;
  hp: number;
}
export const BARREL_DMG = 16; // explosion damage at hpMul 1
export const BARREL_RADIUS = 2.8;

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
  | { t: 'hit'; x: number; y: number; id: number }
  | { t: 'kill'; x: number; y: number; kind: EnemyKind; id: number }
  | { t: 'blockHit'; x: number; y: number }
  | { t: 'counterHit'; x: number; y: number }
  | { t: 'barrelHit'; x: number; y: number }
  | { t: 'bossAdds'; x: number; y: number }
  | { t: 'blockBreak'; x: number; y: number; label: string; big: boolean; gain: number }
  | { t: 'gate'; x: number; y: number; delta: number; label: string }
  | { t: 'squadHit'; lost: number }
  | { t: 'leak'; x: number; y: number }
  | { t: 'explosion'; x: number; y: number; r: number }
  | { t: 'weapon'; weapon: WeaponType }
  | { t: 'win' }
  | { t: 'lose' };

export type Phase = 'playing' | 'won' | 'lost';

export interface Input {
  targetX: number;
}

/** Soldiers a reward grants (used by the renderer to size the tile cascade). */
export function soldiersIn(r: BlockReward): number {
  if (r.kind === 'soldiers') return r.n;
  if (r.kind === 'multi') return r.rewards.reduce((a, x) => a + soldiersIn(x), 0);
  return 0;
}

export function gateLabel(s: GateSide): string {
  switch (s.op) {
    case 'upgrade': return s.label ?? 'UPGRADE';
    case 'add': return `+${s.value}`;
    case 'sub': return `-${s.value}`;
    case 'mul': return `x${s.value}`;
    case 'div': return `/${s.value}`;
  }
}

/** Rough worth of a gate in soldiers: lets bots (and hints) compare count gates with upgrade gates. */
export function gateScore(count: number, s: GateSide): number {
  return s.op === 'upgrade' ? count + count * 0.3 + 6 : applyGate(count, s);
}

export function applyGate(count: number, s: GateSide): number {
  switch (s.op) {
    case 'upgrade': return count;
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
  barrels: Barrel[] = [];
  events: GameEvent[] = [];
  kills = 0;
  weapon: WeaponType = 'rifle';
  private fireCd = 0;
  private grindAcc = 0;
  private bossPhase = 0;
  private nextId = 1;
  private spawnIdx = 0;
  private pendingSpawns: LevelDef['spawns'];
  private grid = new Map<number, Enemy[]>();
  private bosses: Enemy[] = [];

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

  /** How far the squad centre can move sideways (shrinks as the crowd widens). */
  maxX(): number {
    return Math.max(2.2, LANE_HALF - this.halfWidth() * 0.7);
  }

  halfWidth(): number {
    return halfWidth(this.squad.count);
  }

  halfDepth(): number {
    return halfDepth(this.squad.count);
  }

  private streamSpawns(): void {
    const horizon = this.squad.y + 70;
    while (this.spawnIdx < this.pendingSpawns.length && this.pendingSpawns[this.spawnIdx].y <= horizon) {
      this.spawn(this.pendingSpawns[this.spawnIdx++]);
    }
  }

  /** Debug/test helper: drop `count` enemies just ahead of the squad. */
  debugSpawn(kind: EnemyKind, count: number, ahead = 14, spreadY = 10): void {
    this.spawn({ t: 'enemies', y: this.squad.y + ahead, x: 0, spreadX: LANE_HALF - 0.4, spreadY, count, kind });
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
    } else if (s.t === 'barrel') {
      this.barrels.push({ id: this.nextId++, x: s.x, y: s.y, hp: 5 });
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
    this.bosses.length = 0;
    for (const e of this.enemies) {
      if (e.kind === 'boss') {
        this.bosses.push(e);
        continue;
      }
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
    const maxX = this.maxX();
    const tx = clamp(input.targetX, -maxX, maxX);
    const dx = tx - sq.x;
    sq.x += clamp(dx, -LATERAL_SPEED * DT, LATERAL_SPEED * DT);
    sq.x = clamp(sq.x, -maxX, maxX);

    // --- forward movement, blocked by intact blocks directly ahead ---
    let blocked = false;
    const rr = this.halfWidth() * 0.6;
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
      this.fireCd += this.stat('fireInterval') * WEAPONS[this.weapon].intervalMul;
    }

    this.moveBullets();
    this.moveEnemies();
    this.buildGrid();
    this.bulletCollisions();
    this.bossPhases();
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
    const w = WEAPONS[this.weapon];
    const hw = this.halfWidth();
    const hd = this.halfDepth();
    // enough bullets that the gap between neighbours is <= BULLET_SPACING across the WHOLE squad width
    const base = Math.min(sq.count, Math.max(1, Math.ceil((2 * hw) / BULLET_SPACING)));
    const shots = Math.max(1, Math.round(base * w.pelletMul));
    const dmg = (this.stat('damage') * sq.count * w.dmgMul) / shots;
    const pierce = Math.max(1, Math.round(this.stat('pierce'))) + w.pierce;
    const extraSpread = this.stat('spread');
    const speed = w.speed;
    for (let i = 0; i < shots; i++) {
      const f = shots === 1 ? 0 : i / (shots - 1) - 0.5; // -0.5 .. 0.5 across the squad
      const dx = f * 2 * (hw - 0.2);
      // fire from the front edge of the crowd at that column
      const edge = hd * 0.55 * Math.sqrt(Math.max(0, 1 - (dx / hw) * (dx / hw)));
      let ang = f * extraSpread * 2;
      if (w.cone > 0) ang += (this.rng.next() - 0.5) * w.cone;
      // a block directly ahead is a wall: bullets must start in FRONT of it, otherwise a deep crowd
      // (whose front edge reaches past the block) would shoot over it and never damage it
      let spawnY = sq.y + 0.4 + edge;
      for (const bl of this.blocks) {
        if (bl.hp <= 0 || Math.abs(sq.x + dx - bl.x) >= bl.w / 2) continue;
        const front = bl.y - bl.d / 2 - 0.05;
        if (front > sq.y && spawnY > front) spawnY = front;
      }
      this.bullets.push({
        id: this.nextId++,
        x: sq.x + dx,
        y: spawnY,
        vx: Math.sin(ang) * speed,
        vy: Math.cos(ang) * speed,
        dmg,
        pierce,
        born: this.tick,
        maxAge: Math.ceil(w.range / speed / DT),
        kind: this.weapon,
        splash: w.splash,
        hit: [],
      });
    }
    this.events.push({ t: 'shot', n: shots });
  }

  private moveBullets(): void {
    for (const b of this.bullets) {
      b.y += b.vy * DT;
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
      // arcade rule: enemies walk straight down the lane, no homing
      e.y -= def.speed * DT;
      e.wobble += DT * 8;
    }
  }

  /** First live enemy overlapping the bullet that it has not already hit. */
  private enemyAt(b: Bullet): Enemy | null {
    const cx = Math.floor(b.x + 8);
    const cy = Math.floor(b.y);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const arr = this.grid.get(gx * 100000 + gy);
        if (!arr) continue;
        for (const e of arr) {
          if (e.hp <= 0 || b.hit.includes(e.id)) continue;
          const r = ENEMY_DEFS[e.kind].radius + BULLET_HALF_WIDTH;
          const ddx = e.x - b.x;
          const ddy = e.y - b.y;
          if (ddx * ddx + ddy * ddy < r * r) return e;
        }
      }
    }
    for (const e of this.bosses) {
      if (e.hp <= 0 || b.hit.includes(e.id)) continue;
      const r = ENEMY_DEFS.boss.radius + BULLET_HALF_WIDTH;
      const ddx = e.x - b.x;
      const ddy = e.y - b.y;
      if (ddx * ddx + ddy * ddy < r * r) return e;
    }
    return null;
  }

  private damageEnemy(e: Enemy, dmg: number): void {
    e.hp -= dmg;
    this.events.push({ t: 'hit', x: e.x, y: e.y, id: e.id });
    if (e.hp <= 0) {
      this.kills++;
      this.events.push({ t: 'kill', x: e.x, y: e.y, kind: e.kind, id: e.id });
      if (e.kind === 'splitter') {
        const def = ENEMY_DEFS.mini;
        const hp = def.hp * (this.level.hpMul ?? 1);
        for (let i = 0; i < 3; i++) {
          this.enemies.push({
            id: this.nextId++,
            kind: 'mini',
            x: clamp(e.x + (i - 1) * 0.45 + this.rng.range(-0.1, 0.1), -LANE_HALF + 0.3, LANE_HALF - 0.3),
            y: e.y + this.rng.range(-0.2, 0.4),
            hp,
            maxHp: hp,
            awake: true,
            wobble: this.rng.range(0, 6.28),
          });
        }
      }
    }
  }

  /** At 66% and 33% HP the boss calls in two columns of grunts. */
  private bossPhases(): void {
    const adds = this.level.bossAdds ?? 0;
    if (adds <= 0 || this.bossPhase >= 2) return;
    const boss = this.bosses[0] ?? this.enemies.find((e) => e.kind === 'boss' && e.hp > 0);
    if (!boss || boss.hp <= 0) return;
    const frac = boss.hp / boss.maxHp;
    const need = frac <= 0.33 ? 2 : frac <= 0.66 ? 1 : 0;
    if (need > this.bossPhase) {
      this.bossPhase = need;
      const per = Math.max(1, Math.ceil(adds / 2));
      for (const x of [-1.8, 1.8]) this.spawn({ t: 'enemies', y: boss.y + 3, x, spreadX: 1.0, spreadY: Math.max(2, per / 5), count: per, kind: 'grunt' });
      this.events.push({ t: 'bossAdds', x: boss.x, y: boss.y });
    }
  }

  private explode(x: number, y: number, r: number, dmg: number, skip: Enemy | null): void {
    this.events.push({ t: 'explosion', x, y, r });
    const reach = Math.ceil(r) + 1;
    const cx = Math.floor(x + 8);
    const cy = Math.floor(y);
    for (let gx = cx - reach; gx <= cx + reach; gx++) {
      for (let gy = cy - reach; gy <= cy + reach; gy++) {
        const arr = this.grid.get(gx * 100000 + gy);
        if (!arr) continue;
        for (const e of arr) {
          if (e.hp <= 0 || e === skip) continue;
          const rr = r + ENEMY_DEFS[e.kind].radius;
          const ddx = e.x - x;
          const ddy = e.y - y;
          if (ddx * ddx + ddy * ddy < rr * rr) this.damageEnemy(e, dmg);
        }
      }
    }
    for (const e of this.bosses) {
      if (e.hp <= 0 || e === skip) continue;
      const rr = r + ENEMY_DEFS.boss.radius;
      if ((e.x - x) ** 2 + (e.y - y) ** 2 < rr * rr) this.damageEnemy(e, dmg);
    }
  }

  private bulletCollisions(): void {
    for (const b of this.bullets) {
      if (b.pierce <= 0) continue;
      if (this.tick - b.born > b.maxAge || b.x < -LANE_HALF - 2 || b.x > LANE_HALF + 2) {
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
      // explosive barrels absorb bullets and detonate
      let hitBarrel = false;
      for (const br of this.barrels) {
        if (br.hp <= 0) continue;
        if (Math.abs(b.x - br.x) < 0.6 && Math.abs(b.y - br.y) < 0.6) {
          br.hp -= b.dmg;
          b.pierce = 0;
          hitBarrel = true;
          this.events.push({ t: 'barrelHit', x: br.x, y: br.y });
          if (br.hp <= 0) this.explode(br.x, br.y, BARREL_RADIUS, BARREL_DMG * (this.level.hpMul ?? 1), null);
          break;
        }
      }
      if (hitBarrel) continue;
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
      // enemies: a bullet may hit several in one tick if it pierces
      let e: Enemy | null;
      while (b.pierce > 0 && (e = this.enemyAt(b))) {
        b.hit.push(e.id);
        b.pierce--;
        this.damageEnemy(e, b.dmg);
        if (b.splash > 0) {
          this.explode(b.x, b.y, b.splash, b.dmg * 0.7, e);
          b.pierce = 0; // rockets detonate on the first target
        }
      }
    }
  }

  private breakBlock(bl: Block): void {
    const r = bl.reward;
    this.applyReward(r);
    const label = r.kind === 'soldiers' ? `+${r.n}` : r.label;
    this.events.push({ t: 'blockBreak', x: bl.x, y: bl.y, label, big: bl.maxHp >= 300, gain: soldiersIn(r) });
  }

  private applyReward(r: BlockReward): void {
    if (r.kind === 'soldiers') {
      this.squad.count = Math.min(MAX_SQUAD, this.squad.count + r.n);
      this.squad.maxCount = Math.max(this.squad.maxCount, this.squad.count);
    } else if (r.kind === 'weaponType') {
      this.weapon = r.weapon;
      this.events.push({ t: 'weapon', weapon: r.weapon });
    } else if (r.kind === 'multi') {
      for (const sub of r.rewards) this.applyReward(sub);
    } else {
      this.mods.push({ stat: r.stat, add: r.add, mul: r.mul, source: 'block' });
    }
  }

  private contacts(): void {
    const sq = this.squad;
    const hw = this.halfWidth();
    const hd = this.halfDepth();
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const def = ENEMY_DEFS[e.kind];
      const dx = e.x - sq.x;
      const dy = e.y - sq.y;
      const ax = hw + def.radius * 0.6;
      const ay = hd + def.radius * 0.6;
      const inside = (dx / ax) * (dx / ax) + (dy / ay) * (dy / ay) < 1;
      if (inside) {
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
          this.events.push({ t: 'kill', x: e.x, y: e.y, kind: e.kind, id: e.id });
          this.events.push({ t: 'squadHit', lost: def.contactDmg });
        }
      } else if (e.y < sq.y - hd - 1.2) {
        // slipped past the squad: it reaches the bottom of the screen and costs lives
        this.events.push({ t: 'leak', x: e.x, y: sq.y - hd - 1.2 });
        if (e.kind === 'boss') {
          this.events.push({ t: 'squadHit', lost: sq.count });
          sq.count = 0;
        } else {
          sq.count -= def.contactDmg;
          e.hp = 0;
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
      if (g.side.op === 'upgrade' && g.side.upgrade) this.applyUpgrade(g.side.upgrade);
    }
  }

  private applyUpgrade(u: Upgrade): void {
    if (u.kind === 'weaponType') {
      this.weapon = u.weapon;
      this.events.push({ t: 'weapon', weapon: u.weapon });
    } else {
      this.mods.push({ stat: u.stat, add: u.add, mul: u.mul, source: 'gate' });
    }
  }

  private counterChecks(): void {
    const sq = this.squad;
    const rr = this.halfWidth() * 0.6;
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
    this.enemies = this.enemies.filter((e) => e.hp > 0 && e.y > sq.y - 14);
    this.bullets = this.bullets.filter((b) => b.pierce > 0);
    this.blocks = this.blocks.filter((b) => b.hp > 0 && b.y > sq.y - 3);
    this.gates = this.gates.filter((g) => g.y > sq.y - 3);
    this.counters = this.counters.filter((c) => c.value > 0 && c.y > sq.y - 3);
    this.barrels = this.barrels.filter((b) => b.hp > 0 && b.y > sq.y - 3);
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
