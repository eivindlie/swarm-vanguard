import * as THREE from 'three';
import { Game, LANE_HALF, ENEMY_DEFS, gateLabel, type Block, type Gate } from '../sim/game';
import type { EnemyKind } from '../sim/level';

const MAX_SOLDIERS = 320;
const MAX_ENEMIES = 700;
const MAX_BULLETS = 400;

type Inst = THREE.InstancedMesh;

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
  private dummy = new THREE.Object3D();
  private camX = 0;
  private shake = 0;
  private time = 0;

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

    const geoSoldier = new THREE.CapsuleGeometry(0.17, 0.3, 3, 8);
    this.soldiers = this.makeInst(geoSoldier, new THREE.MeshLambertMaterial({ color: 0x2f6fff }), MAX_SOLDIERS);
    const mk = (kind: EnemyKind, geo: THREE.BufferGeometry, color: number) => {
      this.enemyMeshes[kind] = this.makeInst(geo, new THREE.MeshLambertMaterial({ color }), MAX_ENEMIES);
    };
    mk('grunt', new THREE.CapsuleGeometry(0.2, 0.28, 3, 8), 0xe23b3b);
    mk('runner', new THREE.ConeGeometry(0.24, 0.7, 7), 0xff8a1f);
    mk('brute', new THREE.CapsuleGeometry(0.5, 0.6, 4, 10), 0x8e1b1b);
    mk('boss', new THREE.BoxGeometry(2.6, 3, 2.2), 0x5b0f5b);
    this.bullets = this.makeInst(new THREE.BoxGeometry(0.07, 0.07, 0.55), new THREE.MeshBasicMaterial({ color: 0xffd23a }), MAX_BULLETS);

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

    this.drawSquad(game);
    this.drawEnemies(game);
    this.drawBullets(game);
    this.syncBlocks(game.blocks);
    this.syncGates(game.gates);
    this.renderer.render(this.scene, this.camera);
  }

  private drawSquad(game: Game) {
    const sq = game.squad;
    const n = Math.min(sq.count, MAX_SOLDIERS);
    // dense formation: spacing shrinks a little as the crowd grows
    const spacing = n > 120 ? 0.3 : 0.38;
    const d = this.dummy;
    for (let i = 0; i < n; i++) {
      const r = spacing * Math.sqrt(i + 0.5);
      const a = i * 2.39996;
      const bob = Math.abs(Math.sin(this.time * 12 + i * 1.7)) * 0.07;
      d.position.set(sq.x + Math.cos(a) * r, 0.33 + bob, -(sq.y + Math.sin(a) * r * 0.9));
      d.rotation.set(0, 0, 0);
      d.scale.setScalar(1);
      d.updateMatrix();
      this.soldiers.setMatrixAt(i, d.matrix);
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
      const def = ENEMY_DEFS[e.kind];
      const bob = e.awake ? Math.abs(Math.sin(e.wobble)) * 0.1 : 0;
      const baseH = e.kind === 'boss' ? 1.5 : e.kind === 'brute' ? 0.8 : e.kind === 'runner' ? 0.35 : 0.34;
      d.position.set(e.x, baseH + bob, -e.y);
      d.rotation.set(0, e.kind === 'runner' ? Math.PI : 0, 0);
      d.scale.setScalar(1);
      d.updateMatrix();
      void def;
      mesh.setMatrixAt(i, d.matrix);
    }
    (Object.keys(counts) as EnemyKind[]).forEach((k) => {
      this.enemyMeshes[k].count = counts[k];
      this.enemyMeshes[k].instanceMatrix.needsUpdate = true;
    });
  }

  private drawBullets(game: Game) {
    const d = this.dummy;
    const n = Math.min(game.bullets.length, MAX_BULLETS);
    for (let i = 0; i < n; i++) {
      const b = game.bullets[i];
      d.position.set(b.x, 0.7, -b.y);
      d.rotation.set(0, 0, 0);
      d.scale.setScalar(1);
      d.updateMatrix();
      this.bullets.setMatrixAt(i, d.matrix);
    }
    this.bullets.count = n;
    this.bullets.instanceMatrix.needsUpdate = true;
  }

  private blockText(b: Block): string {
    return b.reward.kind === 'soldiers' ? `${Math.ceil(b.hp)}` : `${Math.ceil(b.hp)}`;
  }

  private syncBlocks(blocks: Block[]) {
    const alive = new Set<number>();
    for (const b of blocks) {
      alive.add(b.id);
      let v = this.blockViews.get(b.id);
      if (!v) {
        const group = new THREE.Group();
        const isWeapon = b.reward.kind === 'weapon';
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
      const text = this.blockText(b);
      if (text !== v.shown) {
        const reward = b.reward.kind === 'soldiers' ? `+${b.reward.n}` : b.reward.label;
        void reward;
        drawLabel(v.canvas.getContext('2d')!, 256, 128, text, null, '#ffffff');
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
