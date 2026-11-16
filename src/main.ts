import { Game, DT } from './sim/game';
import { LEVELS } from './levels';
import { GameRenderer } from './render/renderer';
import { Controls } from './input/controls';
import { Hud } from './ui/hud';
import { installDebugApi } from './debug/api';

const params = new URLSearchParams(location.search);
const timeScale = Math.max(0.1, Number(params.get('speed') ?? 1));
let levelIdx = Math.max(0, Math.min(LEVELS.length - 1, Number(params.get('level') ?? 1) - 1));
let seed = Number(params.get('seed') ?? 1);

const stage = document.getElementById('stage') as HTMLElement;
const renderer = new GameRenderer(stage);
const controls = new Controls(stage);
const hud = new Hud();

let game = new Game(LEVELS[levelIdx], seed);
let paused = true;
let acc = 0;
let last = performance.now();

function restart(level?: number, newSeed?: number) {
  if (level !== undefined) levelIdx = Math.max(0, Math.min(LEVELS.length - 1, level - 1));
  if (newSeed !== undefined) seed = newSeed;
  game = new Game(LEVELS[levelIdx], seed);
  controls.reset();
  hud.setLevel(LEVELS[levelIdx].id);
  hud.hideEnd();
  acc = 0;
}

function startGame() {
  hud.hideStart();
  paused = false;
  last = performance.now();
}

hud.setLevel(LEVELS[levelIdx].id);
hud.startBtn.addEventListener('click', startGame);
hud.endBtn.addEventListener('click', () => {
  const won = game.phase === 'won';
  restart(won && levelIdx + 1 < LEVELS.length ? levelIdx + 2 : levelIdx + 1);
  paused = false;
});
document.addEventListener('visibilitychange', () => { if (document.hidden) paused = true; });

installDebugApi({
  getGame: () => game,
  renderer,
  controls,
  restart,
  setPaused: (p) => (paused = p),
  start: startGame,
});
if (params.get('autostart') === '1') startGame();

function handleEvents() {
  renderer.fxEvents(game);
  for (const e of game.events) {
    if (e.t === 'gate') {
      const p = renderer.project(e.x, e.y, 1.5);
      hud.popup(e.label, p.x, p.y);
    } else if (e.t === 'blockBreak') {
      const p = renderer.project(e.x, e.y, 1.5);
      hud.popup(e.label, p.x, p.y);
      renderer.addShake(0.3);
    } else if (e.t === 'squadHit') {
      renderer.addShake(0.05);
    }
  }
}

let shownEnd = false;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  controls.update(dt);
  if (!paused && game.phase === 'playing') {
    acc += dt * timeScale;
    let guard = 0;
    while (acc >= DT && guard++ < 20 && game.phase === 'playing') {
      game.step({ targetX: controls.value() });
      handleEvents();
      acc -= DT;
    }
  }
  if (game.phase !== 'playing' && !shownEnd) {
    shownEnd = true;
    const won = game.phase === 'won';
    hud.showEnd(won, won ? `Squad survivors: ${game.squad.count}  ·  +${game.level.coins} coins` : 'Your squad was wiped out.', won ? 'Next level' : 'Retry');
  }
  if (game.phase === 'playing') shownEnd = false;
  renderer.render(game, dt);
  hud.update(game, renderer);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
