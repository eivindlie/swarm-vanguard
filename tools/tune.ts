// Grid-search per level: pick the horde multiplier k that maximises
//   score = win(balanced) - max(win(others)) + 0.12*ln(k)   subject to win(balanced) >= MIN_BAL,
// i.e. the hardest level a balanced player still clears, preferring ones where strategy matters.
// Writes src/levels/tuned.json (read by src/levels/index.ts).
import { writeFileSync } from 'node:fs';
import { makeLevels } from '../src/levels';
import { policies, runBot } from './bot';

const MIN_BAL = Number(process.argv[2] ?? 0.8);
const SEEDS = 24;
const SAFETY = 0.8;
const GRID = Array.from({ length: 22 }, (_, i) => Math.round(0.2 * Math.pow(1.17, i) * 100) / 100); // 0.2 .. ~5.7
const names = ['balanced', 'naive', 'pure-fight', 'greedy-expand'] as const;

function rates(id: number, k: number): Record<string, number> {
  const level = makeLevels({ [id]: k })[id - 1];
  const r: Record<string, number> = {};
  for (const n of names) {
    let w = 0;
    for (let s = 1; s <= SEEDS; s++) if (runBot(level, s, policies[n]).won) w++;
    r[n] = w / SEEDS;
  }
  return r;
}

const out: Record<string, number> = {};
for (let id = 1; id <= 10; id++) {
  let best = { k: 1, score: -9, bal: 0, other: 0 };
  for (const k of GRID) {
    const r = rates(id, k);
    const other = Math.max(r.naive, r['pure-fight'], r['greedy-expand']);
    // prefer the hardest level that a balanced player still wins; the gap breaks ties
    const score = r.balanced >= MIN_BAL ? r.balanced - other + 0.12 * Math.log(k) : r.balanced - 1 - other;
    if (score > best.score) best = { k, score, bal: r.balanced, other };
  }
  // humans play less precisely than the bot, so leave headroom below the difficulty cliff
  out[id] = Math.round(best.k * SAFETY * 100) / 100;
  console.log(`level ${id}: k=${best.k} balanced=${Math.round(best.bal * 100)}% best-other=${Math.round(best.other * 100)}%`);
}
writeFileSync(new URL('../src/levels/tuned.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
