import * as THREE from 'three';
import type { Game } from '../sim/game';
import { halfWidth } from '../sim/formation';
import type { LevelDef } from '../sim/level';
import { Particles } from './fx';
import { World } from './world';
import { PropViews } from './props';
import { Crowd } from './crowd';
import { THEMES, themeForLevel, type Theme } from './themes';
import { uTime } from './materials';

const CONFETTI = [0xff5a5a, 0xffd23a, 0x5ad1ff, 0x7dff8a, 0xff7ad9];

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 9 / 16, 0.1, 260);
  readonly fx: Particles;
  readonly world: World;
  private props: PropViews;
  private crowd: Crowd;
  private camX = 0;
  private prevSqX = 0;
  private roll = 0;
  private shake = 0;
  private fovPulse = 0;
  private baseFov = 60;
  private zoom = 1;
  private time = 0;
  private dpr = 1;
  private maxDpr = 2;
  private frameAvg = 16;
  private slowFor = 0;
  private fastFor = 0;
  /** Accessibility: scale camera shake (0 disables it). */
  shakeScale = 1;
  /** Debug: force a world (0-based) regardless of level. */
  themeOverride: number | null = null;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.maxDpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = this.maxDpr;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = false; // sky pass, then the main pass
    this.renderer.info.autoReset = false; // count draw calls over both passes
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.display = 'block';

    this.world = new World(this.scene);
    this.props = new PropViews(this.scene);
    this.crowd = new Crowd(this.scene);
    this.fx = new Particles(this.scene);
    this.world.apply(THEMES[0], 1, 150);

    this.resize();
    new ResizeObserver(() => this.resize()).observe(host);
  }

  get theme(): Theme {
    return this.world.current;
  }

  /** Build the world for a level (theme, scenery, finish line). */
  setLevel(level: LevelDef) {
    const theme = this.themeOverride !== null ? THEMES[Math.max(0, Math.min(THEMES.length - 1, this.themeOverride))] : themeForLevel(level);
    this.world.apply(theme, level.id, level.length);
    this.crowd.setBossVariant(theme.boss);
  }

  /** Drop every per-entity view: a new Game restarts entity ids, so stale views would be reused. */
  reset() {
    this.props.reset();
    this.crowd.reset();
    this.shake = 0;
    this.fovPulse = 0;
    this.camX = 0;
    this.prevSqX = 0;
  }

  viewMismatches(game: Game): number {
    return this.props.mismatches(game);
  }

  /** Turn sim events into particles/shake/flash. Call after each sim step. */
  fxEvents(game: Game) {
    const sq = game.squad;
    for (const e of game.events) {
      switch (e.t) {
        case 'shot':
          this.fx.burst(sq.x, sq.y + 0.9, 0.7, 3, 0xffe27a, 1.2, 0.1, 0.12, 0.4);
          break;
        case 'hit':
          this.crowd.hit(e.id);
          this.fx.burst(e.x, e.y, 0.5, 1, 0xfff1a8, 1.5, 0.08, 0.2, 1);
          break;
        case 'kill':
          this.crowd.enemyDied(e.kind, e.x, e.y);
          this.fx.burst(e.x, e.y, 0.4, e.kind === 'boss' ? 60 : e.kind === 'brute' || e.kind === 'splitter' ? 16 : 5, e.kind === 'boss' ? 0xffd27a : e.kind === 'splitter' || e.kind === 'mini' ? 0x6fe06f : 0xe05a3a, e.kind === 'boss' ? 7 : 2.4, e.kind === 'boss' ? 0.3 : 0.14, 0.55, 3);
          if (e.kind === 'boss') this.addShake(0.7);
          else if (e.kind === 'brute') this.addShake(0.12);
          break;
        case 'blockHit':
          this.fx.burst(e.x, e.y, 0.9, 2, 0xcfd6dd, 2, 0.1, 0.35, 2);
          break;
        case 'barrelHit':
          this.fx.burst(e.x, e.y, 0.8, 3, 0xff9a3a, 2.2, 0.1, 0.35, 2.5);
          break;
        case 'bossAdds':
          this.fx.burst(e.x, e.y, 1.2, 40, 0xff5a5a, 6, 0.2, 0.9, 5);
          this.addShake(0.35);
          break;
        case 'counterHit':
          this.fx.burst(e.x, e.y, 0.9, 2, 0xffd23a, 2, 0.09, 0.35, 2);
          break;
        case 'blockBreak':
          this.fx.burst(e.x, e.y, 1, e.big ? 60 : 30, 0xcfd6dd, e.big ? 7 : 4.5, 0.2, 0.8, 4);
          this.fx.burst(e.x, e.y, 1, e.big ? 36 : 12, 0xffd23a, e.big ? 6 : 3.5, 0.15, 0.9, 5);
          if (e.big) {
            // a jackpot: a fountain of confetti
            for (const c of CONFETTI) this.fx.burst(e.x, e.y, 1.5, 14, c, 6, 0.16, 1.5, 9);
          }
          this.addShake(e.big ? 0.55 : 0.3);
          this.fovPulse = Math.max(this.fovPulse, e.big ? 1 : 0.8);
          break;
        case 'gate':
          this.fx.burst(sq.x, sq.y, 0.6, 18, e.delta >= 0 ? 0x6fb4ff : 0xff6a6a, 4, 0.14, 0.7, 4);
          if (e.delta > 0) this.fovPulse = Math.max(this.fovPulse, 1);
          break;
        case 'weapon':
          this.fx.burst(sq.x, sq.y + 1, 1, 24, 0xffe27a, 5, 0.15, 0.8, 5);
          break;
        case 'explosion':
          this.fx.burst(e.x, e.y, 0.6, 22, 0xff9a2a, 5, 0.2, 0.5, 3);
          this.fx.burst(e.x, e.y, 0.6, 10, 0xffe27a, 3, 0.14, 0.4, 3);
          this.addShake(0.15);
          break;
        case 'leak':
          this.fx.burst(e.x, e.y, 0.5, 14, 0xff3030, 4, 0.18, 0.6, 3);
          this.addShake(0.25);
          break;
        case 'squadHit':
          this.crowd.soldiersDied(e.lost, game);
          this.fx.burst(sq.x, sq.y, 0.5, Math.min(8, e.lost + 2), 0x7fb0ff, 2.5, 0.12, 0.45, 2.5);
          break;
        case 'win':
          // confetti fountain over the squad
          for (let i = 0; i < 5; i++) {
            for (const c of CONFETTI) this.fx.burst(sq.x + (i - 2) * 1.2, sq.y + 2, 1.2, 8, c, 5, 0.16, 1.6, 9);
          }
          break;
      }
    }
  }

  resize() {
    const w = this.host.clientWidth || 360;
    const h = this.host.clientHeight || 640;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    // keep horizontal coverage constant (tuned at 9:16, vfov 60) so the lane always fits
    const halfH = Math.tan((30 * Math.PI) / 180) * (9 / 16);
    this.baseFov = Math.min(95, ((2 * Math.atan(halfH / this.camera.aspect)) * 180) / Math.PI);
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  addShake(a: number) {
    this.shake = Math.min(0.7, this.shake + a * this.shakeScale);
  }

  /** Screen position (CSS px, relative to host) of a sim-space point; used for DOM overlays. */
  project(x: number, y: number, h = 0.8): { x: number; y: number } {
    const v = new THREE.Vector3(x, h, -y).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.host.clientWidth, y: ((1 - v.y) / 2) * this.host.clientHeight };
  }

  /** Lower the pixel ratio when frames are slow, raise it again when there is headroom. */
  private adaptQuality(dt: number) {
    this.frameAvg += (dt * 1000 - this.frameAvg) * 0.05;
    if (this.frameAvg > 26 && this.dpr > 1) {
      this.slowFor += dt;
      this.fastFor = 0;
      if (this.slowFor > 1.2) {
        this.dpr = Math.max(1, this.dpr - 0.25);
        this.slowFor = 0;
        this.resize();
      }
    } else if (this.frameAvg < 15 && this.dpr < this.maxDpr) {
      this.fastFor += dt;
      this.slowFor = 0;
      if (this.fastFor > 4) {
        this.dpr = Math.min(this.maxDpr, this.dpr + 0.25);
        this.fastFor = 0;
        this.resize();
      }
    } else {
      this.slowFor = this.fastFor = 0;
    }
  }

  render(game: Game, dt: number) {
    this.time += dt;
    uTime.value = this.time;
    this.adaptQuality(dt);

    const sq = game.squad;
    // camera: follows the squad, backs off a little as the crowd gets wider
    const wide = Math.max(0, Math.min(1, (halfWidth(sq.count) - 1) / 2.4));
    this.zoom += ((1 + wide * 0.2) - this.zoom) * Math.min(1, dt * 2);
    this.camX += (sq.x * 0.35 - this.camX) * Math.min(1, dt * 6);
    const vx = dt > 0 ? (sq.x - this.prevSqX) / dt : 0;
    this.prevSqX = sq.x;
    this.roll += (Math.max(-1, Math.min(1, vx / 9)) * 0.035 - this.roll) * Math.min(1, dt * 5);

    const sh = this.shake;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const jx = (Math.random() - 0.5) * sh * 0.4;
    const jy = (Math.random() - 0.5) * sh * 0.4;
    this.camera.position.set(this.camX + jx, 11.8 * this.zoom + jy, -sq.y + 10.2 * this.zoom);
    this.camera.lookAt(this.camX, 0, -sq.y - 11.5);
    this.camera.rotateZ(-this.roll);

    this.fovPulse = Math.max(0, this.fovPulse - dt * 3.2);
    const pulse = Math.sin(Math.min(1, this.fovPulse) * Math.PI * 0.5);
    this.camera.fov = this.baseFov + pulse * 3.5;
    this.camera.updateProjectionMatrix();

    this.world.update(dt, this.camera);
    this.crowd.draw(game, dt, this.camera);
    this.fx.update(dt);
    this.props.update(game, dt);

    this.renderer.info.reset();
    this.renderer.clear();
    this.world.renderSky(this.renderer, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
  }

  /** Performance proxy: draw calls / triangles / instance counts (headless FPS is meaningless for phones). */
  stats() {
    const info = this.renderer.info;
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      ...this.crowd.stats(),
      dpr: this.dpr,
      views: this.props.counts(),
    };
  }
}
