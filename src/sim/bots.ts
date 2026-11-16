import { Game, LANE_HALF, gateScore, type Enemy, type Gate, type Input } from './game';

/** Lane levels steer with an x only; siege levels need x and y. */
export type Decision = number | { x: number; y: number };
export type Policy = (g: Game) => Decision;

export function toInput(d: Decision): Input {
  return typeof d === 'number' ? { targetX: d } : { targetX: d.x, targetY: d.y };
}

const clampX = (x: number) => Math.max(-LANE_HALF + 0.6, Math.min(LANE_HALF - 0.6, x));

/** Centroid X of nearest enemies within `range` ahead; null if none. */
function enemyCentroid(g: Game, range: number): number | null {
  let sx = 0;
  let n = 0;
  for (const e of g.enemies) {
    const d = e.y - g.squad.y;
    if (d > 0 && d < range) {
      sx += e.x;
      n++;
    }
  }
  return n ? sx / n : null;
}

function nextGatePair(g: Game, within: number): Gate[] | null {
  let best: Gate | null = null;
  for (const gt of g.gates) {
    if (gt.used || gt.y < g.squad.y) continue;
    if (!best || gt.y < best.y) best = gt;
  }
  if (!best || best.y - g.squad.y > within) return null;
  return g.gates.filter((x) => x.pair === best!.pair);
}

function bestGateX(g: Game, pair: Gate[]): number {
  let bestX = 0;
  let bestScore = -Infinity;
  for (const gt of pair) {
    const score = gateScore(g.squad.count, gt.side);
    if (score > bestScore) {
      bestScore = score;
      bestX = gt.x;
    }
  }
  return bestX;
}

const lanePolicies: Record<string, (g: Game) => number> = {
  /** Stands still in the middle. */
  naive: () => 0,

  /** Only chases enemy mass; ignores gates/blocks entirely. */
  'pure-fight': (g) => clampX(enemyCentroid(g, 20) ?? 0),

  /** Always heads for the best gate / nearest block; ignores enemies. */
  'greedy-expand': (g) => {
    const pair = nextGatePair(g, 30);
    if (pair) return bestGateX(g, pair);
    const block = g.blocks.filter((b) => b.y > g.squad.y).sort((a, b) => a.y - b.y)[0];
    const counter = g.counters.filter((c) => c.y > g.squad.y).sort((a, b) => a.y - b.y)[0];
    if (counter && counter.y - g.squad.y < 30 && (!block || counter.y < block.y)) return clampX(counter.x);
    if (block && block.y - g.squad.y < 30) return clampX(block.x);
    return 0;
  },

  /**
   * Expand by default (same targeting as greedy-expand), but switch to defence when a horde is
   * about to reach the squad: that is the expand-vs-exploit trade-off in one rule.
   */
  balanced: (g) => {
    const imminent = g.enemies.filter((e) => e.y - g.squad.y > 0 && e.y - g.squad.y < 7).length;
    const pair = nextGatePair(g, 30);
    // an almost-reached gate is always worth taking
    if (pair && pair[0].y - g.squad.y < 5) return bestGateX(g, pair);
    if (imminent >= Math.max(6, g.squad.count * 0.4)) return clampX(enemyCentroid(g, 9) ?? 0);
    if (pair) return bestGateX(g, pair);
    const counter = g.counters.filter((c) => c.y > g.squad.y).sort((a, b) => a.y - b.y)[0];
    const block = g.blocks.filter((bl) => bl.y > g.squad.y).sort((a, b) => a.y - b.y)[0];
    if (counter && counter.y - g.squad.y < 30 && (!block || counter.y < block.y)) return clampX(counter.x);
    if (block && block.y - g.squad.y < 30) return clampX(block.x);
    return clampX(enemyCentroid(g, 20) ?? 0);
  },
};


// ------------------------------------------------------------------------------------------------ siege (arena)

const arenaOf = (g: Game) => g.level.arena!;
const holdY = (g: Game) => arenaOf(g).minY + 1.4;
/** The nearest standing pillar (a siege can have two). */
const keystoneX = (g: Game) => {
  let best: number | null = null;
  for (const b of g.blocks) if (b.keystone && b.hp > 0 && (best === null || Math.abs(b.x - g.squad.x) < Math.abs(best - g.squad.x))) best = b.x;
  return best ?? 0;
};
const clampAX = (g: Game, x: number) => Math.max(-arenaOf(g).half + 0.8, Math.min(arenaOf(g).half - 0.8, x));

/** Enemies ahead of the squad (still to be dealt with) within `range`. */
function threats(g: Game, range: number): Enemy[] {
  const sq = g.squad;
  return g.enemies.filter((e) => e.hp > 0 && e.y > sq.y - 1 && e.y - sq.y < range);
}

const centroidX = (list: Enemy[]) => list.reduce((a, e) => a + e.x, 0) / Math.max(1, list.length);

function nearestPickup(g: Game): { x: number; y: number } | null {
  const sq = g.squad;
  let best: { x: number; y: number } | null = null;
  let bd = Infinity;
  for (const p of g.pickups) {
    // bigger tiles are worth a longer walk
    const d = Math.hypot(p.x - sq.x, p.y - sq.y) / Math.sqrt(p.value);
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best;
}

const arenaPolicies: Record<string, (g: Game) => { x: number; y: number }> = {
  /** Stands where it starts and shoots straight ahead. */
  naive: (g) => ({ x: arenaOf(g).startX, y: arenaOf(g).startY }),

  /** Parks under the pillar and just shoots it: the "stand still" of a siege. Must lose, or movement is decoration. */
  park: (g) => ({ x: keystoneX(g), y: holdY(g) }),

  /** Only fights the incoming waves; never collects anything. */
  'pure-fight': (g) => {
    const t = threats(g, 16);
    return { x: clampAX(g, t.length ? centroidX(t) : keystoneX(g)), y: holdY(g) };
  },

  /** Only collects tiles, then shoots the pillar; ignores the waves. */
  'greedy-expand': (g) => {
    const tile = nearestPickup(g);
    return tile ? { x: tile.x, y: tile.y } : { x: keystoneX(g), y: holdY(g) };
  },

  /** Defends when a wave is about to reach it, otherwise grabs tiles, otherwise works on the pillar. */
  balanced: (g) => {
    const sq = g.squad;
    const near = threats(g, 11);
    if (near.length >= Math.max(4, sq.count * 0.25)) return { x: clampAX(g, centroidX(near)), y: holdY(g) };
    const tile = nearestPickup(g);
    // a tile is worth the detour only while no wave is close behind it
    if (tile && threats(g, 8).length < 3) return { x: tile.x, y: Math.min(tile.y, arenaOf(g).maxY) };
    const far = threats(g, 20);
    if (far.length >= 8) return { x: clampAX(g, centroidX(far)), y: holdY(g) };
    return { x: keystoneX(g), y: holdY(g) };
  },
};

/** All policies by name; each one dispatches to its lane or siege version depending on the level. */
export const policies: Record<string, Policy> = {};
for (const name of new Set([...Object.keys(lanePolicies), ...Object.keys(arenaPolicies)])) {
  const lane = lanePolicies[name] ?? lanePolicies.naive; // "park" has no lane meaning: it is plain standing still
  const arena = arenaPolicies[name];
  policies[name] = (g) => (g.level.arena && arena ? arena(g) : lane(g));
}
