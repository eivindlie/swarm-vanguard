// 1) Pin a squad against a lane-wide block and compare the time to break it with hp / dps.
import { Game } from '../src/sim/game';
import type { LevelDef } from '../src/sim/level';
for (const n of [20, 60, 150, 300]) {
  const hp = 5000;
  const lvl: LevelDef = { id: 90, name: 'pin', length: 80, coins: 1, spawns: [{ t: 'block', y: 14, x: 0, w: 6, hp, reward: { kind: 'soldiers', n: 1 } }] };
  const g = new Game(lvl, 1, [{ stat: 'startSize', add: n - 5 }]);
  let stopped = 0;
  let prevY = g.squad.y;
  while (g.phase === 'playing' && g.blocks.length && g.tick < 6000) {
    g.step({ targetX: 0 });
    if (Math.abs(g.squad.y - prevY) < 1e-9) stopped++;
    prevY = g.squad.y;
  }
  const dps = (g.stat('damage') * n) / g.stat('fireInterval');
  console.log(`squad ${String(n).padStart(3)}: ideal ${(hp / dps).toFixed(1)}s | broke after ${(g.tick / 60).toFixed(1)}s (pinned ${(stopped / 60).toFixed(1)}s)`);
}
