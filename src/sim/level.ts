export type GateOp = 'add' | 'mul' | 'sub' | 'div';
export interface GateSide {
  op: GateOp;
  value: number;
}
export type EnemyKind = 'grunt' | 'runner' | 'brute' | 'boss';

export type BlockReward =
  | { kind: 'soldiers'; n: number }
  | { kind: 'weapon'; stat: 'damage' | 'fireInterval' | 'pierce' | 'spread'; add?: number; mul?: number; label: string };

export type Spawn =
  | { t: 'enemies'; y: number; x: number; spreadX: number; spreadY: number; count: number; kind: EnemyKind }
  | { t: 'gates'; y: number; left: GateSide; right: GateSide }
  | { t: 'block'; y: number; x: number; w: number; hp: number; reward: BlockReward };

export interface LevelDef {
  id: number;
  name: string;
  length: number; // distance along lane to the finish line
  spawns: Spawn[];
  coins: number; // reward for clearing (meta-ready)
}
