import { Game, LANE_HALF, applyGate, type Gate } from './game';

export type Policy = (g: Game) => number;

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
    const score = applyGate(g.squad.count, gt.side);
    if (score > bestScore) {
      bestScore = score;
      bestX = gt.x;
    }
  }
  return bestX;
}

export const policies: Record<string, Policy> = {
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

