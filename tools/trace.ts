// Usage: npx tsx tools/trace.ts <level> <seed> [k]  -> squad size over time for each policy
import { makeLevels } from '../src/levels';
import { Game } from '../src/sim/game';
import { policies } from './bot';

const id = Number(process.argv[2] ?? 4);
const seed = Number(process.argv[3] ?? 1);
const k = process.argv[4] ? Number(process.argv[4]) : undefined;
const level = makeLevels(k ? { [id]: k } : {})[id - 1];
console.log(`level ${id} length=${level.length} hpMul=${level.hpMul?.toFixed(2)} spawns=${level.spawns.length}`);
for (const name of Object.keys(policies)) {
  const g = new Game(level, seed);
  const samples: string[] = [];
  while (g.phase === 'playing' && g.tick < 20000) {
    g.step({ targetX: policies[name](g) });
    if (g.tick % 300 === 0) samples.push(`${g.squad.count}`);
  }
  console.log(name.padEnd(14), g.phase.padEnd(5), 'final', String(g.squad.count).padStart(3), '|', samples.join(' '));
}
