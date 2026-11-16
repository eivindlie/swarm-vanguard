// Re-roll the layout of generated levels: for each variant, play the level at the SAME difficulty with the
// balanced bot and with the "stand still" bot, then pick the variant where standing still fails but balanced wins.
// Usage: npx tsx tools/reroll.ts 5 7   -> writes src/levels/variants.json (then re-tune those levels with
// `npx tsx tools/tune.ts 0.8 5,7`).
import { readFileSync, writeFileSync } from 'node:fs';
import { makeLevels } from '../src/levels';
import { policies, runBot } from './bot';

const ids = process.argv.slice(2).map(Number).filter((n) => n >= 4 && n <= 16);
const file = new URL('../src/levels/variants.json', import.meta.url);
const current: Record<string, number> = JSON.parse(readFileSync(file, 'utf8'));
const tuned: Record<string, number> = JSON.parse(readFileSync(new URL('../src/levels/tuned.json', import.meta.url), 'utf8'));
const SEEDS = 20;
const K_PROBE = [0.9, 1.1, 1.3];

for (const id of ids) {
  const base = tuned[String(id)] ?? 1;
  let best: { v: number; score: number; note: string } | null = null;
  for (let v = 0; v < 10; v++) {
    // probe a few difficulties around the tuned one: we want a variant that separates the bots there
    let score = -9;
    let note = '';
    for (const m of K_PROBE) {
      const k = Math.round(base * m * 100) / 100;
      const level = makeLevels({ [id]: k }, { [id]: v }).find((l) => l.id === id)!;
      let naive = 0;
      let bal = 0;
      for (let s = 1; s <= SEEDS; s++) {
        if (runBot(level, s, policies.naive).won) naive++;
        if (runBot(level, s, policies.balanced).won) bal++;
      }
      const sc = bal / SEEDS - (naive / SEEDS) * 2; // reward balanced wins, punish standing still hard
      if (sc > score) {
        score = sc;
        note = `k=${k}: naive ${Math.round((naive / SEEDS) * 100)}% balanced ${Math.round((bal / SEEDS) * 100)}%`;
      }
    }
    console.log(`level ${id} variant ${v}: ${note} (score ${score.toFixed(2)})`);
    if (!best || score > best.score + 1e-9) best = { v, score, note };
  }
  current[String(id)] = best!.v;
  console.log(`=> level ${id}: variant ${best!.v} (${best!.note})`);
}
writeFileSync(file, JSON.stringify(current, null, 2) + '\n');
