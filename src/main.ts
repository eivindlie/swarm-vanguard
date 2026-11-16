import { Game, DT } from './sim/game';
import { LEVELS } from './levels';
import { GameRenderer } from './render/renderer';
import { Controls } from './input/controls';
import { Hud } from './ui/hud';
import { Sfx } from './audio/sfx';
import { loadSave, metaModifiers, recordWin, writeSave } from './meta/save';
import { buy } from './meta/upgrades';
import { loadSettings, saveSettings } from './meta/settings';
import { InstallPrompt } from './ui/install';
import { installDebugApi } from './debug/api';
import { policies } from './sim/bots';

const params = new URLSearchParams(location.search);
// The whole simulation clock runs 25% faster than real time (everything scales together, so balance is
// unchanged); `?speed=` multiplies on top of it for testing.
const GAME_SPEED = 1.25;
const timeScale = Math.max(0.1, Number(params.get('speed') ?? 1)) * GAME_SPEED;
const save = loadSave();
const settings = loadSettings();
const urlLevel = params.get('level');
// levels are addressed by id (bonus levels are 101+); `levelIdx` is the position in play order
const idxOfId = (id: number) => {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 ? i : Math.max(0, Math.min(LEVELS.length - 1, id - 1));
};
let levelIdx = urlLevel ? idxOfId(Number(urlLevel)) : Math.min(save.unlockedLevel, LEVELS.length) - 1;
let seed = Number(params.get('seed') ?? 1);
// ?autoplay=balanced|greedy-expand|pure-fight|naive lets a bot play (demo / visual testing)
const autoPolicy = policies[params.get('autoplay') ?? ''];

const stage = document.getElementById('stage') as HTMLElement;
const renderer = new GameRenderer(stage);
if (params.has('theme')) renderer.themeOverride = Number(params.get('theme'));
renderer.shakeScale = settings.reduceShake ? 0 : 1;
renderer.setLowQuality(settings.lowQuality);
const controls = new Controls(stage);
const hud = new Hud();
const sfx = new Sfx();
// the home-screen prompt only appears while the menu is open, never mid-run
const install = new InstallPrompt(settings, () => saveSettings(settings), () => hud.start.classList.contains('show') && !hud.shop.classList.contains('show'));

// offline support + installability (production builds only, so dev servers are never cached)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('./sw.js').catch(() => undefined));
}
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
    { label: 'Graphics', onLabel: 'HIGH', offLabel: 'LOW', on: !settings.lowQuality, toggle: () => { settings.lowQuality = !settings.lowQuality; renderer.setLowQuality(settings.lowQuality); saveSettings(settings); refreshToggles(); } },
    { label: 'Screen shake', on: !settings.reduceShake, toggle: () => { settings.reduceShake = !settings.reduceShake; renderer.shakeScale = settings.reduceShake ? 0 : 1; saveSettings(settings); refreshToggles(); } },
  ]);
}

/** The level the big button continues from: the furthest the player has unlocked (a debug `?level=` overrides it). */
const frontierIdx = () => (urlLevel ? idxOfId(Number(urlLevel)) : Math.min(save.unlockedLevel, LEVELS.length) - 1);

function refreshMenu() {
  hud.setCoins(save.coins);
  // the big button always continues from the frontier; tapping any unlocked level plays exactly that level
  hud.renderLevels(LEVELS, urlLevel ? LEVELS.length : save.unlockedLevel, save.stars, frontierIdx(), (i) => {
    restart(LEVELS[i].id);
    startGame();
  });
  refreshToggles();
}

// ---------------------------------------------------------------- lifecycle

function restart(level?: number, newSeed?: number) {
  if (level !== undefined) levelIdx = idxOfId(level);
  if (newSeed !== undefined) seed = newSeed;
  game = new Game(LEVELS[levelIdx], seed, metaModifiers(save));
  renderer.reset();
  renderer.setLevel(LEVELS[levelIdx]);
  controls.reset();
  hud.setLevel(LEVELS[levelIdx]);
  hud.hideEnd();
  hud.resetLevelState();
  shownEnd = false;
  hitStop = 0;
  playedFor = 0;
  acc = 0;
}

function startGame() {
  if (modsDirty) {
    modsDirty = false;
    restart(LEVELS[levelIdx].id);
  }
  sfx.unlock();
  sfx.startMusic();
  install.hide();
  hud.hideStart();
  paused = false;
  last = performance.now();
  if (!autoPolicy && !settings.hintSeen && levelIdx === 0) hud.showHint();
}

hud.setLevel(LEVELS[levelIdx]);
refreshMenu();
hud.mute.textContent = sfx.muted ? '🔇' : '🔊';
hud.mute.addEventListener('click', () => {
  sfx.unlock();
  sfx.setMuted(!sfx.muted);
  hud.mute.textContent = sfx.muted ? '🔇' : '🔊';
});
// audio can only start after a user gesture
window.addEventListener('pointerdown', () => sfx.unlock(), { passive: true });
hud.startBtn.addEventListener('click', () => {
  restart(LEVELS[frontierIdx()].id);
  startGame();
});
let modsDirty = false; // purchases change the sim modifiers: rebuild the pending game on start
function onBuy(id: Parameters<typeof buy>[1]) {
  if (buy(save, id)) {
    writeSave(save);
    modsDirty = true;
    sfx.unlock();
    sfx.gate(true);
    buzz(15);
  }
  hud.renderShop(save, onBuy);
}
function openShop() {
  hud.renderShop(save, onBuy);
  hud.showShop();
}
hud.shopBtn.addEventListener('click', openShop);
hud.shopBack.addEventListener('click', () => {
  hud.hideShop();
  refreshMenu();
});
hud.endBtn.addEventListener('click', () => {
  const won = game.phase === 'won';
  restart(won && levelIdx + 1 < LEVELS.length ? LEVELS[levelIdx + 1].id : LEVELS[levelIdx].id);
  sfx.startMusic();
  paused = false;
});
hud.menuBtn.addEventListener('click', () => {
  restart(LEVELS[frontierIdx()].id);
  paused = true;
  refreshMenu();
  hud.showStart();
  window.setTimeout(() => install.maybeShow(), 700);
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
        if (e.gain >= 10) sfx.roll(e.gain);
        hitStop = Math.max(hitStop, e.big ? 0.14 : 0.06);
        buzz(e.big ? [30, 30, 60] : 25);
        if (e.big) sfx.win();
        break;
      }
      case 'gate': {
        const p = renderer.project(e.x, e.y, 1.5);
        hud.popup(e.label, p.x, p.y);
        sfx.gate(e.delta >= 0);
        if (e.delta >= 10) sfx.roll(e.delta);
        buzz(e.delta >= 0 ? 14 : 35);
        break;
      }
      case 'squadHit': sfx.squadHit(); if (e.lost >= 3) buzz(20); break;
      case 'leak': sfx.squadHit(); buzz(30); break;
      case 'explosion': sfx.blockBreak(); break;
      case 'barrelHit': sfx.blockHit(); break;
      case 'bossAdds':
        hud.showBanner('REINFORCEMENTS!', '⚠ THE BOSS CALLS');
        sfx.squadHit();
        buzz([40, 30, 80]);
        break;
      case 'weapon': sfx.gate(true); buzz([15, 30, 15]); break;
      case 'win': sfx.win(); buzz([30, 40, 30, 40, 90]); break;
      case 'lose': sfx.lose(); buzz([80, 40, 120]); break;
    }
  }
}

// ----------------------------------------------------------------- one-time tips
// Each new mechanic gets a short pill the first time it comes into view (never while autoplaying or mid-hint).
let tipClock = 0;
function maybeTip(dt: number) {
  tipClock += dt;
  if (tipClock < 0.35 || params.has('autoplay') || paused || game.phase !== 'playing' || hud.tipVisible() || hud.hintVisible()) return;
  tipClock = 0;
  const seen = (k: string) => settings.tipsSeen.includes(k);
  const sq = game.squad;
  const near = (y: number) => y > sq.y && y - sq.y < 30;
  const say = (k: string, text: string) => {
    settings.tipsSeen.push(k);
    saveSettings(settings);
    hud.showTip(text);
  };
  if (!seen('gate') && game.gates.some((g) => !g.used && g.side.op !== 'upgrade' && near(g.y))) say('gate', 'STEER INTO THE BETTER GATE');
  else if (!seen('block') && game.blocks.some((b) => near(b.y))) say('block', 'SHOOT BLOCKS TO BREAK THEM: REWARDS INSIDE');
  else if (!seen('upgrade') && game.gates.some((g) => !g.used && g.side.op === 'upgrade' && near(g.y))) say('upgrade', 'PURPLE GATE = WEAPON UPGRADE');
  else if (!seen('counter') && game.counters.some((c) => near(c.y))) say('counter', 'SHOOT THE GOLD BLOCK: ITS VALUE GROWS');
  else if (!seen('barrel') && game.barrels.some((b) => near(b.y))) say('barrel', 'SHOOT THE BARREL: BOOM!');
  else if (!seen('splitter') && game.enemies.some((e) => e.kind === 'splitter' && e.y - sq.y < 30)) say('splitter', 'SLIMES SPLIT INTO MINIS WHEN SHOT');
}

function showEndScreen() {
  sfx.stopMusic();
  const won = game.phase === 'won';
  if (won) {
    // bonus levels pay by final squad size on the FIRST clear; replays pay half the base (no coin farming)
    const first = !save.stars[game.level.id];
    const bonus = game.level.bonus && first ? Math.round(game.squad.count * 0.6) : 0;
    const base = game.level.bonus && !first ? Math.round(game.level.coins / 2) : game.level.coins;
    const r = recordWin(save, game.level.id, base, game.squad.count, game.squad.maxCount, LEVELS.length, levelIdx + 1, LEVELS[levelIdx + 1]?.bonus !== undefined, bonus);
    const lastLevel = levelIdx + 1 >= LEVELS.length;
    hud.showEnd(true, `Survivors: ${game.squad.count}  ·  +${r.coins} coins`, lastLevel ? 'Play again' : 'Next level', r.stars, game.level.bonus ? 'BONUS CLEAR!' : 'VICTORY!');
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
  maybeTip(dt);

  if (game.phase !== 'playing' && !shownEnd) {
    shownEnd = true;
    showEndScreen();
  }
  renderer.render(game, dt);
  hud.update(game, renderer);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
