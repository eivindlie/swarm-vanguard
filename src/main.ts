import { Game, DT } from './sim/game';
import { LEVELS } from './levels';
import { GameRenderer } from './render/renderer';
import { Controls } from './input/controls';
import { Hud } from './ui/hud';
import { Sfx } from './audio/sfx';
import { loadSave, metaModifiers, recordWin } from './meta/save';
import { loadSettings, saveSettings } from './meta/settings';
import { installDebugApi } from './debug/api';
import { policies } from './sim/bots';

const params = new URLSearchParams(location.search);
const timeScale = Math.max(0.1, Number(params.get('speed') ?? 1));
const save = loadSave();
const settings = loadSettings();
const urlLevel = params.get('level');
let levelIdx = urlLevel
  ? Math.max(0, Math.min(LEVELS.length - 1, Number(urlLevel) - 1))
  : Math.min(save.unlockedLevel, LEVELS.length) - 1;
let seed = Number(params.get('seed') ?? 1);
// ?autoplay=balanced|greedy-expand|pure-fight|naive lets a bot play (demo / visual testing)
const autoPolicy = policies[params.get('autoplay') ?? ''];

const stage = document.getElementById('stage') as HTMLElement;
const renderer = new GameRenderer(stage);
if (params.has('theme')) renderer.themeOverride = Number(params.get('theme'));
renderer.shakeScale = settings.reduceShake ? 0 : 1;
const controls = new Controls(stage);
const hud = new Hud();
const sfx = new Sfx();
sfx.musicOn = settings.music;

let game = new Game(LEVELS[levelIdx], seed, metaModifiers(save));
renderer.setLevel(LEVELS[levelIdx]);
let paused = true;
let acc = 0;
let last = performance.now();
let shownEnd = false;
let hitStop = 0; // seconds of frozen simulation after big impacts (render keeps running)
let playedFor = 0;

// ------------------------------------------------------------- settings UI

function buzz(pattern: number | number[]) {
  if (settings.haptics && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* not supported */
    }
  }
}

function refreshToggles() {
  hud.renderToggles([
    { label: 'Music', on: settings.music, toggle: () => { settings.music = !settings.music; sfx.setMusic(settings.music); saveSettings(settings); refreshToggles(); } },
    { label: 'Vibration', on: settings.haptics, toggle: () => { settings.haptics = !settings.haptics; saveSettings(settings); refreshToggles(); buzz(15); } },
    { label: 'Screen shake', on: !settings.reduceShake, toggle: () => { settings.reduceShake = !settings.reduceShake; renderer.shakeScale = settings.reduceShake ? 0 : 1; saveSettings(settings); refreshToggles(); } },
  ]);
}

function refreshMenu() {
  hud.setCoins(save.coins);
  hud.renderLevels(LEVELS.length, urlLevel ? LEVELS.length : save.unlockedLevel, save.stars, levelIdx + 1, (id) => {
    restart(id);
    refreshMenu();
  });
  refreshToggles();
}

// ---------------------------------------------------------------- lifecycle

function restart(level?: number, newSeed?: number) {
  if (level !== undefined) levelIdx = Math.max(0, Math.min(LEVELS.length - 1, level - 1));
  if (newSeed !== undefined) seed = newSeed;
  game = new Game(LEVELS[levelIdx], seed, metaModifiers(save));
  renderer.reset();
  renderer.setLevel(LEVELS[levelIdx]);
  controls.reset();
  hud.setLevel(LEVELS[levelIdx].id);
  hud.hideEnd();
  hud.resetLevelState();
  shownEnd = false;
  hitStop = 0;
  playedFor = 0;
  acc = 0;
}

function startGame() {
  sfx.unlock();
  sfx.startMusic();
  hud.hideStart();
  paused = false;
  last = performance.now();
  if (!autoPolicy && !settings.hintSeen && levelIdx === 0) hud.showHint();
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
  sfx.startMusic();
  paused = false;
});
hud.menuBtn.addEventListener('click', () => {
  restart(levelIdx + 1);
  paused = true;
  refreshMenu();
  hud.showStart();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    paused = true;
    sfx.stopMusic();
  } else if (hud.start.classList.contains('show') === false && game.phase === 'playing') {
    // coming back mid-run: resume (the clock is reset so no time is lost in one big step)
    paused = false;
    last = performance.now();
    sfx.startMusic();
  }
});

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

// ------------------------------------------------------------------- events

function handleEvents() {
  renderer.fxEvents(game);
  for (const e of game.events) {
    switch (e.t) {
      case 'shot': sfx.shot(); break;
      case 'hit': sfx.hit(); break;
      case 'kill':
        sfx.kill();
        if (e.kind === 'boss') {
          hitStop = 0.25;
          buzz([60, 40, 140]);
        }
        break;
      case 'blockHit': case 'counterHit': sfx.blockHit(); break;
      case 'blockBreak': {
        const p = renderer.project(e.x, e.y, 1.5);
        hud.popup(e.label, p.x, p.y);
        sfx.blockBreak();
        hitStop = Math.max(hitStop, 0.06);
        buzz(25);
        break;
      }
      case 'gate': {
        const p = renderer.project(e.x, e.y, 1.5);
        hud.popup(e.label, p.x, p.y);
        sfx.gate(e.delta >= 0);
        buzz(e.delta >= 0 ? 14 : 35);
        break;
      }
      case 'squadHit': sfx.squadHit(); if (e.lost >= 3) buzz(20); break;
      case 'leak': sfx.squadHit(); buzz(30); break;
      case 'explosion': sfx.blockBreak(); break;
      case 'weapon': sfx.gate(true); buzz([15, 30, 15]); break;
      case 'win': sfx.win(); buzz([30, 40, 30, 40, 90]); break;
      case 'lose': sfx.lose(); buzz([80, 40, 120]); break;
    }
  }
}

function showEndScreen() {
  sfx.stopMusic();
  const won = game.phase === 'won';
  if (won) {
    const r = recordWin(save, game.level.id, game.level.coins, game.squad.count, game.squad.maxCount, LEVELS.length);
    const lastLevel = levelIdx + 1 >= LEVELS.length;
    hud.showEnd(true, `Survivors: ${game.squad.count}  ·  +${r.coins} coins`, lastLevel ? 'Play again' : 'Next level', r.stars);
  } else {
    hud.showEnd(false, 'Your squad was wiped out.', 'Retry');
  }
}

// --------------------------------------------------------------------- loop

function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  controls.limit = game.maxX();
  controls.update(dt);

  if (hitStop > 0) hitStop -= dt;
  else if (!paused && game.phase === 'playing') {
    acc += dt * timeScale;
    playedFor += dt;
    let guard = 0;
    while (acc >= DT && guard++ < 20 && game.phase === 'playing') {
      game.step({ targetX: autoPolicy ? autoPolicy(game) : controls.value() });
      handleEvents();
      acc -= DT;
      if (hitStop > 0) break;
    }
  }

  // first-run hint disappears as soon as the player steers (or after a while)
  if (!settings.hintSeen && (Math.abs(controls.targetX) > 0.7 || playedFor > 9)) {
    hud.hideHint();
    if (playedFor > 0) {
      settings.hintSeen = true;
      saveSettings(settings);
    }
  }
  sfx.setIntensity(game.enemies.some((e) => e.kind === 'boss' && e.awake) ? 1 : 0);

  if (game.phase !== 'playing' && !shownEnd) {
    shownEnd = true;
    showEndScreen();
  }
  renderer.render(game, dt);
  hud.update(game, renderer);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
