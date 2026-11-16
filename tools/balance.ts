import { LEVELS } from '../src/levels';
import { policies, runBot } from './bot';

const seeds = Number(process.argv[2] ?? 40);
const names = Object.keys(policies);

console.log(`Win rate (%) / avg survivors over ${seeds} seeds\n`);
console.log('level'.padEnd(6) + names.map((n) => n.padEnd(18)).join(''));
// bonus levels have thousands of enemies (slow) and their own check (bonus-check.ts): pass `all` as 2nd arg to include them
for (const level of LEVELS.filter((l) => !l.bonus || process.argv[3] === 'all')) {
  let row = (level.bonus ? 'B' + (level.id - 100) : String(level.id)).padEnd(6);
  for (const name of names) {
    let wins = 0;
    let rem = 0;
    for (let s = 1; s <= seeds; s++) {
      const r = runBot(level, s, policies[name]);
      if (r.won) wins++;
      rem += r.remaining;
    }
    row += `${Math.round((wins / seeds) * 100)}% / ${(rem / seeds).toFixed(0)}`.padEnd(18);
  }
  console.log(row);
}
