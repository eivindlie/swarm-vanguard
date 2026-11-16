import { WEAPONS, type Game } from '../sim/game';
import { THEMES, themeIndexForLevel } from '../render/themes';
import { UPGRADES, levelOf } from '../meta/upgrades';
import type { SaveData } from '../meta/save';
import type { LevelDef } from '../sim/level';
import type { GameRenderer } from '../render/renderer';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export class Hud {
  private count = $('count');
  private bar = $('bar').querySelector('i') as HTMLElement;
  private lvl = $('lvl');
  private hud = $('hud');
  private weapon = $('weapon');
  private weaponShown = '';
  private boss = $('boss');
  private bossBar = $('boss').querySelector('i') as HTMLElement;
  private bossHp = $('bossHp');
  readonly start = $('start');
  readonly end = $('end');
  readonly startBtn = $<HTMLButtonElement>('startBtn');
  readonly endBtn = $<HTMLButtonElement>('endBtn');
  readonly mute = $<HTMLButtonElement>('mute');
  readonly menuBtn = $<HTMLButtonElement>('menuBtn');
  readonly shopBtn = $<HTMLButtonElement>('shopBtn');
  readonly shopBack = $<HTMLButtonElement>('shopBack');
  readonly shop = $('shop');

  private bossAnnounced = false;
  private shownCount = -1;
  private elitesAnnounced = new Set<number>();
  private bump = 0;
  private lastT = performance.now();

  /** Reset per-level HUD state (call on restart). */
  resetLevelState() {
    this.bossAnnounced = false;
    this.elitesAnnounced.clear();
    this.shownCount = -1;
    $('banner').classList.remove('show');
    this.hideHint();
  }

  showBanner(title: string, sub: string) {
    const el = $('banner');
    el.innerHTML = `<small>${sub}</small>${title}`;
    el.classList.remove('show');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('show');
  }

  showTip(text: string) {
    const el = $('tip');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }
  tipVisible(): boolean {
    return $('tip').classList.contains('show');
  }

  showHint() { $('hint').classList.add('show'); }
  hideHint() { $('hint').classList.remove('show'); }

  renderToggles(items: { label: string; on: boolean; toggle: () => void; onLabel?: string; offLabel?: string }[]) {
    const host = $('toggles');
    host.textContent = '';
    for (const it of items) {
      const b = document.createElement('button');
      b.className = 'tg' + (it.on ? ' on' : '');
      b.textContent = `${it.label}: ${it.on ? (it.onLabel ?? 'ON') : (it.offLabel ?? 'OFF')}`;
      b.addEventListener('click', () => {
        it.toggle();
      });
      host.appendChild(b);
    }
  }

  setCoins(n: number) {
    $('coins').textContent = `Coins: ${n}`;
  }

  /** Level grid in play order, grouped by world. `selected`/`unlocked` are positions (1-based unlocked count). */
  renderLevels(levels: LevelDef[], unlocked: number, stars: Record<string, number>, selected: number, onPick: (index: number) => void) {
    const host = $('levels');
    host.textContent = '';
    for (let i = 0; i < levels.length; i++) {
      const lv = levels[i];
      if (i === 0 || themeIndexForLevel(lv) !== themeIndexForLevel(levels[i - 1])) {
        const h = document.createElement('div');
        h.className = 'lvh';
        h.textContent = THEMES[themeIndexForLevel(lv)].name.toUpperCase();
        host.appendChild(h);
      }
      const b = document.createElement('button');
      b.className = 'lv' + (i === selected ? ' sel' : '') + (lv.bonus ? ' bonus' : '');
      b.disabled = i + 1 > unlocked;
      const st = stars[lv.id] ?? 0;
      const label = lv.bonus ? '🎁' : String(lv.id);
      b.innerHTML = `${label}<small>${lv.bonus ? (st ? 'DONE' : 'BONUS') : '★'.repeat(st) + '☆'.repeat(st ? 3 - st : 0)}</small>`;
      b.addEventListener('click', () => onPick(i));
      host.appendChild(b);
    }
    const cur = levels[selected];
    this.startBtn.textContent = cur.bonus ? `Play bonus: ${cur.name}` : `Play level ${cur.id}`;
  }

  showStart() { this.start.classList.add('show'); }

  renderShop(save: SaveData, onBuy: (id: (typeof UPGRADES)[number]['id']) => void) {
    $('shopCoins').textContent = `Coins: ${save.coins}`;
    const host = $('shopRows');
    host.textContent = '';
    for (const u of UPGRADES) {
      const lvl = levelOf(save, u.id);
      const maxed = lvl >= u.max;
      const row = document.createElement('div');
      row.className = 'row';
      const next = maxed ? '' : `<i>→ ${u.effect(lvl + 1)}</i>`;
      row.innerHTML = `<span class="ic">${u.icon}</span><span class="tx"><b>${u.name} · ${lvl}/${u.max}</b>${u.effect(lvl)}<br>${next}</span>`;
      const btn = document.createElement('button');
      btn.className = 'buy';
      btn.disabled = maxed || save.coins < u.cost(lvl);
      btn.textContent = maxed ? 'MAX' : `${u.cost(lvl)} 🪙`;
      btn.addEventListener('click', () => onBuy(u.id));
      row.appendChild(btn);
      host.appendChild(row);
    }
  }
  showShop() { this.shop.classList.add('show'); }
  hideShop() { this.shop.classList.remove('show'); }

  setLevel(level: LevelDef) {
    this.lvl.textContent = level.bonus ? `BONUS · ${level.name.toUpperCase()}` : `LEVEL ${level.id}`;
  }

  update(game: Game, r: GameRenderer) {
    // the number rolls towards the real value and the label bumps when the squad grows
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;
    const target = game.squad.count;
    if (this.shownCount < 0 || Math.abs(target - this.shownCount) < 0.5) this.shownCount = target;
    else {
      if (target > this.shownCount) this.bump = Math.min(1, this.bump + dt * 6);
      this.shownCount += (target - this.shownCount) * Math.min(1, dt * 9);
    }
    this.bump = Math.max(0, this.bump - dt * 3);
    this.count.textContent = String(Math.round(this.shownCount));
    this.count.style.scale = String(1 + this.bump * 0.32);
    const wname = WEAPONS[game.weapon].name;
    if (wname !== this.weaponShown) {
      this.weaponShown = wname;
      this.weapon.textContent = wname;
    }
    const p = r.project(game.squad.x, game.squad.y, 1.3);
    this.count.style.left = `${p.x}px`;
    this.count.style.top = `${p.y - 14}px`;
    for (const e of game.enemies) {
      if (e.kind === 'elite' && e.awake && !this.elitesAnnounced.has(e.id)) {
        this.elitesAnnounced.add(e.id);
        this.showBanner('WARLORD', '⚠ ELITE');
        break;
      }
    }
    const boss = game.enemies.find((e) => e.kind === 'boss');
    this.boss.classList.toggle('show', !!boss);
    if (boss && boss.awake && !this.bossAnnounced) {
      this.bossAnnounced = true;
      this.showBanner(r.theme.bossName, '⚠ WARNING');
    }
    if (boss) {
      this.bossBar.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
      this.bossHp.textContent = String(Math.ceil(boss.hp));
    }
    this.bar.style.width = `${Math.min(100, (game.squad.y / game.level.length) * 100)}%`;
  }

  popup(text: string, x: number, y: number) {
    const el = document.createElement('div');
    el.className = 'pop';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.hud.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

  showEnd(won: boolean, text: string, btn: string, stars = 0, title = 'VICTORY!') {
    ($('endTitle')).textContent = won ? title : 'DEFEAT';
    $('stars').textContent = won ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
    ($('endText')).textContent = text;
    this.endBtn.textContent = btn;
    this.end.classList.add('show');
  }
  hideEnd() { this.end.classList.remove('show'); }
  hideStart() { this.start.classList.remove('show'); }
}
