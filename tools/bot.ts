import { Game } from '../src/sim/game';
import type { LevelDef } from '../src/sim/level';
import { policies, toInput, type Policy } from '../src/sim/bots';

export { policies, type Policy };

export interface RunResult {
  won: boolean;
  remaining: number;
  maxCount: number;
  ticks: number;
}

export function runBot(level: LevelDef, seed: number, policy: Policy, maxTicks = 20000): RunResult {
  const g = new Game(level, seed);
  while (g.phase === 'playing' && g.tick < maxTicks) g.step(toInput(policy(g)));
  return { won: g.phase === 'won', remaining: g.squad.count, maxCount: g.squad.maxCount, ticks: g.tick };
}
