import { Game } from '../src/sim/game';
import type { LevelDef } from '../src/sim/level';
import { policies, toInput, type Policy } from '../src/sim/bots';
import { profileModifiers, progressOf } from '../src/meta/upgrades';

/** The bots play with the upgrades a typical player has by then (NO_PROFILE=1: none, to compare). */
export const profileFor = (level: LevelDef) => (process.env.NO_PROFILE ? [] : profileModifiers(progressOf(level)));

export { policies, type Policy };

export interface RunResult {
  won: boolean;
  remaining: number;
  maxCount: number;
  ticks: number;
}

export function runBot(level: LevelDef, seed: number, policy: Policy, maxTicks = 20000): RunResult {
  const g = new Game(level, seed, profileFor(level));
  while (g.phase === 'playing' && g.tick < maxTicks) g.step(toInput(policy(g)));
  return { won: g.phase === 'won', remaining: g.squad.count, maxCount: g.squad.maxCount, ticks: g.tick };
}
