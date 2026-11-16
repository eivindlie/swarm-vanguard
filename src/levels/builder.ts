import type { BlockReward, EnemyKind, GateSide, LevelDef, Spawn, WeaponType } from '../sim/level';

const LANE_HALF_SPAWN = 3.7;

/** Tiny DSL: each call places something at the cursor and moves the cursor forward. */
export class LevelBuilder {
  spawns: Spawn[] = [];
  y = 20;
  private flip = 1;
  /** Difficulty multiplier on horde sizes / boss HP (set by the balance tuner). */
  constructor(readonly k = 1) {}

  horde(n: number, kind: EnemyKind = 'grunt', o: { x?: number; w?: number; after?: number; hp?: number } = {}) {
    // k scales every enemy type (bosses are single and scale through their HP), so the tuner can move difficulty smoothly
    const count = kind === 'boss' ? n : Math.max(1, Math.round(n * this.k));
    // hordes are columns that alternate sides unless placed explicitly: the player has to steer into them
    if (o.x === undefined) this.flip = -this.flip;
    this.spawns.push({ t: 'enemies', y: this.y, x: o.x ?? this.flip * 1.7, spreadX: o.w ?? 1.7, spreadY: Math.max(2, count / 5), count, kind, hp: o.hp });
    this.y += o.after ?? 9 + count / 12;
    return this;
  }
  gates(left: GateSide, right: GateSide, after = 10) {
    this.spawns.push({ t: 'gates', y: this.y, left, right });
    this.y += after;
    return this;
  }
  block(x: number, hp: number, reward: BlockReward, o: { w?: number; after?: number } = {}) {
    this.spawns.push({ t: 'block', y: this.y, x, w: o.w ?? 3, hp, reward });
    this.y += o.after ?? 10;
    return this;
  }
  /** Explosive barrel at the cursor; `dy` moves it relative to the last item (usually just ahead of a horde). */
  barrel(x: number, dy = 0) {
    this.spawns.push({ t: 'barrel', y: this.y + dy, x });
    return this;
  }
  counter(x: number, start: number, perHit: number, max: number, after = 12) {
    this.spawns.push({ t: 'counter', y: this.y, x, w: 3, start, perHit, max });
    this.y += after;
    return this;
  }
  /** Same position as the previous item, offset along the lane (for combos). */
  skip(d: number) {
    this.y += d;
    return this;
  }
  /** A dense carpet of enemies across the whole lane: the over-the-top "endless red mass" of the ads. */
  swarm(n: number, kind: EnemyKind = 'grunt', after = 24, density = 16) {
    const count = Math.max(1, Math.round(n * this.k));
    // a packed grid carpet: rows of ~14 across the lane, 0.55 apart
    const rows = Math.ceil(count / (Math.floor((2 * LANE_HALF_SPAWN) / 0.55) + 1));
    this.spawns.push({ t: 'enemies', y: this.y, x: 0, spreadX: LANE_HALF_SPAWN, spreadY: Math.max(5, count / density), count, kind, grid: true });
    this.y += after + rows * 0.55;
    return this;
  }
  private extra: Partial<LevelDef> = {};
  /** Level metadata: bonus type and explicit world. */
  meta(m: Partial<LevelDef>) {
    this.extra = m;
    return this;
  }
  build(id: number, name: string, bossHp: number, coins: number, hpMul = 1 + 0.15 * (id - 1), bossAdds = 0): LevelDef {
    const length = this.y + 14;
    if (bossHp > 0) this.spawns.push({ t: 'enemies', y: length + 12, x: 0, spreadX: 0, spreadY: 0, count: 1, kind: 'boss', hp: Math.round(bossHp * this.k) });
    return { id, name, length, spawns: this.spawns, coins, hpMul, bossAdds: Math.round(bossAdds * this.k), ...this.extra };
  }
}

export const add = (value: number): GateSide => ({ op: 'add', value });
export const mul = (value: number): GateSide => ({ op: 'mul', value });
export const sub = (value: number): GateSide => ({ op: 'sub', value });
export const div = (value: number): GateSide => ({ op: 'div', value });
export const upWeapon = (weapon: WeaponType, label: string): GateSide => ({ op: 'upgrade', value: 0, upgrade: { kind: 'weaponType', weapon }, label });
export const upShotgun = upWeapon('shotgun', 'SHOTGUN');
export const upRocket = upWeapon('rocket', 'ROCKETS');
export const upLaser = upWeapon('laser', 'LASER');
export const upDamage: GateSide = { op: 'upgrade', value: 0, upgrade: { kind: 'stat', stat: 'damage', mul: 1.4 }, label: 'DMG +40%' };
/** Temporary buffs (page 2): they run out after a few seconds, so they are worth less than permanent upgrade gates. */
export const upOverdrive: GateSide = { op: 'upgrade', value: 0, upgrade: { kind: 'stat', stat: 'fireInterval', mul: 0.5, secs: 14 }, label: 'OVERDRIVE 14s' };
export const upHeavy: GateSide = { op: 'upgrade', value: 0, upgrade: { kind: 'stat', stat: 'damage', mul: 2, secs: 14 }, label: 'HEAVY ROUNDS 14s' };
export const upRate: GateSide = { op: 'upgrade', value: 0, upgrade: { kind: 'stat', stat: 'fireInterval', mul: 0.8 }, label: 'FAST +25%' };
export const upPierce: GateSide = { op: 'upgrade', value: 0, upgrade: { kind: 'stat', stat: 'pierce', add: 1 }, label: 'PIERCE' };
export const multi = (label: string, ...rewards: BlockReward[]): BlockReward => ({ kind: 'multi', label, rewards });
export const soldiers = (n: number): BlockReward => ({ kind: 'soldiers', n });
export const dmgUp: BlockReward = { kind: 'weapon', stat: 'damage', mul: 1.4, label: 'DMG +40%' };
export const rateUp: BlockReward = { kind: 'weapon', stat: 'fireInterval', mul: 0.8, label: 'FAST +25%' };
export const pierceUp: BlockReward = { kind: 'weapon', stat: 'pierce', add: 1, label: 'PIERCE' };
export const shotgun: BlockReward = { kind: 'weaponType', weapon: 'shotgun', label: 'SHOTGUN' };
export const rocket: BlockReward = { kind: 'weaponType', weapon: 'rocket', label: 'ROCKETS' };
export const laser: BlockReward = { kind: 'weaponType', weapon: 'laser', label: 'LASER' };
export const spreadUp: BlockReward = { kind: 'weapon', stat: 'spread', add: 0.1, label: 'SPREAD' };
