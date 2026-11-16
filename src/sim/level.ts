export type WeaponType = 'rifle' | 'shotgun' | 'rocket' | 'laser';

/** What an upgrade gate gives instead of changing the head count. */
export type Upgrade =
  | { kind: 'weaponType'; weapon: WeaponType }
  | { kind: 'stat'; stat: 'damage' | 'fireInterval' | 'pierce' | 'spread'; add?: number; mul?: number };

export type GateOp = 'add' | 'mul' | 'sub' | 'div' | 'upgrade';
export interface GateSide {
  op: GateOp;
  value: number;
  upgrade?: Upgrade; // only for op === 'upgrade'
  label?: string;
}
// splitter: bursts into three minis when shot; mini: small fast swarm unit
export type EnemyKind = 'grunt' | 'runner' | 'brute' | 'splitter' | 'mini' | 'boss';

export type BlockReward =
  | { kind: 'soldiers'; n: number }
  | { kind: 'weaponType'; weapon: WeaponType; label: string }
  | { kind: 'weapon'; stat: 'damage' | 'fireInterval' | 'pierce' | 'spread'; add?: number; mul?: number; label: string };

export type Spawn =
  | { t: 'enemies'; y: number; x: number; spreadX: number; spreadY: number; count: number; kind: EnemyKind; hp?: number }
  /** Counting block: value grows with every bullet that hits it; collected by walking through it. */
  | { t: 'counter'; y: number; x: number; w: number; start: number; perHit: number; max: number }
  | { t: 'gates'; y: number; left: GateSide; right: GateSide }
  /** Explosive barrel: shoot it while enemies stand next to it. */
  | { t: 'barrel'; y: number; x: number }
  | { t: 'block'; y: number; x: number; w: number; hp: number; reward: BlockReward };

export interface LevelDef {
  id: number;
  name: string;
  length: number; // distance along lane to the finish line
  spawns: Spawn[];
  coins: number; // reward for clearing (meta-ready)
  hpMul?: number; // enemy HP multiplier for this level (grunts/runners/brutes)
  bossAdds?: number; // grunts the boss calls in at 66% and 33% HP (already scaled by the level's difficulty)
}
