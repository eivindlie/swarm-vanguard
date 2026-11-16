// Usage: npx tsx tools/scan.ts <level> -> win rate per policy across a range of k
import { makeLevels } from '../src/levels';
import { policies, runBot } from './bot';
const id = Number(process.argv[2] ?? 1);
const names = Object.keys(policies);
console.log('k'.padEnd(6) + names.map((n) => n.padEnd(15)).join(''));
for (const k of [0.6, 1, 2, 3, 4.5, 6, 10]) {
  const level = makeLevels({ [id]: k }).find((l) => l.id === id)!;
  let row = String(k).padEnd(6);
  for (const n of names) {
    let w = 0;
    for (let s = 1; s <= 24; s++) if (runBot(level, s, policies[n]).won) w++;
    row += `${Math.round((w / 24) * 100)}%`.padEnd(15);
  }
  console.log(row);
}
