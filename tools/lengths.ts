import { LEVELS } from '../src/levels';
import { FORWARD_SPEED } from '../src/sim/game';
for (const l of LEVELS) {
  const horde = l.spawns.filter((s) => s.t === 'enemies' && s.kind !== 'boss').reduce((a, s) => a + (s.t === 'enemies' ? s.count : 0), 0);
  console.log(`L${l.id} length=${l.length.toFixed(0)}  ~${Math.round(l.length / FORWARD_SPEED)}s  enemies=${horde}  hpMul=${l.hpMul?.toFixed(2)}`);
}
