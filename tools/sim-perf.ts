// Simulation cost per tick during the biggest fights (swarm bonus levels), in milliseconds.
import { LEVELS } from '../src/levels';
import { Game } from '../src/sim/game';
import { policies } from '../src/sim/bots';
for (const id of [102, 104, 16]) {
  const level = LEVELS.find((l) => l.id === id)!;
  const g = new Game(level, 1);
  const times: number[] = [];
  let peakEnemies = 0;
  while (g.phase === 'playing' && g.tick < 20000) {
    const t0 = performance.now();
    g.step({ targetX: policies.balanced(g) });
    times.push(performance.now() - t0);
    peakEnemies = Math.max(peakEnemies, g.enemies.length);
  }
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`L${id} "${level.name}": peak ${peakEnemies} enemies | per tick avg ${avg.toFixed(2)} ms, p99 ${times[Math.floor(times.length * 0.99)].toFixed(2)} ms, max ${times[times.length - 1].toFixed(2)} ms (budget 16.7 ms per frame at 60 Hz)`);
}
