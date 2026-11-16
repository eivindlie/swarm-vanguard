import * as THREE from 'three';
import { Game, LANE_HALF, gateLabel, type Block, type Counter, type Gate } from '../sim/game';
import type { EnemyKind, WeaponType } from '../sim/level';
import { Rng } from '../sim/rng';
import { slot } from '../sim/formation';
import { Particles } from './fx';
import { soldierGeometry, gruntGeometry, runnerGeometry, bruteGeometry, bossGeometry, cactusGeometry, rockGeometry, mesaGeometry } from './models';

const MAX_SOLDIERS = 320;
const MAX_ENEMIES = 700;
const MAX_BULLETS = 400;

type Inst = THREE.InstancedMesh;

const BULLET_STYLE: Record<WeaponType, { color: number; s: [number, number, number] }> = {
  rifle: { color: 0xffd23a, s: [1, 1, 1] },
  shotgun: { color: 0xffffff, s: [0.9, 0.9, 0.45] },
  rocket: { color: 0xff7a1a, s: [3, 3, 1.5] },
  laser: { color: 0x59f0ff, s: [0.8, 0.8, 3] },
};

const labelCache = new Map<string, THREE.CanvasTexture>();

function drawLabel(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, bg: string | null, fg: string) {
  ctx.clearRect(0, 0, w, h);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.font = `900 ${Math.floor(h * 0.62)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.floor(h * 0.12);
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(text, w / 2, h / 2 + h * 0.04);
  ctx.fillStyle = fg;
  ctx.fillText(text, w / 2, h / 2 + h * 0.04);
}

function drawBlockLabel(ctx: CanvasRenderingContext2D, hp: string, reward: string, rewardColor: string) {
  ctx.clearRect(0, 0, 256, 128);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.font = '900 46px system-ui, sans-serif';
  ctx.lineWidth = 9;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.strokeText(reward, 128, 36);
  ctx.fillStyle = rewardColor;
  ctx.fillText(reward, 128, 36);
  ctx.font = '900 56px system-ui, sans-serif';
  ctx.strokeText(hp, 128, 94);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(hp, 128, 94);
}

function gateTexture(text: string, bad: boolean): THREE.CanvasTexture {
  const key = `${text}|${bad}`;
  let t = labelCache.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 160;
    drawLabel(c.getContext('2d')!, 256, 160, text, bad ? 'rgba(220,50,50,0.55)' : 'rgba(40,120,255,0.55)', '#ffffff');
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    labelCache.set(key, t);
  }
  return t;
}

interface BlockView {
  group: THREE.Group;
  canvas: HTMLCanvasElement;
  tex: THREE.CanvasTexture;
  shown: string;
}

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 9 / 16, 0.1, 200);
  private soldiers: Inst;
  private enemyMeshes = {} as Record<EnemyKind, Inst>;
  private bullets: Inst;
  private blockViews = new Map<number, BlockView>();
  private gateViews = new Map<number, THREE.Mesh>();
  private counterViews = new Map<number, BlockView>();
  private dummy = new THREE.Object3D();
  private camX = 0;
  private shake = 0;
  private time = 0;
  readonly fx: Particles;
  private shadows!: Inst;
  private shadowN = 0;
  private tmpColor = new THREE.Color();

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.display = 'block';

    this.scene.background = new THREE.Color(0x8fd3f4);
    this.scene.fog = new THREE.Fog(0x8fd3f4, 45, 90);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd9b77a, 1.5));
    const sun = new THREE.DirectionalLight(0xfff2d6, 2.2);
    sun.position.set(-6, 14, 6);
    this.scene.add(sun);

    this.buildWorld(400);

    this.buildDecor(260);
    const vcMat = () => new THREE.MeshLambertMaterial({ vertexColors: true });
    this.soldiers = this.makeInst(soldierGeometry(), vcMat(), MAX_SOLDIERS);
    const mk = (kind: EnemyKind, geo: THREE.BufferGeometry, max = MAX_ENEMIES) => {
      this.enemyMeshes[kind] = this.makeInst(geo, vcMat(), max);
    };
    mk('grunt', gruntGeometry());
    mk('runner', runnerGeometry());
    mk('brute', bruteGeometry(), 80);
    mk('boss', bossGeometry(), 2);
    // cheap blob shadows for every unit (one draw call)
    const shadowGeo = new THREE.CircleGeometry(0.28, 10);
    shadowGeo.rotateX(-Math.PI / 2);
    this.shadows = this.makeInst(shadowGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }), MAX_SOLDIERS + MAX_ENEMIES + 80);
    this.fx = new Particles(this.scene);
    this.bullets = this.makeInst(new THREE.BoxGeometry(0.07, 0.07, 0.55), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_BULLETS);

    this.resize();
    new ResizeObserver(() => this.resize()).observe(host);
  }

  private makeInst(geo: THREE.BufferGeometry, mat: THREE.Material, max: number): Inst {
    const m = new THREE.InstancedMesh(geo, mat, max);
    m.count = 0;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(m);
    return m;
  }

  private buildWorld(length: number) {
    // ground with tiled sand texture
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#e8c98a';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#dfbb78';
    g.fillRect(0, 0, 128, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(4, length / 4);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(LANE_HALF * 2, length + 60),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -(length - 60) / 2);
    this.scene.add(ground);

    // outer desert + lane walls
    const desert = new THREE.Mesh(
      new THREE.PlaneGeometry(120, length + 60),
      new THREE.MeshLambertMaterial({ color: 0xf0d9a0 }),
    );
    desert.rotation.x = -Math.PI / 2;
    desert.position.set(0, -0.05, -(length - 60) / 2);
    this.scene.add(desert);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xc9a56a });
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, length + 60), wallMat);
      wall.position.set(s * (LANE_HALF + 0.25), 0.35, -(length - 60) / 2);
      this.scene.add(wall);
    }
  }

  private buildDecor(length: number) {
    const rng = new Rng(1234);
    const place = (geo: THREE.BufferGeometry, n: number, minX: number, maxX: number, scale: [number, number]) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }), n);
      const d = new THREE.Object3D();
      for (let i = 0; i < n; i++) {
        const side = rng.next() < 0.5 ? -1 : 1;
        d.position.set(side * rng.range(minX, maxX), 0, -rng.range(-20, length));
        d.rotation.set(0, rng.range(0, 6.28), 0);
        d.scale.setScalar(rng.range(scale[0], scale[1]));
        d.updateMatrix();
        m.setMatrixAt(i, d.matrix);
      }
      m.frustumCulled = false;
      this.scene.add(m);
    };
    place(cactusGeometry(), 90, LANE_HALF + 1.2, LANE_HALF + 9, [0.9, 1.6]);
    place(rockGeometry(), 110, LANE_HALF + 0.9, LANE_HALF + 14, [0.6, 1.8]);
    place(mesaGeometry(), 22, LANE_HALF + 14, LANE_HALF + 34, [1.2, 2.4]);
  }

  /** Turn sim events into particles/shake. Call after each sim step. */
  fxEvents(game: Game) {
    const sq = game.squad;
    for (const e of game.events) {
      switch (e.t) {
        case 'shot':
          this.fx.burst(sq.x, sq.y + 0.9, 0.7, 3, 0xffe27a, 1.2, 0.1, 0.12, 0.4);
          break;
        case 'hit':
          this.fx.burst(e.x, e.y, 0.5, 1, 0xfff1a8, 1.5, 0.08, 0.2, 1);
          break;
        case 'kill':
          this.fx.burst(e.x, e.y, 0.4, e.kind === 'boss' ? 50 : e.kind === 'brute' ? 14 : 5, e.kind === 'boss' ? 0xc27bff : 0xd93636, e.kind === 'boss' ? 7 : 2.4, e.kind === 'boss' ? 0.3 : 0.14, 0.55, 3);
          if (e.kind === 'boss') this.addShake(0.6);
          break;
        case 'blockHit':
          this.fx.burst(e.x, e.y, 0.9, 2, 0xcfd6dd, 2, 0.1, 0.35, 2);
          break;
        case 'counterHit':
          this.fx.burst(e.x, e.y, 0.9, 2, 0xffd23a, 2, 0.09, 0.35, 2);
          break;
        case 'blockBreak':
          this.fx.burst(e.x, e.y, 1, 30, 0xcfd6dd, 4.5, 0.2, 0.8, 4);
          this.fx.burst(e.x, e.y, 1, 12, 0xffd23a, 3.5, 0.15, 0.8, 5);
          break;
        case 'gate':
          this.fx.burst(sq.x, sq.y, 0.6, 18, e.delta >= 0 ? 0x6fb4ff : 0xff6a6a, 4, 0.14, 0.7, 4);
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
          this.fx.burst(sq.x, sq.y, 0.5, Math.min(8, e.lost + 2), 0x7fb0ff, 2.5, 0.12, 0.45, 2.5);
          break;
      }
    }
  }

  resize() {
    const w = this.host.clientWidth || 360;
    const h = this.host.clientHeight || 640;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    // keep horizontal coverage constant (tuned at 9:16, vfov 60) so the lane always fits
    const halfH = Math.tan((30 * Math.PI) / 180) * (9 / 16);
    this.camera.fov = Math.min(95, ((2 * Math.atan(halfH / this.camera.aspect)) * 180) / Math.PI);
    this.camera.updateProjectionMatrix();
  }

  addShake(a: number) {
    this.shake = Math.min(0.6, this.shake + a);
  }

  /** Screen position (CSS px, relative to host) of a sim-space point; used for DOM overlays. */
  project(x: number, y: number, h = 0.8): { x: number; y: number } {
    const v = new THREE.Vector3(x, h, -y).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.host.clientWidth, y: ((1 - v.y) / 2) * this.host.clientHeight };
  }

  render(game: Game, dt: number) {
    this.time += dt;
    const sq = game.squad;
    this.camX += (sq.x * 0.35 - this.camX) * Math.min(1, dt * 6);
    const sh = this.shake;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const jx = (Math.random() - 0.5) * sh * 0.4;
    const jy = (Math.random() - 0.5) * sh * 0.4;
    this.camera.position.set(this.camX + jx, 12.5 + jy, -sq.y + 10.5);
    this.camera.lookAt(this.camX, 0, -sq.y - 7);

    this.shadowN = 0;
    this.drawSquad(game);
    this.drawEnemies(game);
    this.drawShadowsEnd();
    this.fx.update(dt);
    this.drawBullets(game);
    this.syncBlocks(game.blocks);
    this.syncGates(game.gates);
    this.syncCounters(game.counters);
    this.renderer.render(this.scene, this.camera);
  }

  private drawSquad(game: Game) {
    const sq = game.squad;
    const n = Math.min(sq.count, MAX_SOLDIERS);
    const d = this.dummy;
    for (let i = 0; i < n; i++) {
      // same formation the simulation uses for bullets and collisions
      const s = slot(i, sq.count);
      const ph = this.time * 12 + i * 1.7;
      const bob = Math.abs(Math.sin(ph)) * 0.08;
      const px = sq.x + s.dx;
      const pz = -(sq.y + s.dy);
      d.position.set(px, bob, pz);
      d.rotation.set(-0.12, 0, Math.sin(ph) * 0.1);
      d.scale.setScalar(1);
      d.updateMatrix();
      this.soldiers.setMatrixAt(i, d.matrix);
      this.pushShadow(px, pz, 1);
    }
    this.soldiers.count = n;
    this.soldiers.instanceMatrix.needsUpdate = true;
  }

  private drawEnemies(game: Game) {
    const counts: Record<EnemyKind, number> = { grunt: 0, runner: 0, brute: 0, boss: 0 };
    const d = this.dummy;
    for (const e of game.enemies) {
      const mesh = this.enemyMeshes[e.kind];
      const i = counts[e.kind];
      if (i >= MAX_ENEMIES) continue;
      counts[e.kind]++;
      const big = e.kind === 'boss' ? 0.5 : 0;
      const bob = e.awake ? Math.abs(Math.sin(e.wobble)) * (e.kind === 'boss' ? 0.08 : 0.1) : 0;
      d.position.set(e.x, bob, -e.y);
      // face the squad (models face -Z, so turn around), with a little waddle
      d.rotation.set(0, Math.PI, e.awake ? Math.sin(e.wobble) * (e.kind === 'boss' ? 0.03 : 0.12) : 0);
      d.scale.setScalar(1);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      this.pushShadow(e.x, -e.y, e.kind === 'boss' ? 5.5 : e.kind === 'brute' ? 2.6 : 1.1 + big);
    }
    (Object.keys(counts) as EnemyKind[]).forEach((k) => {
      this.enemyMeshes[k].count = counts[k];
      this.enemyMeshes[k].instanceMatrix.needsUpdate = true;
    });
  }

  private pushShadow(x: number, z: number, scale: number) {
    if (this.shadowN >= this.shadows.instanceMatrix.count) return;
    const d = this.dummy;
    d.position.set(x, 0.02, z);
    d.rotation.set(0, 0, 0);
    d.scale.setScalar(scale);
    d.updateMatrix();
    this.shadows.setMatrixAt(this.shadowN++, d.matrix);
  }

  private drawShadowsEnd() {
    this.shadows.count = this.shadowN;
    this.shadows.instanceMatrix.needsUpdate = true;
  }

  private drawBullets(game: Game) {
    const d = this.dummy;
    const n = Math.min(game.bullets.length, MAX_BULLETS);
    for (let i = 0; i < n; i++) {
      const b = game.bullets[i];
      const st = BULLET_STYLE[b.kind];
      d.position.set(b.x, 0.7, -b.y);
      d.rotation.set(0, -Math.atan2(b.vx, b.vy), 0);
      d.scale.set(st.s[0], st.s[1], st.s[2]);
      d.updateMatrix();
      this.bullets.setMatrixAt(i, d.matrix);
      this.bullets.setColorAt(i, this.tmpColor.set(st.color));
    }
    if (this.bullets.instanceColor) this.bullets.instanceColor.needsUpdate = true;
    this.bullets.count = n;
    this.bullets.instanceMatrix.needsUpdate = true;
  }

  private syncBlocks(blocks: Block[]) {
    const alive = new Set<number>();
    for (const b of blocks) {
      alive.add(b.id);
      let v = this.blockViews.get(b.id);
      if (!v) {
        const group = new THREE.Group();
        const isWeapon = b.reward.kind !== 'soldiers';
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(b.w, 1.5, b.d),
          new THREE.MeshLambertMaterial({ color: isWeapon ? 0xe0a21a : 0x8d98a5 }),
        );
        box.position.y = 0.75;
        group.add(box);
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
        sprite.scale.set(2.4, 1.2, 1);
        sprite.position.set(0, 2.1, b.d / 2);
        sprite.renderOrder = 10;
        group.add(sprite);
        group.position.set(b.x, 0, -b.y);
        this.scene.add(group);
        v = { group, canvas, tex, shown: '' };
        this.blockViews.set(b.id, v);
      }
      const text = `${Math.ceil(b.hp)}`;
      if (text !== v.shown) {
        const soldiers = b.reward.kind === 'soldiers';
        const reward = b.reward.kind === 'soldiers' ? `+${b.reward.n}` : b.reward.label;
        drawBlockLabel(v.canvas.getContext('2d')!, text, reward, soldiers ? '#7fc4ff' : '#ffe27a');
        v.tex.needsUpdate = true;
        v.shown = text;
      }
    }
    for (const [id, v] of this.blockViews) {
      if (!alive.has(id)) {
        this.scene.remove(v.group);
        v.tex.dispose();
        this.blockViews.delete(id);
      }
    }
  }

  private syncCounters(counters: Counter[]) {
    const alive = new Set<number>();
    for (const c of counters) {
      alive.add(c.id);
      let v = this.counterViews.get(c.id);
      if (!v) {
        const group = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(c.w, 0.9, 1.0), new THREE.MeshLambertMaterial({ color: 0xffc21a }));
        box.position.y = 0.45;
        group.add(box);
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
        sprite.scale.set(2.4, 1.2, 1);
        sprite.position.set(0, 1.7, 0.4);
        sprite.renderOrder = 10;
        group.add(sprite);
        group.position.set(c.x, 0, -c.y);
        this.scene.add(group);
        v = { group, canvas, tex, shown: '' };
        this.counterViews.set(c.id, v);
      }
      const text = `+${Math.floor(c.value)}`;
      if (text !== v.shown) {
        drawLabel(v.canvas.getContext('2d')!, 256, 128, text, null, '#ffe27a');
        v.tex.needsUpdate = true;
        v.shown = text;
        v.group.scale.setScalar(1.12); // little pulse on change
      }
      v.group.scale.setScalar(Math.max(1, v.group.scale.x - 0.01));
    }
    for (const [id, v] of this.counterViews) {
      if (!alive.has(id)) {
        this.scene.remove(v.group);
        v.tex.dispose();
        this.counterViews.delete(id);
      }
    }
  }

  private syncGates(gates: Gate[]) {
    const alive = new Set<number>();
    for (const g of gates) {
      alive.add(g.id);
      if (!this.gateViews.has(g.id)) {
        const bad = g.side.op === 'sub' || g.side.op === 'div';
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(g.w - 0.1, 2.4),
          new THREE.MeshBasicMaterial({ map: gateTexture(gateLabel(g.side), bad), transparent: true, side: THREE.DoubleSide, depthWrite: false }),
        );
        m.position.set(g.x, 1.3, -g.y);
        this.scene.add(m);
        this.gateViews.set(g.id, m);
      }
    }
    for (const [id, m] of this.gateViews) {
      if (!alive.has(id)) {
        this.scene.remove(m);
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
        this.gateViews.delete(id);
      }
    }
  }

  /** Performance proxy: draw calls / instance counts (headless FPS is meaningless for phones). */
  stats() {
    const info = this.renderer.info;
    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      soldiers: this.soldiers.count,
      enemies: Object.values(this.enemyMeshes).reduce((a, m) => a + m.count, 0),
      bullets: this.bullets.count,
    };
  }
}
