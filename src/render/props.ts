import * as THREE from 'three';
import { Game, gateLabel, type Barrel, type Block, type Counter, type Gate, type Pickup } from '../sim/game';
import { propMaterial } from './materials';
import { barrelGeometry, blockGeometry, counterGeometry, gateFrameGeometry, keystoneGeometry, rewardRoofGeometry, rubbleGeometry, tileGeometry } from './models';

// ------------------------------------------------------------------ textures

function mkCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function outlinedText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string) {
  g.font = `900 ${size}px system-ui, -apple-system, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = Math.round(size * 0.2);
  g.strokeStyle = 'rgba(10,12,30,0.85)';
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

const labelCache = new Map<string, THREE.CanvasTexture>();
const chevronCache = new Map<string, THREE.CanvasTexture>();

function textTexture(text: string, fill = '#ffffff'): THREE.CanvasTexture {
  const key = `${text}|${fill}`;
  let t = labelCache.get(key);
  if (!t) {
    const [c, g] = mkCanvas(256, 160);
    // long upgrade labels shrink to fit the gate; short numbers stay big
    let size = 112;
    g.font = `900 ${size}px system-ui, -apple-system, sans-serif`;
    while (size > 28 && g.measureText(text).width > 222) {
      size -= 4;
      g.font = `900 ${size}px system-ui, -apple-system, sans-serif`;
    }
    outlinedText(g, text, 128, 84, size, fill);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    labelCache.set(key, t);
  }
  return t;
}

/** Scrolling chevron pattern for gate panels (one shared texture per colour; offset is animated). */
function chevronTexture(color: string): THREE.CanvasTexture {
  let t = chevronCache.get(color);
  if (!t) {
    const [c, g] = mkCanvas(64, 64);
    g.fillStyle = color;
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = 9;
    g.lineJoin = 'miter';
    g.beginPath();
    g.moveTo(6, 52);
    g.lineTo(32, 28);
    g.lineTo(58, 52);
    g.stroke();
    t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 1.6);
    t.colorSpace = THREE.SRGBColorSpace;
    chevronCache.set(color, t);
  }
  return t;
}

function crackTexture(stage: number): THREE.CanvasTexture {
  const [c, g] = mkCanvas(256, 128);
  g.strokeStyle = 'rgba(20,22,40,0.8)';
  g.lineCap = 'round';
  const lines: [number, number, number, number][][] = [
    [[120, 10, 134, 50], [134, 50, 112, 82], [112, 82, 128, 120]],
    [[40, 20, 70, 44], [70, 44, 58, 76], [200, 12, 176, 52], [176, 52, 196, 96]],
    [[16, 60, 52, 70], [52, 70, 40, 108], [236, 40, 206, 72], [150, 70, 182, 104], [90, 60, 104, 110]],
  ];
  for (let s = 0; s < stage; s++) {
    g.lineWidth = 5 - s;
    for (const [x1, y1, x2, y2] of lines[s]) {
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const cracks = [1, 2, 3].map(crackTexture);

function blockLabel(g: CanvasRenderingContext2D, hp: string, reward: string, rewardColor: string) {
  g.clearRect(0, 0, 256, 128);
  outlinedText(g, reward, 128, 34, 44, rewardColor);
  outlinedText(g, hp, 128, 92, 62, '#ffffff');
}

// -------------------------------------------------------------------- views

/** Free what a view owns: its plane geometries and materials. Merged prop geometries are cached and shared. */
function disposeView(group: THREE.Group) {
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry && m.geometry.type === 'PlaneGeometry') m.geometry.dispose();
    (m.material as THREE.Material | undefined)?.dispose();
  });
}

interface BlockView {
  group: THREE.Group;
  body: THREE.Mesh;
  mat: THREE.MeshToonMaterial;
  base: THREE.Color;
  canvas: HTMLCanvasElement;
  tex: THREE.CanvasTexture;
  crack: THREE.Mesh;
  rubble?: THREE.Mesh;
  crackStage: number;
  shown: string;
  lastHp: number;
  pulse: number;
}

interface GateView {
  group: THREE.Group;
  panel: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  used: boolean;
}

const GOOD = '#2f7bff';
const BAD = '#e23b3b';
const UP = '#9b4dff';

interface BarrelView {
  mesh: THREE.Mesh;
  mat: THREE.MeshToonMaterial;
  lastHp: number;
  pulse: number;
  phase: number;
}

export class PropViews {
  private blocks = new Map<number, BlockView>();
  private counters = new Map<number, BlockView>();
  private gates = new Map<number, GateView>();
  private barrels = new Map<number, BarrelView>();
  private time = 0;
  private tilesSmall: THREE.InstancedMesh;
  private tilesBig: THREE.InstancedMesh;
  private tileDummy = new THREE.Object3D();
  private pickupCount = 0;

  constructor(private scene: THREE.Scene) {
    const mk = (gold: boolean) => {
      const m = new THREE.InstancedMesh(tileGeometry(gold), propMaterial(), 120);
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
      return m;
    };
    this.tilesSmall = mk(false);
    this.tilesBig = mk(true);
  }

  /** Floor tiles of a siege: gentle bob and sway so they read as collectible. */
  private syncPickups(pickups: Pickup[]) {
    const d = this.tileDummy;
    let s = 0;
    let b = 0;
    for (const p of pickups) {
      const big = p.value >= 10;
      const mesh = big ? this.tilesBig : this.tilesSmall;
      const i = big ? b++ : s++;
      if (i >= 120) continue;
      d.position.set(p.x, 0.12 + Math.sin(this.time * 3 + p.id) * 0.07 + (big ? 0.1 : 0), -p.y);
      d.rotation.set(0, Math.sin(this.time * 1.4 + p.id) * 0.3, 0);
      d.scale.setScalar(big ? 1.7 : 1.15);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
    }
    this.tilesSmall.count = Math.min(120, s);
    this.tilesBig.count = Math.min(120, b);
    this.tilesSmall.instanceMatrix.needsUpdate = true;
    this.tilesBig.instanceMatrix.needsUpdate = true;
    this.pickupCount = pickups.length;
  }

  update(game: Game, dt: number) {
    this.time += dt;
    // animate the chevron scroll once per colour
    for (const t of chevronCache.values()) t.offset.y -= dt * 0.9;
    this.syncBlocks(game.blocks, dt);
    this.syncCounters(game.counters, dt);
    this.syncGates(game.gates, dt);
    this.syncBarrels(game.barrels, dt);
    this.syncPickups(game.pickups);
  }

  private syncBarrels(barrels: Barrel[], dt: number) {
    const alive = new Set<number>();
    for (const b of barrels) {
      alive.add(b.id);
      let v = this.barrels.get(b.id);
      if (!v) {
        const mat = propMaterial();
        const mesh = new THREE.Mesh(barrelGeometry(), mat);
        mesh.position.set(b.x, 0, -b.y);
        this.scene.add(mesh);
        v = { mesh, mat, lastHp: b.hp, pulse: 0, phase: b.id * 1.3 };
        this.barrels.set(b.id, v);
      }
      if (b.hp < v.lastHp - 1e-6) v.pulse = 1;
      v.lastHp = b.hp;
      v.pulse = Math.max(0, v.pulse - dt * 6);
      const s = 1 + v.pulse * 0.14 + Math.sin(this.time * 6 + v.phase) * 0.015;
      v.mesh.scale.set(s, 1 + v.pulse * 0.1 - Math.sin(this.time * 6 + v.phase) * 0.015, s);
      v.mat.emissive.setScalar(v.pulse * 0.6);
    }
    for (const [id, v] of this.barrels) {
      if (!alive.has(id)) {
        this.scene.remove(v.mesh);
        v.mat.dispose();
        this.barrels.delete(id);
      }
    }
  }

  private makeLabel(group: THREE.Group, y: number, z: number, scale = 1): { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture } {
    const [canvas] = mkCanvas(256, 128);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sprite.scale.set(2.6 * scale, 1.3 * scale, 1);
    sprite.position.set(0, y, z);
    sprite.renderOrder = 10;
    group.add(sprite);
    return { canvas, tex };
  }

  private syncBlocks(blocks: Block[], dt: number) {
    const alive = new Set<number>();
    for (const b of blocks) {
      alive.add(b.id);
      let v = this.blocks.get(b.id);
      if (!v) v = this.createBlock(b);
      const text = `${Math.ceil(b.hp)}`;
      if (text !== v.shown) {
        const soldiers = b.reward.kind === 'soldiers';
        const reward = b.reward.kind === 'soldiers' ? `+${b.reward.n}` : b.reward.label;
        blockLabel(v.canvas.getContext('2d')!, text, reward, soldiers ? '#8fd0ff' : '#ffe27a');
        v.tex.needsUpdate = true;
        v.shown = text;
      }
      // hit pulse + progressive damage
      if (b.hp < v.lastHp - 1e-6) v.pulse = 1;
      v.lastHp = b.hp;
      v.pulse = Math.max(0, v.pulse - dt * 7);
      const frac = Math.max(0, b.hp / b.maxHp);
      v.group.scale.set(1 + v.pulse * 0.06, 1 - v.pulse * 0.05, 1 + v.pulse * 0.06);
      v.mat.emissive.setScalar(v.pulse * 0.45);
      v.mat.color.copy(v.base).multiplyScalar(0.62 + 0.38 * frac);
      if (v.rubble) {
        // the pile of stones in front grows as the block is chipped away
        const dmg = 1 - frac;
        v.rubble.visible = dmg > 0.04;
        v.rubble.scale.set(1, 0.3 + dmg * 1.1, 0.5 + dmg * 0.7);
      }
      const stage = frac > 0.75 ? 0 : frac > 0.5 ? 1 : frac > 0.25 ? 2 : 3;
      if (stage !== v.crackStage) {
        v.crackStage = stage;
        v.crack.visible = stage > 0;
        if (stage > 0) (v.crack.material as THREE.MeshBasicMaterial).map = cracks[stage - 1];
        (v.crack.material as THREE.MeshBasicMaterial).needsUpdate = true;
      }
    }
    for (const [id, v] of this.blocks) {
      if (!alive.has(id)) {
        this.dropBlock(v);
        this.blocks.delete(id);
      }
    }
  }

  private createBlock(b: Block): BlockView {
    const group = new THREE.Group();
    const special = b.reward.kind !== 'soldiers';
    const base = new THREE.Color(0xffffff); // vertex colours carry the palette; this tint darkens as HP falls
    const mat = propMaterial();
    const body = new THREE.Mesh(b.keystone ? keystoneGeometry(b.w) : blockGeometry(b.w, b.d, special), mat);
    group.add(body);
    const rubble = new THREE.Mesh(rubbleGeometry(b.w), propMaterial());
    rubble.position.z = b.d / 2 - 0.2;
    rubble.visible = false;
    group.add(rubble);
    if (b.w >= 5 && b.reward.kind === 'multi') group.add(new THREE.Mesh(rewardRoofGeometry(b.w), propMaterial())); // the reward mountain
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(b.w * 0.92, 1.3), new THREE.MeshBasicMaterial({ map: cracks[0], transparent: true, depthWrite: false }));
    crack.position.set(0, 0.8, b.d / 2 + 0.02);
    crack.visible = false;
    group.add(crack);
    const giant = b.w >= 5; // lane-wide jackpot blocks get a big label
    const { canvas, tex } = this.makeLabel(group, b.keystone ? 5.9 : giant ? 5.6 : 2.35, b.keystone ? 1 : giant ? -0.6 : b.d / 2, b.keystone || giant ? 1.55 : 1);
    group.position.set(b.x, 0, -b.y);
    this.scene.add(group);
    const v: BlockView = { group, body, mat, base, canvas, tex, crack, rubble, crackStage: 0, shown: '', lastHp: b.hp, pulse: 0 };
    this.blocks.set(b.id, v);
    return v;
  }

  private dropBlock(v: BlockView) {
    this.scene.remove(v.group);
    v.tex.dispose();
    disposeView(v.group);
  }

  private syncCounters(counters: Counter[], dt: number) {
    const alive = new Set<number>();
    for (const c of counters) {
      alive.add(c.id);
      let v = this.counters.get(c.id);
      if (!v) {
        const group = new THREE.Group();
        const mat = propMaterial();
        const body = new THREE.Mesh(counterGeometry(c.w), mat);
        group.add(body);
        const { canvas, tex } = this.makeLabel(group, 1.9, 0.4);
        group.position.set(c.x, 0, -c.y);
        this.scene.add(group);
        v = { group, body, mat, base: new THREE.Color(0xffffff), canvas, tex, crack: body, crackStage: 0, shown: '', lastHp: 0, pulse: 0 };
        this.counters.set(c.id, v);
      }
      const text = `+${Math.floor(c.value)}`;
      if (text !== v.shown) {
        const g = v.canvas.getContext('2d')!;
        g.clearRect(0, 0, 256, 128);
        outlinedText(g, text, 128, 66, 78, '#ffe27a');
        v.tex.needsUpdate = true;
        v.shown = text;
        v.pulse = 1;
      }
      v.pulse = Math.max(0, v.pulse - dt * 6);
      const s = 1 + v.pulse * 0.12;
      v.group.scale.set(s, s, s);
      v.mat.emissive.setScalar(v.pulse * 0.4);
    }
    for (const [id, v] of this.counters) {
      if (!alive.has(id)) {
        this.dropBlock(v);
        this.counters.delete(id);
      }
    }
  }

  private syncGates(gates: Gate[], dt: number) {
    void dt;
    const alive = new Set<number>();
    for (const g of gates) {
      alive.add(g.id);
      let v = this.gates.get(g.id);
      if (!v) {
        const bad = g.side.op === 'sub' || g.side.op === 'div';
        const kind: 'good' | 'bad' | 'up' = g.side.op === 'upgrade' ? 'up' : bad ? 'bad' : 'good';
        const col = kind === 'bad' ? BAD : kind === 'up' ? UP : GOOD;
        const group = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({ map: chevronTexture(col), transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false });
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(g.w - 0.35, 2.3), mat);
        panel.position.y = 1.35;
        group.add(panel);
        group.add(new THREE.Mesh(gateFrameGeometry(g.w, kind), new THREE.MeshBasicMaterial({ vertexColors: true })));
        const label = new THREE.Mesh(
          new THREE.PlaneGeometry(2.6, 1.6),
          new THREE.MeshBasicMaterial({ map: textTexture(gateLabel(g.side)), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
        );
        label.position.set(0, 1.4, 0.03);
        group.add(label);
        group.position.set(g.x, 0, -g.y);
        this.scene.add(group);
        v = { group, panel, mat, used: false };
        this.gates.set(g.id, v);
      }
      if (g.used && !v.used) {
        v.used = true;
        v.mat.opacity = 0.18;
      }
    }
    for (const [id, v] of this.gates) {
      if (!alive.has(id)) {
        this.scene.remove(v.group);
        disposeView(v.group);
        this.gates.delete(id);
      }
    }
  }

  reset() {
    for (const v of this.blocks.values()) this.dropBlock(v);
    this.blocks.clear();
    for (const v of this.counters.values()) this.dropBlock(v);
    this.counters.clear();
    for (const v of this.barrels.values()) {
      this.scene.remove(v.mesh);
      v.mat.dispose();
    }
    this.barrels.clear();
    for (const [, v] of this.gates) {
      this.scene.remove(v.group);
      disposeView(v.group);
    }
    this.gates.clear();
  }

  /** Debug: views whose position differs from the sim entity with the same id (stale views). */
  mismatches(game: Game): number {
    let bad = 0;
    const off = (g: THREE.Object3D, x: number, y: number) => Math.abs(g.position.x - x) > 1e-6 || Math.abs(g.position.z + y) > 1e-6;
    for (const b of game.blocks) {
      const v = this.blocks.get(b.id);
      if (v && off(v.group, b.x, b.y)) bad++;
    }
    for (const c of game.counters) {
      const v = this.counters.get(c.id);
      if (v && off(v.group, c.x, c.y)) bad++;
    }
    for (const g of game.gates) {
      const v = this.gates.get(g.id);
      if (v && off(v.group, g.x, g.y)) bad++;
    }
    return bad;
  }

  counts() {
    return { blocks: this.blocks.size, gates: this.gates.size, counters: this.counters.size, barrels: this.barrels.size, pickups: this.pickupCount };
  }
}
