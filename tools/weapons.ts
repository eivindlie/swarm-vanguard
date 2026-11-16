// Usage: npx tsx tools/weapons.ts -> compares weapon types on a fixed arena (kills per second, squad losses)
import { Game, WEAPONS } from '../src/sim/game';
import type { LevelDef, WeaponType } from '../src/sim/level';

const mk = (n: number, kind: 'grunt' | 'runner' | 'brute', spreadX: number): LevelDef => ({
  id: 0, name: 'arena', length: 400, coins: 0,
  spawns: [{ t: 'enemies', y: 28, x: 0, spreadX, spreadY: n / 4, count: n, kind }],
});
for (const [label, level] of [['40 grunts, narrow column', mk(40, 'grunt', 1.5)], ['40 grunts, wide', mk(40, 'grunt', 3.3)], ['25 runners', mk(25, 'runner', 2)], ['3 brutes', mk(3, 'brute', 1)]] as const) {
  console.log(`\n${label}  (squad of 20)`);
  for (const w of Object.keys(WEAPONS) as WeaponType[]) {
    let lost = 0, ticks = 0, left = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const g = new Game(level, seed, [{ stat: 'startSize', add: 15 }]);
      g.weapon = w;
      while (g.phase === 'playing' && g.enemies.length && g.tick < 3000) g.step({ targetX: 0 });
      lost += 20 - g.squad.count; ticks += g.tick; left += g.enemies.length;
    }
    console.log(`  ${w.padEnd(8)} soldiers lost/run ${(lost / 10).toFixed(1).padStart(5)}   enemies left ${(left / 10).toFixed(1).padStart(5)}   ticks ${(ticks / 10).toFixed(0)}`);
  }
}
