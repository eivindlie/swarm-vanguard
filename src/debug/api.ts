import type { Game } from '../sim/game';
import type { GameRenderer } from '../render/renderer';
import type { Controls } from '../input/controls';

export interface DebugHooks {
  getGame(): Game;
  renderer: GameRenderer;
  controls: Controls;
  getInput(): number;
  restart(level?: number, seed?: number): void;
  setPaused(p: boolean): void;
  start(): void;
}

/** window.__game: lets Playwright (and me) inspect and drive the live game. */
export function installDebugApi(h: DebugHooks) {
  (window as any).__game = {
    getState: () => h.getGame().snapshot(),
    stats: () => h.renderer.stats(),
    setInput: (x: number | null) => (h.controls.override = x),
    step: (n = 1) => {
      const g = h.getGame();
      for (let i = 0; i < n; i++) {
        g.step({ targetX: h.getInput() });
        h.renderer.fxEvents(g);
      }
      h.renderer.render(g, 1 / 60);
      return g.snapshot();
    },
    pause: () => h.setPaused(true),
    resume: () => h.setPaused(false),
    restart: (level?: number, seed?: number) => h.restart(level, seed),
    start: () => h.start(),
    stress: (n = 320) => {
      const g = h.getGame();
      g.debugSpawn('grunt', n, 12);
      g.squad.count = Math.max(g.squad.count, 100);
    },
    raw: () => h.getGame(),
  };
}
