import type { BlockReward, EnemyKind, GateSide, LevelDef, Spawn, WeaponType } from '../sim/level';

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
  build(id: number, name: string, bossHp: number, coins: number, hpMul = 1 + 0.15 * (id - 1), bossAdds = 0): LevelDef {
    const length = this.y + 14;
    this.spawns.push({ t: 'enemies', y: length + 12, x: 0, spreadX: 0, spreadY: 0, count: 1, kind: 'boss', hp: Math.round(bossHp * this.k) });
    return { id, name, length, spawns: this.spawns, coins, hpMul, bossAdds: Math.round(bossAdds * this.k) };
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
export const upRate: GateSide = { op: 'upgrade', value: 0, upgrade: { kind: 'stat', stat: 'fireInterval', mul: 0.8 }, label: 'FAST +25%' };
export const upPierce: GateSide = { op: 'upgrade', value: 0, upgrade: { kind: 'stat', stat: 'pierce', add: 1 }, label: 'PIERCE' };
export const soldiers = (n: number): BlockReward => ({ kind: 'soldiers', n });
export const dmgUp: BlockReward = { kind: 'weapon', stat: 'damage', mul: 1.4, label: 'DMG +40%' };
export const rateUp: BlockReward = { kind: 'weapon', stat: 'fireInterval', mul: 0.8, label: 'FAST +25%' };
export const pierceUp: BlockReward = { kind: 'weapon', stat: 'pierce', add: 1, label: 'PIERCE' };
export const shotgun: BlockReward = { kind: 'weaponType', weapon: 'shotgun', label: 'SHOTGUN' };
export const rocket: BlockReward = { kind: 'weaponType', weapon: 'rocket', label: 'ROCKETS' };
export const laser: BlockReward = { kind: 'weaponType', weapon: 'laser', label: 'LASER' };
export const spreadUp: BlockReward = { kind: 'weapon', stat: 'spread', add: 0.1, label: 'SPREAD' };
