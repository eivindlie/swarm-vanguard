import { LEVELS } from '../src/levels';
import { policies, runBot } from './bot';
for (const l of LEVELS.filter((x) => x.bonus)) {
  const row: string[] = [];
  for (const [name, p] of Object.entries(policies)) {
    let w = 0, rem = 0, ticks = 0;
    for (let s = 1; s <= 10; s++) { const r = runBot(l, s, p); if (r.won) w++; rem += r.remaining; ticks += r.ticks; }
    row.push(`${name} ${w * 10}% /${Math.round(rem / 10)} soldiers /${Math.round(ticks / 10 / 60)}s`);
  }
  console.log(`B${l.id - 100} ${l.name} (${l.bonus}):`, row.join(' | '));
}
