// How do the bots fare in a siege, and does every run terminate?  Usage: npx tsx tools/siege-check.ts [levelId] [seeds]
import { makeLevels } from '../src/levels';
import { Game } from '../src/sim/game';
import { policies, toInput } from '../src/sim/bots';
import { profileFor } from './bot';

const id = Number(process.argv[2] ?? 201);
const seeds = Number(process.argv[3] ?? 12);
const level = makeLevels().find((l) => l.id === id)!;
console.log(`${level.name}: keystone hp ${level.spawns.find((s) => s.t === 'block' && s.keystone && 'hp' in s)?.['hp' as never]}`);
for (const name of ['naive', 'park', 'pure-fight', 'greedy-expand', 'balanced']) {
  let won = 0, sumT = 0, sumRem = 0, maxT = 0, unfinished = 0, leaks = 0;
  for (let s = 1; s <= seeds; s++) {
    const g = new Game(level, s, profileFor(level));
    while (g.phase === 'playing' && g.tick < 30000) {
      g.step(toInput(policies[name](g)));
      leaks += g.events.filter((e) => e.t === 'leak').length;
    }
    if (g.phase === 'playing') unfinished++;
    if (g.phase === 'won') won++;
    sumT += g.tick / 60;
    maxT = Math.max(maxT, g.tick / 60);
    sumRem += g.squad.count;
  }
  console.log(`${name.padEnd(14)} win ${Math.round((won / seeds) * 100)}%  avg ${(sumT / seeds).toFixed(0)}s (max ${maxT.toFixed(0)}s)  survivors ${(sumRem / seeds).toFixed(0)}  leaks/run ${(leaks / seeds).toFixed(1)}${unfinished ? `  UNFINISHED ${unfinished}` : ''}`);
}
