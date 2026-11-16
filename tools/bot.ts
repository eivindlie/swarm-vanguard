import { Game, LANE_HALF, applyGate, type Gate } from '../src/sim/game';
import type { LevelDef } from '../src/sim/level';

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
    if (block && block.y - g.squad.y < 30) return clampX(block.x);
    return 0;
  },

  /** Takes good gates, grabs blocks it can break in time, otherwise fights. */
  balanced: (g) => {
    const pair = nextGatePair(g, 16);
    if (pair) return bestGateX(g, pair);
    const dps = (g.stat('damage') * g.squad.count) / g.stat('fireInterval');
    const block = g.blocks.filter((b) => b.y > g.squad.y).sort((a, b) => a.y - b.y)[0];
    if (block) {
      const dist = block.y - g.squad.y;
      const timeToBreak = block.hp / Math.max(1, dps);
      const threat = enemyCentroid(g, 12);
      // worth it if we can break it before it gets in the way and few enemies are close
      if (dist < 22 && timeToBreak < dist / 4 + 2 && (threat === null || g.enemies.length < 14)) return clampX(block.x);
    }
    return clampX(enemyCentroid(g, 20) ?? 0);
  },
};

export interface RunResult {
  won: boolean;
  remaining: number;
  maxCount: number;
  ticks: number;
}

export function runBot(level: LevelDef, seed: number, policy: Policy, maxTicks = 20000): RunResult {
  const g = new Game(level, seed);
  while (g.phase === 'playing' && g.tick < maxTicks) g.step({ targetX: policy(g) });
  return { won: g.phase === 'won', remaining: g.squad.count, maxCount: g.squad.maxCount, ticks: g.tick };
}
