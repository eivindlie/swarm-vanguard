// Per level, pick the horde multiplier k: the HARDEST k where standing still loses (<=25%) while the balanced
// bot still wins >= 95% (then >= 85%). If no k does either, fall back to the hardest k a balanced player
// clears, with a margin. (Picking the easiest k would give nearly empty levels.)
// Writes src/levels/tuned.json (read by src/levels/index.ts). Bonus levels stay at k = 1.
import { writeFileSync } from 'node:fs';
import { LEVEL_COUNT, makeLevels } from '../src/levels';
import { policies, runBot } from './bot';

const MIN_BAL = Number(process.argv[2] ?? 0.8);
const SEEDS = 24;
const SAFETY = 0.8;
const GRID = Array.from({ length: 26 }, (_, i) => Math.round(0.2 * Math.pow(1.17, i) * 100) / 100); // 0.2 .. ~10
const names = ['balanced', 'naive', 'pure-fight', 'greedy-expand'] as const;
const IDS = Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1);

function rates(id: number, k: number): Record<string, number> {
  const level = makeLevels({ [id]: k }).find((l) => l.id === id)!;
  const r: Record<string, number> = {};
  for (const n of names) {
    let w = 0;
    for (let s = 1; s <= SEEDS; s++) if (runBot(level, s, policies[n]).won) w++;
    r[n] = w / SEEDS;
  }
  return r;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const out: Record<string, number> = {};

for (const id of IDS) {
  const table = GRID.map((k) => ({ k, r: rates(id, k) }));
  const describe = (r: Record<string, number>) => `naive ${pct(r.naive)} / fight ${pct(r['pure-fight'])} / greedy ${pct(r['greedy-expand'])} / balanced ${pct(r.balanced)}`;
  let chosen: { k: number; why: string } | null = null;

  // preferred tiers: the hardest k where standing still fails and balanced play is still safe
  for (const minBal of [0.95, 0.85]) {
    const ok = table.filter((t) => t.r.naive <= 0.25 && t.r.balanced >= minBal);
    if (ok.length) {
      const t = ok[ok.length - 1];
      chosen = { k: t.k, why: describe(t.r) };
      break;
    }
  }

  // fallback: no k separates standing still from balanced play
  if (!chosen) {
    const ok = table.filter((t) => t.r.balanced >= MIN_BAL);
    const t = ok.length ? ok[ok.length - 1] : table[0];
    chosen = { k: Math.round(t.k * SAFETY * 100) / 100, why: `FALLBACK (nothing separates standing still from balanced): ${describe(t.r)} at k=${t.k}` };
  }

  out[id] = chosen.k;
  console.log(`level ${id}: k=${chosen.k}  ${chosen.why}`);
}

writeFileSync(new URL('../src/levels/tuned.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
