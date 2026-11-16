import type { Game } from '../sim/game';
import type { GameRenderer } from '../render/renderer';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export class Hud {
  private count = $('count');
  private bar = $('bar').querySelector('i') as HTMLElement;
  private lvl = $('lvl');
  private hud = $('hud');
  private boss = $('boss');
  private bossBar = $('boss').querySelector('i') as HTMLElement;
  private bossHp = $('bossHp');
  readonly start = $('start');
  readonly end = $('end');
  readonly startBtn = $<HTMLButtonElement>('startBtn');
  readonly endBtn = $<HTMLButtonElement>('endBtn');
  readonly mute = $<HTMLButtonElement>('mute');
  readonly menuBtn = $<HTMLButtonElement>('menuBtn');

  setCoins(n: number) {
    $('coins').textContent = `Coins: ${n}`;
  }

  renderLevels(total: number, unlocked: number, stars: Record<string, number>, selected: number, onPick: (id: number) => void) {
    const host = $('levels');
    host.textContent = '';
    for (let id = 1; id <= total; id++) {
      const b = document.createElement('button');
      b.className = 'lv' + (id === selected ? ' sel' : '');
      b.disabled = id > unlocked;
      const st = stars[id] ?? 0;
      b.innerHTML = `${id}<small>${'★'.repeat(st)}${'☆'.repeat(st ? 3 - st : 0)}</small>`;
      b.addEventListener('click', () => onPick(id));
      host.appendChild(b);
    }
    this.startBtn.textContent = `Play level ${selected}`;
  }

  showStart() { this.start.classList.add('show'); }

  setLevel(id: number) {
    this.lvl.textContent = `LEVEL ${id}`;
  }

  update(game: Game, r: GameRenderer) {
    this.count.textContent = String(game.squad.count);
    const p = r.project(game.squad.x, game.squad.y, 1.3);
    this.count.style.left = `${p.x}px`;
    this.count.style.top = `${p.y - 14}px`;
    const boss = game.enemies.find((e) => e.kind === 'boss');
    this.boss.classList.toggle('show', !!boss);
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

  showEnd(won: boolean, text: string, btn: string, stars = 0) {
    ($('endTitle')).textContent = won ? 'VICTORY!' : 'DEFEAT';
    $('stars').textContent = won ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
    ($('endText')).textContent = text;
    this.endBtn.textContent = btn;
    this.end.classList.add('show');
  }
  hideEnd() { this.end.classList.remove('show'); }
  hideStart() { this.start.classList.remove('show'); }
}
