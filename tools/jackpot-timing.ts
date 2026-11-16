// How long does each giant block hold the squad? (pinned seconds per block, squad size, dps at the moment)
import { LEVELS } from '../src/levels';
import { Game } from '../src/sim/game';
import { policies } from '../src/sim/bots';
const id = Number(process.argv[2] ?? 101);
const level = LEVELS.find((l) => l.id === id)!;
const g = new Game(level, 1);
let pinned = 0;
let prevY = 0;
let lastBreak = 0;
let n = 0;
while (g.phase === 'playing' && g.tick < 20000) {
  g.step({ targetX: policies.balanced(g) });
  if (Math.abs(g.squad.y - prevY) < 1e-9) pinned++;
  prevY = g.squad.y;
  for (const e of g.events) {
    if (e.t === 'blockBreak') {
      const dps = (g.stat('damage') * g.squad.count) / (g.stat('fireInterval'));
      console.log(`block ${++n} "${e.label}": pinned ${(pinned / 60).toFixed(1)}s, ${((g.tick - lastBreak) / 60).toFixed(1)}s since previous, squad ${g.squad.count}, dps ~${Math.round(dps)}`);
      pinned = 0;
      lastBreak = g.tick;
    }
  }
}
console.log('total', (g.tick / 60).toFixed(1), 's', g.phase);
