import { Game, DT } from './sim/game';
import { LEVELS } from './levels';
import { GameRenderer } from './render/renderer';
import { Controls } from './input/controls';
import { Hud } from './ui/hud';
import { Sfx } from './audio/sfx';
import { loadSave, metaModifiers, recordWin } from './meta/save';
import { installDebugApi } from './debug/api';
import { policies } from './sim/bots';

const params = new URLSearchParams(location.search);
const timeScale = Math.max(0.1, Number(params.get('speed') ?? 1));
const save = loadSave();
const urlLevel = params.get('level');
let levelIdx = urlLevel
  ? Math.max(0, Math.min(LEVELS.length - 1, Number(urlLevel) - 1))
  : Math.min(save.unlockedLevel, LEVELS.length) - 1;
let seed = Number(params.get('seed') ?? 1);
// ?autoplay=balanced|greedy-expand|pure-fight|naive lets a bot play (demo / visual testing)
const autoPolicy = policies[params.get('autoplay') ?? ''];

const stage = document.getElementById('stage') as HTMLElement;
const renderer = new GameRenderer(stage);
const controls = new Controls(stage);
const hud = new Hud();
const sfx = new Sfx();

let game = new Game(LEVELS[levelIdx], seed, metaModifiers(save));
let paused = true;
let acc = 0;
let last = performance.now();
let shownEnd = false;

function refreshMenu() {
  hud.setCoins(save.coins);
  hud.renderLevels(LEVELS.length, urlLevel ? LEVELS.length : save.unlockedLevel, save.stars, levelIdx + 1, (id) => {
    restart(id);
    refreshMenu();
  });
}

function restart(level?: number, newSeed?: number) {
  if (level !== undefined) levelIdx = Math.max(0, Math.min(LEVELS.length - 1, level - 1));
  if (newSeed !== undefined) seed = newSeed;
  game = new Game(LEVELS[levelIdx], seed, metaModifiers(save));
  controls.reset();
  hud.setLevel(LEVELS[levelIdx].id);
  hud.hideEnd();
  shownEnd = false;
  acc = 0;
}

function startGame() {
  sfx.unlock();
  hud.hideStart();
  paused = false;
  last = performance.now();
}

hud.setLevel(LEVELS[levelIdx].id);
refreshMenu();
hud.mute.textContent = sfx.muted ? '🔇' : '🔊';
hud.mute.addEventListener('click', () => {
  sfx.unlock();
  sfx.setMuted(!sfx.muted);
  hud.mute.textContent = sfx.muted ? '🔇' : '🔊';
});
// audio can only start after a user gesture
window.addEventListener('pointerdown', () => sfx.unlock(), { passive: true });
hud.startBtn.addEventListener('click', startGame);
hud.endBtn.addEventListener('click', () => {
  const won = game.phase === 'won';
  restart(won && levelIdx + 1 < LEVELS.length ? levelIdx + 2 : levelIdx + 1);
  paused = false;
});
hud.menuBtn.addEventListener('click', () => {
  restart(levelIdx + 1);
  paused = true;
  refreshMenu();
  hud.showStart();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) paused = true; });

installDebugApi({
  getGame: () => game,
  renderer,
  controls,
  getInput: () => (autoPolicy ? autoPolicy(game) : controls.value()),
  restart,
  setPaused: (p) => (paused = p),
  start: startGame,
});
if (params.get('autostart') === '1') startGame();

function handleEvents() {
  renderer.fxEvents(game);
  for (const e of game.events) {
    switch (e.t) {
      case 'shot': sfx.shot(); break;
      case 'hit': sfx.hit(); break;
      case 'kill': sfx.kill(); break;
      case 'blockHit': case 'counterHit': sfx.blockHit(); break;
      case 'blockBreak': {
        const p = renderer.project(e.x, e.y, 1.5);
        hud.popup(e.label, p.x, p.y);
        renderer.addShake(0.3);
        sfx.blockBreak();
        break;
      }
      case 'gate': {
        const p = renderer.project(e.x, e.y, 1.5);
        hud.popup(e.label, p.x, p.y);
        sfx.gate(e.delta >= 0);
        break;
      }
      case 'squadHit': renderer.addShake(0.05); sfx.squadHit(); break;
      case 'win': sfx.win(); break;
      case 'lose': sfx.lose(); break;
    }
  }
}

function showEndScreen() {
  const won = game.phase === 'won';
  if (won) {
    const r = recordWin(save, game.level.id, game.level.coins, game.squad.count, game.squad.maxCount, LEVELS.length);
    const last = levelIdx + 1 >= LEVELS.length;
    hud.showEnd(true, `Survivors: ${game.squad.count}  ·  +${r.coins} coins`, last ? 'Play again' : 'Next level', r.stars);
  } else {
    hud.showEnd(false, 'Your squad was wiped out.', 'Retry');
  }
}

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  controls.update(dt);
  if (!paused && game.phase === 'playing') {
    acc += dt * timeScale;
    let guard = 0;
    while (acc >= DT && guard++ < 20 && game.phase === 'playing') {
      game.step({ targetX: autoPolicy ? autoPolicy(game) : controls.value() });
      handleEvents();
      acc -= DT;
    }
  }
  if (game.phase !== 'playing' && !shownEnd) {
    shownEnd = true;
    showEndScreen();
  }
  renderer.render(game, dt);
  hud.update(game, renderer);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
