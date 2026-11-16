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
// elite: a hero that does not die on contact but grinds the squad down until it is killed (like the boss)
// bulwark: armoured shield bearer: rifles and shotguns do little to it, rockets and lasers hurt it fully
export type EnemyKind = 'grunt' | 'runner' | 'brute' | 'splitter' | 'mini' | 'elite' | 'bulwark' | 'bomber' | 'jelly' | 'drone' | 'boss';

export type BlockReward =
  | { kind: 'soldiers'; n: number }
  /** Several rewards at once: the bonus-level "jackpot" blocks. */
  | { kind: 'multi'; label: string; rewards: BlockReward[] }
  | { kind: 'weaponType'; weapon: WeaponType; label: string }
  | { kind: 'weapon'; stat: 'damage' | 'fireInterval' | 'pierce' | 'spread'; add?: number; mul?: number; label: string };

/**
 * A siege arena: a fixed screen instead of a scrolling lane. The squad moves freely in 2D, enemies arrive in timed
 * waves from under the roof at the back and walk straight south; one that reaches the bottom line costs lives.
 * The level is won by destroying the keystone block (the pillar that holds the roof up).
 */
export interface ArenaDef {
  half: number; // arena half-width (the lane is 4)
  depth: number; // y of the back wall; waves spawn just in front of it
  minY: number; // lowest y the squad may stand on
  maxY: number; // highest y: well below the spawn line, so camping the nest is not a strategy
  bottom: number; // y of the bottom line: an enemy that crosses it costs lives
  startX: number;
  startY: number;
  /** After the last scheduled wave the nest keeps sending bigger ones, so every run ends. */
  escalate: { every: number; count: number; growth: number; kind: EnemyKind };
}

export type Spawn =
  /** Enemies arriving at time `at` (seconds) from under the roof; they spawn awake. Arena levels only. */
  | { t: 'wave'; at: number; count: number; kind: EnemyKind; x?: number; spreadX?: number; hp?: number }
  /** A floor tile that is collected by walking over it (+value soldiers). Arena levels only. */
  | { t: 'tile'; x: number; y: number; value: number }
  | { t: 'enemies'; y: number; x: number; spreadX: number; spreadY: number; count: number; kind: EnemyKind; hp?: number; grid?: boolean }
  /** Counting block: value grows with every bullet that hits it; collected by walking through it. */
  | { t: 'counter'; y: number; x: number; w: number; start: number; perHit: number; max: number }
  | { t: 'gates'; y: number; left: GateSide; right: GateSide }
  /** Explosive barrel: shoot it while enemies stand next to it. */
  | { t: 'barrel'; y: number; x: number }
  | { t: 'block'; y: number; x: number; w: number; hp: number; reward: BlockReward; keystone?: boolean };

export interface LevelDef {
  id: number;
  name: string;
  length: number; // distance along lane to the finish line
  spawns: Spawn[];
  coins: number; // reward for clearing (meta-ready)
  hpMul?: number; // enemy HP multiplier for this level (grunts/runners/brutes)
  bonus?: 'jackpot' | 'swarm' | 'siege' | 'blast' | 'gates' | 'bossrush'; // optional side levels: no fail pressure (jackpot), a power-fantasy horde (swarm) or a fixed-screen siege
  arena?: ArenaDef; // present = this is a siege level (every arena rule in the sim hangs on this)
  world?: number; // 0-based world index; defaults to the block of four levels the id falls in
  bossAdds?: number; // grunts the boss calls in at 66% and 33% HP (already scaled by the level's difficulty)
}
