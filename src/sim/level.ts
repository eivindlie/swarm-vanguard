export type GateOp = 'add' | 'mul' | 'sub' | 'div';
export interface GateSide {
  op: GateOp;
  value: number;
}
export type EnemyKind = 'grunt' | 'runner' | 'brute' | 'boss';

export type WeaponType = 'rifle' | 'shotgun' | 'rocket' | 'laser';

export type BlockReward =
  | { kind: 'soldiers'; n: number }
  | { kind: 'weaponType'; weapon: WeaponType; label: string }
  | { kind: 'weapon'; stat: 'damage' | 'fireInterval' | 'pierce' | 'spread'; add?: number; mul?: number; label: string };

export type Spawn =
  | { t: 'enemies'; y: number; x: number; spreadX: number; spreadY: number; count: number; kind: EnemyKind; hp?: number }
  /** Counting block: value grows with every bullet that hits it; collected by walking through it. */
  | { t: 'counter'; y: number; x: number; w: number; start: number; perHit: number; max: number }
  | { t: 'gates'; y: number; left: GateSide; right: GateSide }
  | { t: 'block'; y: number; x: number; w: number; hp: number; reward: BlockReward };

export interface LevelDef {
  id: number;
  name: string;
  length: number; // distance along lane to the finish line
  spawns: Spawn[];
  coins: number; // reward for clearing (meta-ready)
  hpMul?: number; // enemy HP multiplier for this level (grunts/runners/brutes)
}
