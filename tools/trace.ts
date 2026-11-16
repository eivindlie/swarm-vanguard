// Usage: npx tsx tools/trace.ts <level> <seed> [k]  -> squad size over time for each policy + where it died
import { makeLevels } from '../src/levels';
import { Game } from '../src/sim/game';
import { policies, profileFor } from './bot';
import { toInput } from '../src/sim/bots';

const id = Number(process.argv[2] ?? 4);
const seed = Number(process.argv[3] ?? 1);
const k = process.argv[4] ? Number(process.argv[4]) : undefined;
const level = makeLevels(k ? { [id]: k } : {}).find((l) => l.id === id)!;
console.log(`level ${id} length=${level.length.toFixed(0)} hpMul=${level.hpMul?.toFixed(2)} spawns=${level.spawns.length}`);
for (const name of Object.keys(policies)) {
  const g = new Game(level, seed, profileFor(level));
  const samples: string[] = [];
  let boss = '';
  while (g.phase === 'playing' && g.tick < 20000) {
    g.step(toInput(policies[name](g)));
    if (g.tick % 300 === 0) samples.push(`${g.squad.count}`);
    const b = g.enemies.find((e) => e.kind === 'boss');
    if (b) boss = `boss hp ${Math.ceil(b.hp)}/${b.maxHp}`;
  }
  console.log(name.padEnd(14), g.phase.padEnd(5), 'y=' + g.squad.y.toFixed(0), 'final', String(g.squad.count).padStart(3), boss, '|', samples.join(' '));
}
