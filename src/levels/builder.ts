import type { BlockReward, EnemyKind, GateSide, LevelDef, Spawn } from '../sim/level';

/** Tiny DSL: each call places something at the cursor and moves the cursor forward. */
export class LevelBuilder {
  spawns: Spawn[] = [];
  y = 20;
  private flip = 1;
  /** Difficulty multiplier on horde sizes / boss HP (set by the balance tuner). */
  constructor(readonly k = 1) {}

  horde(n: number, kind: EnemyKind = 'grunt', o: { x?: number; w?: number; after?: number; hp?: number } = {}) {
    const count = kind === 'grunt' || kind === 'runner' ? Math.max(1, Math.round(n * this.k)) : n;
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
  build(id: number, name: string, bossHp: number, coins: number, hpMul = 1 + 0.15 * (id - 1)): LevelDef {
    const length = this.y + 14;
    this.spawns.push({ t: 'enemies', y: length + 12, x: 0, spreadX: 0, spreadY: 0, count: 1, kind: 'boss', hp: Math.round(bossHp * this.k) });
    return { id, name, length, spawns: this.spawns, coins, hpMul };
  }
}

export const add = (value: number): GateSide => ({ op: 'add', value });
export const mul = (value: number): GateSide => ({ op: 'mul', value });
export const sub = (value: number): GateSide => ({ op: 'sub', value });
export const div = (value: number): GateSide => ({ op: 'div', value });
export const soldiers = (n: number): BlockReward => ({ kind: 'soldiers', n });
export const dmgUp: BlockReward = { kind: 'weapon', stat: 'damage', mul: 1.4, label: 'DMG +40%' };
export const rateUp: BlockReward = { kind: 'weapon', stat: 'fireInterval', mul: 0.8, label: 'FAST +25%' };
export const pierceUp: BlockReward = { kind: 'weapon', stat: 'pierce', add: 1, label: 'PIERCE' };
export const shotgun: BlockReward = { kind: 'weaponType', weapon: 'shotgun', label: 'SHOTGUN' };
export const rocket: BlockReward = { kind: 'weaponType', weapon: 'rocket', label: 'ROCKETS' };
export const laser: BlockReward = { kind: 'weaponType', weapon: 'laser', label: 'LASER' };
export const spreadUp: BlockReward = { kind: 'weapon', stat: 'spread', add: 0.1, label: 'SPREAD' };
