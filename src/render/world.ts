import * as THREE from 'three';
import { LANE_HALF } from '../sim/game';
import { Rng } from '../sim/rng';
import type { DecorKind, Theme } from './themes';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { propMaterial, toonColor } from './materials';
import * as M from './models';

// ------------------------------------------------------------------ textures

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function srgb(t: THREE.Texture): THREE.Texture {
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function gradientTexture(top: string, mid: string, bottom: string): THREE.CanvasTexture {
  const [c, g] = canvas(4, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(0.55, mid);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  return srgb(new THREE.CanvasTexture(c)) as THREE.CanvasTexture;
}

function glowTexture(color: string): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, color);
  grad.addColorStop(0.18, color);
  grad.addColorStop(0.4, color + '66');
  grad.addColorStop(1, color + '00');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return srgb(new THREE.CanvasTexture(c)) as THREE.CanvasTexture;
}

function cloudTexture(color: string): THREE.CanvasTexture {
  const [c, g] = canvas(256, 96);
  const rng = new Rng(7);
  g.fillStyle = color;
  for (let i = 0; i < 9; i++) {
    const x = 40 + rng.next() * 176;
    const y = 52 + rng.next() * 12 - (i % 3) * 8;
    const r = 18 + rng.next() * 22;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color + '00');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return srgb(new THREE.CanvasTexture(c)) as THREE.CanvasTexture;
}

/** One tile = 8 units wide (the lane) x 8 units long. Edge stripes and faint centre dashes read as a road. */
function laneTexture(theme: Theme, seed: number, wide = false): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  const rng = new Rng(seed);
  g.fillStyle = theme.groundA;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = theme.groundB;
  for (let i = 0; i < 70; i++) {
    const w = 10 + rng.next() * 40;
    g.globalAlpha = 0.35 + rng.next() * 0.4;
    g.fillRect(rng.next() * 256, rng.next() * 256, w, 3 + rng.next() * 6);
  }
  g.globalAlpha = 0.5;
  for (let i = 0; i < 160; i++) {
    g.fillStyle = rng.next() < 0.5 ? theme.groundB : theme.laneEdge;
    const s = 1 + rng.next() * 2.2;
    g.fillRect(rng.next() * 256, rng.next() * 256, s, s);
  }
  g.globalAlpha = 1;
  // cracks: ice veins, dried clay, glowing lava seams
  const crackStyle = theme.id === 'frost' ? { c: '#ffffff', a: 0.75, w: 2.2, glow: '#9fd2f2' } : theme.id === 'volcano' ? { c: '#ff9a2a', a: 0.95, w: 2.6, glow: '#ff5a1a' } : theme.id === 'canyon' ? { c: '#8e4a30', a: 0.55, w: 1.8, glow: '' } : null;
  if (crackStyle) {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (let k = 0; k < 7; k++) {
      let x = 12 + rng.next() * 232;
      let y = rng.next() * 256;
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x = Math.max(6, Math.min(250, x + (rng.next() - 0.5) * 70));
        y += 18 + rng.next() * 26;
        g.lineTo(x, y);
      }
      g.globalAlpha = crackStyle.a;
      g.strokeStyle = crackStyle.c;
      g.lineWidth = crackStyle.w;
      if (crackStyle.glow) {
        g.shadowColor = crackStyle.glow;
        g.shadowBlur = 8;
      }
      g.stroke();
      g.shadowBlur = 0;
    }
    g.globalAlpha = 1;
  }
  if (!wide) {
  // lane edges
  g.fillStyle = theme.laneEdge;
  g.fillRect(0, 0, 10, 256);
  g.fillRect(246, 0, 10, 256);
  g.globalAlpha = 0.35;
  g.fillRect(10, 0, 4, 256);
  g.fillRect(242, 0, 4, 256);
  // centre dashes
  g.globalAlpha = 0.28;
  for (let y = 16; y < 256; y += 64) g.fillRect(125, y, 6, 30);
  g.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return srgb(t) as THREE.CanvasTexture;
}

function outerTexture(theme: Theme, seed: number): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  const rng = new Rng(seed);
  g.fillStyle = theme.outer;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = theme.groundB;
  g.globalAlpha = 0.35;
  for (let i = 0; i < 40; i++) g.fillRect(rng.next() * 128, rng.next() * 128, 6 + rng.next() * 20, 2 + rng.next() * 4);
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return srgb(t) as THREE.CanvasTexture;
}

function checkerTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 64);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 16; x++) {
      g.fillStyle = (x + y) % 2 ? '#ffffff' : '#1b1b2f';
      g.fillRect(x * 16, y * 16, 16, 16);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return srgb(t) as THREE.CanvasTexture;
}

// -------------------------------------------------------------------- decor

function decorGeometry(kind: DecorKind): THREE.BufferGeometry {
  switch (kind) {
    case 'palm': return M.palmGeometry();
    case 'bush': return M.bushGeometry();
    case 'ruinPillar': return M.ruinPillarGeometry();
    case 'temple': return M.templeGeometry();
    case 'mossRock': return M.mossRockGeometry();
    case 'obelisk': return M.obeliskGeometry();
    case 'tower': return M.towerGeometry();
    case 'chimney': return M.chimneyGeometry();
    case 'cactus': return M.cactusGeometry();
    case 'rock': return M.rockGeometry(0xb08a5a);
    case 'snowRock': return M.rockGeometry(0x9aa6b8, 0xffffff);
    case 'redRock': return M.rockGeometry(0xa6513a);
    case 'mesa': return M.mesaGeometry(0xc98f55, 0xe0b075);
    case 'redMesa': return M.mesaGeometry(0xb5513a, 0xd9704c);
    case 'iceMesa': return M.mesaGeometry(0x8fc5e8, 0xe6f6ff);
    case 'arch': return M.archGeometry(0xb8573a);
    case 'pine': return M.pineGeometry();
    case 'crystal': return M.crystalGeometry();
    case 'deadTree': return M.deadTreeGeometry();
    case 'lavaSpike': return M.lavaSpikeGeometry();
    case 'lavaRock': return M.lavaRockGeometry();
  }
}

// -------------------------------------------------------------------- world

interface Ambient {
  mesh: THREE.InstancedMesh;
  pos: Float32Array;
  vel: Float32Array;
  kind: 'dust' | 'snow' | 'embers' | 'fireflies';
}

export class World {
  /** Sky is its own scene (gradient + sun + clouds), drawn first with a camera that only rotates. */
  readonly sky = new THREE.Scene();
  private skyCam = new THREE.PerspectiveCamera(60, 9 / 16, 0.1, 500);
  private hemi = new THREE.HemisphereLight(0xffffff, 0xd9b77a, 1.6);
  private sunLight = new THREE.DirectionalLight(0xfff2d6, 2.2);
  private group = new THREE.Group();
  private sunSprite: THREE.Sprite;
  private clouds: THREE.Sprite[] = [];
  private ambient: Ambient | null = null;
  private flags: THREE.Mesh[] = [];
  private theme!: Theme;
  private time = 0;
  /** Low quality: no ambient particles. */
  lowQuality = false;

  constructor(private scene: THREE.Scene) {
    this.sunLight.position.set(-6, 14, 6);
    scene.add(this.hemi, this.sunLight, this.group);
    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, depthWrite: false, fog: false, transparent: true }));
    this.sunSprite.position.set(-38, 20, -110);
    this.sunSprite.scale.set(70, 70, 1);
    this.sky.add(this.sunSprite);
  }

  get current(): Theme {
    return this.theme;
  }

  /** Lighting, fog, sky gradient, sun and clouds for a theme. */
  private atmosphere(theme: Theme, seed: number) {
    this.scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
    this.hemi.color.set(theme.hemiSky);
    this.hemi.groundColor.set(theme.hemiGround);
    this.hemi.intensity = theme.hemiIntensity;
    this.sunLight.color.set(theme.sun);
    this.sunLight.intensity = theme.sunIntensity;

    // sky
    (this.sky.background as THREE.Texture | null)?.dispose?.();
    this.sky.background = gradientTexture(theme.skyTop, theme.skyMid, theme.skyBottom);
    (this.sunSprite.material.map as THREE.Texture | null)?.dispose();
    this.sunSprite.material.map = glowTexture(theme.sunGlow);
    this.sunSprite.material.needsUpdate = true;
    for (const c of this.clouds) {
      this.sky.remove(c);
      c.material.map?.dispose();
      c.material.dispose();
    }
    this.clouds = [];
    const cloudTex = cloudTexture(theme.cloud);
    const crng = new Rng(seed);
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: theme.cloudAlpha, depthTest: false, depthWrite: false, fog: false }));
      const w = 55 + crng.next() * 55;
      s.scale.set(w, w * 0.34, 1);
      s.position.set(-120 + i * 110 + crng.next() * 30, 8 + crng.next() * 22, -120);
      this.sky.add(s);
      this.clouds.push(s);
    }

  }

  /** (Re)build everything that depends on the world and on the level length. */
  apply(theme: Theme, levelId: number, length: number) {
    this.clear();
    this.theme = theme;
    const seed = levelId * 977 + theme.id.length * 31;

    this.atmosphere(theme, seed);

    // ground, run-off and walls
    const back = 30;
    const span = length + 110;
    const centreZ = -(length + 80 - back) / 2;
    const lane = laneTexture(theme, seed);
    lane.repeat.set(1, span / 8);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(LANE_HALF * 2, span), new THREE.MeshLambertMaterial({ map: lane }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, centreZ);
    this.group.add(ground);

    const out = outerTexture(theme, seed + 5);
    out.repeat.set(10, span / 12);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(160, span), new THREE.MeshLambertMaterial({ map: out }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.set(0, -0.05, centreZ);
    this.group.add(outer);

    const wallGeo = mergeGeometries(
      [-1, 1].map((s) => new THREE.BoxGeometry(0.5, 0.6, span).translate(s * (LANE_HALF + 0.25), 0.3, centreZ)),
      false,
    )!;
    this.group.add(new THREE.Mesh(wallGeo, toonColor(theme.wall)));
    // posts along both sides
    const postN = Math.floor(span / 6) * 2;
    const posts = new THREE.InstancedMesh(M.postGeometry(theme.postBody, theme.postCap), propMaterial(), postN);
    const d = new THREE.Object3D();
    for (let i = 0; i < postN; i++) {
      const side = i % 2 ? 1 : -1;
      d.position.set(side * (LANE_HALF + 0.25), 0.2, back - Math.floor(i / 2) * 6);
      d.rotation.set(0, 0, 0);
      d.scale.setScalar(1);
      d.updateMatrix();
      posts.setMatrixAt(i, d.matrix);
    }
    posts.frustumCulled = false;
    this.group.add(posts);

    // scenery
    const rng = new Rng(seed + 11);
    const density = span / 350;
    for (const spec of theme.decor) {
      const n = Math.max(6, Math.round(spec.n * density));
      const mesh = new THREE.InstancedMesh(decorGeometry(spec.kind), propMaterial(), n);
      const col = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const side = rng.next() < 0.5 ? -1 : 1;
        d.position.set(side * rng.range(spec.minX, spec.maxX), 0, -rng.range(-back + 4, length + 80));
        d.rotation.set(0, rng.range(0, 6.28), 0);
        d.scale.setScalar(rng.range(spec.scale[0], spec.scale[1]));
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
        const v = 0.86 + rng.next() * 0.22;
        mesh.setColorAt(i, col.setRGB(v, v, v));
      }
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }

    // finish arch
    this.buildFinish(theme, length);

    // ambient particles
    if (theme.ambient) {
      const a = theme.ambient;
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: a.color, fog: false, transparent: true, opacity: 0.85 }), a.n);
      mesh.frustumCulled = false;
      const pos = new Float32Array(a.n * 3);
      const vel = new Float32Array(a.n * 3);
      for (let i = 0; i < a.n; i++) {
        pos.set([rng.range(-16, 16), rng.range(0.3, 9), rng.range(-34, 6)], i * 3);
        if (a.kind === 'snow') vel.set([rng.range(-0.4, 0.4), -rng.range(0.8, 1.6), rng.range(-0.2, 0.2)], i * 3);
        else if (a.kind === 'embers') vel.set([rng.range(-0.5, 0.5), rng.range(0.8, 2.2), rng.range(-0.3, 0.3)], i * 3);
        else if (a.kind === 'fireflies') vel.set([rng.range(-0.35, 0.35), rng.range(-0.1, 0.12), rng.range(-0.35, 0.35)], i * 3);
        else vel.set([rng.range(1.5, 3.5), rng.range(-0.1, 0.2), rng.range(-0.3, 0.3)], i * 3);
      }
      this.group.add(mesh);
      this.ambient = { mesh, pos, vel, kind: a.kind };
    }
  }

  private roof: THREE.Mesh | null = null;

  /** Build a siege arena: a fixed floor with walls on three sides, the nest roof at the back and a danger line at the bottom. */
  applyArena(theme: Theme, level: { id: number; arena?: import('../sim/level').ArenaDef }) {
    const arena = level.arena!;
    this.clear();
    this.theme = theme;
    const seed = level.id * 977 + theme.id.length * 31;
    this.atmosphere(theme, seed);
    this.scene.fog = new THREE.Fog(theme.fog, 75, 190); // the arena is seen from afar: keep the nest clear of haze
    this.roof = null;
    const half = arena.half;
    const d = arena.depth;
    const span = d + 22;
    const centreZ = -(d - 6) / 2; // floor from y = -8 to y = d + 14 (z = -y)
    const floorTex = laneTexture(theme, seed, true);
    floorTex.repeat.set((half * 2 + 8) / 8, span / 8);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 8, span), new THREE.MeshLambertMaterial({ map: floorTex }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, centreZ);
    this.group.add(floor);
    const out = outerTexture(theme, seed + 5);
    out.repeat.set(12, span / 10);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(260, span + 200), new THREE.MeshLambertMaterial({ map: out }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.set(0, -0.05, centreZ);
    this.group.add(outer);

    // the playing field is the lighter slab inside the walls
    const field = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, d - arena.bottom + 4), new THREE.MeshLambertMaterial({ color: new THREE.Color(theme.groundA).multiplyScalar(1.04), transparent: true, opacity: 0.55 }));
    field.rotation.x = -Math.PI / 2;
    field.position.set(0, 0.012, -((d + arena.bottom) / 2));
    this.group.add(field);

    // walls: left, right and back (the bottom is open: that is where enemies must not arrive)
    const wallLen = d - arena.bottom + 6;
    const wallGeo = mergeGeometries(
      [
        new THREE.BoxGeometry(0.6, 0.8, wallLen).translate(-(half + 0.3), 0.4, -((d + arena.bottom) / 2)),
        new THREE.BoxGeometry(0.6, 0.8, wallLen).translate(half + 0.3, 0.4, -((d + arena.bottom) / 2)),
        new THREE.BoxGeometry(half * 2 + 1.2, 2.2, 0.8).translate(0, 1.1, -(d + 2.4)),
      ],
      false,
    )!;
    this.group.add(new THREE.Mesh(wallGeo, toonColor(theme.wall)));

    // the danger line: an enemy that reaches it costs lives
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2, 1.1),
      new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, 0.03, -(arena.bottom + 0.2));
    this.group.add(line);

    // the nest: a dark floor patch under a huge roof of reward tiles
    const cave = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, 9), new THREE.MeshBasicMaterial({ color: 0x3a1820, transparent: true, opacity: 0.6, depthWrite: false }));
    cave.rotation.x = -Math.PI / 2;
    cave.position.set(0, 0.025, -(d - 3.6));
    this.group.add(cave);
    const roof = new THREE.Mesh(M.arenaRoofGeometry(half * 2 + 0.6), propMaterial());
    roof.position.set(0, 0, -(d - 5));
    this.group.add(roof);
    this.roof = roof;

    // posts along the side walls
    const rows = Math.floor(wallLen / 5);
    const posts = new THREE.InstancedMesh(M.postGeometry(theme.postBody, theme.postCap), propMaterial(), rows * 2);
    const dd = new THREE.Object3D();
    for (let i = 0; i < rows * 2; i++) {
      dd.position.set((i % 2 ? 1 : -1) * (half + 0.3), 0.6, -(arena.bottom - 2 + Math.floor(i / 2) * 5));
      dd.rotation.set(0, 0, 0);
      dd.scale.setScalar(1);
      dd.updateMatrix();
      posts.setMatrixAt(i, dd.matrix);
    }
    posts.frustumCulled = false;
    this.group.add(posts);

    // scenery outside the walls
    const rng = new Rng(seed + 11);
    for (const spec of theme.decor) {
      const n = Math.max(6, Math.round(spec.n * 0.3));
      const mesh = new THREE.InstancedMesh(decorGeometry(spec.kind), propMaterial(), n);
      const col = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const side = rng.next() < 0.5 ? -1 : 1;
        dd.position.set(side * rng.range(half + 2 + spec.minX - 4.9, half + 2 + spec.maxX - 4.9 + 8), 0, -rng.range(-8, d + 12));
        dd.rotation.set(0, rng.range(0, 6.28), 0);
        dd.scale.setScalar(rng.range(spec.scale[0], spec.scale[1]));
        dd.updateMatrix();
        mesh.setMatrixAt(i, dd.matrix);
        const v = 0.86 + rng.next() * 0.22;
        mesh.setColorAt(i, col.setRGB(v, v, v));
      }
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
    if (theme.ambient) {
      const a = theme.ambient;
      const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: a.color, fog: false, transparent: true, opacity: 0.85 }), a.n);
      mesh.frustumCulled = false;
      const pos = new Float32Array(a.n * 3);
      const vel = new Float32Array(a.n * 3);
      for (let i = 0; i < a.n; i++) {
        pos.set([rng.range(-16, 16), rng.range(0.3, 9), rng.range(-34, 6)], i * 3);
        if (a.kind === 'snow') vel.set([rng.range(-0.4, 0.4), -rng.range(0.8, 1.6), rng.range(-0.2, 0.2)], i * 3);
        else if (a.kind === 'embers') vel.set([rng.range(-0.5, 0.5), rng.range(0.8, 2.2), rng.range(-0.3, 0.3)], i * 3);
        else if (a.kind === 'fireflies') vel.set([rng.range(-0.35, 0.35), rng.range(-0.1, 0.12), rng.range(-0.35, 0.35)], i * 3);
        else vel.set([rng.range(1.5, 3.5), rng.range(-0.1, 0.2), rng.range(-0.3, 0.3)], i * 3);
      }
      this.group.add(mesh);
      this.ambient = { mesh, pos, vel, kind: a.kind };
    }
  }

  /** The roof comes down when the keystone breaks. */
  collapseRoof() {
    if (this.roof) this.roof.visible = false;
  }

  private buildFinish(theme: Theme, length: number) {
    const arch = new THREE.Group();
    const w = LANE_HALF * 2 + 1.6;
    arch.add(new THREE.Mesh(M.finishGeometry(w, theme.postBody, theme.postCap), propMaterial()));
    const tex = checkerTexture();
    tex.repeat.set(2, 1);
    const banner = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, 0.35), new THREE.MeshBasicMaterial({ map: tex }));
    banner.position.set(0, 4.7, 0);
    arch.add(banner);
    // flags that wave
    this.flags = [];
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), new THREE.MeshBasicMaterial({ color: theme.id === 'frost' ? 0x2a6bff : 0xff4a3a, side: THREE.DoubleSide }));
      f.position.set(s * (w / 2), 5.9, 0);
      arch.add(f);
      this.flags.push(f);
    }
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(LANE_HALF * 2, 1.4), new THREE.MeshBasicMaterial({ map: (() => { const t = checkerTexture(); t.repeat.set(4, 1); return t; })() }));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 0.03, 0);
    arch.add(strip);
    arch.position.z = -length;
    this.group.add(arch);
  }

  /** Called every frame. */
  update(dt: number, camera: THREE.PerspectiveCamera) {
    this.time += dt;
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.position.x += dt * (1.2 + (i % 3) * 0.6);
      if (c.position.x > 190) c.position.x = -190;
    }
    this.flags.forEach((f, i) => {
      f.rotation.y = Math.sin(this.time * 4 + i) * 0.35;
    });
    if (this.ambient) {
      this.ambient.mesh.visible = !this.lowQuality;
      if (!this.lowQuality) this.updateAmbient(dt, camera);
    }
  }

  private updateAmbient(dt: number, camera: THREE.PerspectiveCamera) {
    const a = this.ambient!;
    const n = a.pos.length / 3;
    const cx = camera.position.x;
    const cz = camera.position.z;
    const d = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      a.pos[o] += a.vel[o] * dt + (a.kind === 'embers' ? Math.sin(this.time * 2 + i) * 0.01 : 0);
      a.pos[o + 1] += a.vel[o + 1] * dt;
      a.pos[o + 2] += a.vel[o + 2] * dt;
      // wrap inside a box around the camera so the effect follows the player
      if (a.pos[o] - cx > 16) a.pos[o] -= 32;
      else if (a.pos[o] - cx < -16) a.pos[o] += 32;
      if (a.pos[o + 1] < 0.2) a.pos[o + 1] += 9;
      else if (a.pos[o + 1] > 9.2) a.pos[o + 1] -= 9;
      const dz = a.pos[o + 2] - (cz - 14);
      if (dz > 22) a.pos[o + 2] -= 44;
      else if (dz < -22) a.pos[o + 2] += 44;
      d.position.set(a.pos[o], a.pos[o + 1], a.pos[o + 2]);
      const s = a.kind === 'snow' ? 0.09 : a.kind === 'embers' ? 0.07 : a.kind === 'fireflies' ? 0.05 + 0.1 * Math.abs(Math.sin(this.time * 2.2 + i * 1.7)) : 0.06; // fireflies blink
      d.scale.setScalar(s);
      d.updateMatrix();
      a.mesh.setMatrixAt(i, d.matrix);
    }
    a.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Draw the sky into the current target (before the main scene). */
  renderSky(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
    this.skyCam.quaternion.copy(camera.quaternion);
    this.skyCam.fov = camera.fov;
    this.skyCam.aspect = camera.aspect;
    this.skyCam.updateProjectionMatrix();
    renderer.render(this.sky, this.skyCam);
  }

  private clear() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      const mats = Array.isArray(mat) ? mat : mat ? [mat] : [];
      for (const x of mats) {
        (x as THREE.MeshBasicMaterial).map?.dispose();
        x.dispose();
      }
    });
    this.group.clear();
    this.ambient = null;
    this.flags = [];
  }
}
