import * as THREE from 'three';
import type { Game } from '../sim/game';
import type { EnemyKind, WeaponType } from '../sim/level';
import { slot } from '../sim/formation';
import * as M from './models';
import { addAnimAttrs, animOutlineMaterial, animToonMaterial, type AnimAttrs } from './materials';

const MAX_SOLDIERS = 320;
const MAX_ENEMIES = 900;
// Far-LOD capacities: a horde of a couple of thousand must still fit (instances past capacity vanish)
const FAR_MAX: Partial<Record<EnemyKind, number>> = { grunt: 3400, runner: 1400, mini: 2600, splitter: 300 };
const MAX_BULLETS = 400;
const FLASH_TIME = 0.14;
// Visual size only: hit boxes and formation are simulation values and stay as they are, so balance is unchanged.
const SOLDIER_SCALE = 1.4;
const ENEMY_SCALE: Record<EnemyKind, number> = { grunt: 1.4, runner: 1.4, mini: 1.4, splitter: 1.3, brute: 1.25, boss: 1.1 };
const scaleOf = (k: CorpseKind) => (k === 'soldier' ? SOLDIER_SCALE : ENEMY_SCALE[k]);
// big units flash less so their model stays readable under heavy fire
const FLASH_GAIN: Record<EnemyKind, number> = { grunt: 1, runner: 1, brute: 0.55, splitter: 0.7, mini: 1, boss: 0.4 };

const BULLET_STYLE: Record<WeaponType, { color: number; s: [number, number, number] }> = {
  // big and bright enough to read on a phone screen (they were hairlines before)
  rifle: { color: 0xffe14a, s: [2.6, 2.6, 1.8] },
  shotgun: { color: 0xfff6d0, s: [2.0, 2.0, 1.0] },
  rocket: { color: 0xff8a2a, s: [5, 5, 2.4] },
  laser: { color: 0x6ff5ff, s: [2.0, 2.0, 5.5] },
};

// how fast each kind's walk cycle runs
const RUN_RATE: Record<EnemyKind, number> = { grunt: 1.0, runner: 1.7, brute: 0.75, splitter: 0.9, mini: 2.0, boss: 0.5 };

type CorpseKind = EnemyKind | 'soldier';

interface Corpse {
  kind: CorpseKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  rz: number;
  spin: number;
  life: number;
  maxLife: number;
}

interface Unit {
  mesh: THREE.InstancedMesh;
  outline?: THREE.InstancedMesh;
  attrs: AnimAttrs;
  max: number;
}

const SHADOW: Record<EnemyKind, number> = { grunt: 1.1, runner: 0.9, brute: 2.6, splitter: 2.0, mini: 0.8, boss: 5.5 };

const hash01 = (id: number) => {
  const s = Math.sin(id * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

/** Everything that is a crowd: squad, enemies, corpses, shadows, HP bars and projectiles. */
export class Crowd {
  private soldiers: Unit;
  private enemies = {} as Record<EnemyKind, Unit>;
  private far = {} as Partial<Record<EnemyKind, Unit>>;
  /** Distance (along the lane) beyond which crowd units switch to their cheap model; shrinks as the crowd grows. */
  lodDistance = 999;
  private corpseMeshes = {} as Record<CorpseKind, Unit>;
  private corpses: Corpse[] = [];
  private bullets: THREE.InstancedMesh;
  private shadows: THREE.InstancedMesh;
  private barBg: THREE.InstancedMesh;
  private barFill: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private tmp = new THREE.Color();
  private shadowN = 0;
  private flash = new Map<number, number>();
  private cool = new Map<number, number>(); // re-trigger delay so continuous fire does not hold units white
  private birth = new Float32Array(MAX_SOLDIERS);
  private prevCount = -1;
  private prevY = 0;
  private time = 0;
  private bossVariant: M.BossVariant | null = null;

  constructor(private scene: THREE.Scene) {
    this.soldiers = this.unit(M.soldierGeometry(), MAX_SOLDIERS, false);
    this.enemies.grunt = this.unit(M.gruntGeometry(), MAX_ENEMIES, false);
    this.enemies.runner = this.unit(M.runnerGeometry(), MAX_ENEMIES, false);
    this.enemies.brute = this.unit(M.bruteGeometry(), 90, true);
    this.enemies.splitter = this.unit(M.splitterGeometry(), 160, false);
    this.enemies.mini = this.unit(M.miniGeometry(), 700, false);
    this.far.grunt = this.unit(M.gruntFarGeometry(), FAR_MAX.grunt!, false);
    this.far.runner = this.unit(M.runnerFarGeometry(), FAR_MAX.runner!, false);
    this.far.mini = this.unit(M.miniFarGeometry(), FAR_MAX.mini!, false);
    this.far.splitter = this.unit(M.splitterFarGeometry(), FAR_MAX.splitter!, false);
    this.enemies.boss = this.unit(M.bossGeometry('golem'), 2, true, 0.06);
    this.bossVariant = 'golem';

    this.corpseMeshes.soldier = this.unit(M.soldierGeometry(), 110, false);
    this.corpseMeshes.grunt = this.unit(M.gruntGeometry(), 220, false);
    this.corpseMeshes.runner = this.unit(M.runnerGeometry(), 90, false);
    this.corpseMeshes.brute = this.unit(M.bruteGeometry(), 40, false);
    this.corpseMeshes.splitter = this.unit(M.splitterGeometry(), 60, false);
    this.corpseMeshes.mini = this.unit(M.miniGeometry(), 160, false);
    this.corpseMeshes.boss = this.unit(M.bossGeometry('golem'), 2, false);

    const shadowGeo = new THREE.CircleGeometry(0.28, 10);
    shadowGeo.rotateX(-Math.PI / 2);
    this.shadows = this.inst(
      shadowGeo,
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false }),
      MAX_SOLDIERS + MAX_ENEMIES + 700 + 120,
    );
    this.bullets = this.inst(new THREE.BoxGeometry(0.07, 0.07, 0.55), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), MAX_BULLETS);
    this.bullets.renderOrder = 5;

    const bar = new THREE.PlaneGeometry(1.3, 0.16);
    const barMat = (c: number) => new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true });
    this.barBg = this.inst(bar, barMat(0x120a18), 90);
    this.barFill = this.inst(bar.clone(), barMat(0xffffff), 90);
    this.barBg.renderOrder = 20;
    this.barFill.renderOrder = 21;
  }

  private inst(geo: THREE.BufferGeometry, mat: THREE.Material, max: number): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(geo, mat, max);
    m.count = 0;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(m);
    return m;
  }

  private unit(geo: THREE.BufferGeometry, max: number, outline: boolean, thickness = 0.045): Unit {
    const mesh = this.inst(geo, animToonMaterial(), max);
    const attrs = addAnimAttrs(mesh, max);
    let ol: THREE.InstancedMesh | undefined;
    if (outline) {
      ol = new THREE.InstancedMesh(geo, animOutlineMaterial(thickness), max);
      ol.instanceMatrix = mesh.instanceMatrix; // same transforms, drawn as a black back-face hull
      ol.count = 0;
      ol.frustumCulled = false;
      this.scene.add(ol);
    }
    return { mesh, outline: ol, attrs, max };
  }

  /** Swap the boss model to the one matching the world (rebuilds only when it changes). */
  setBossVariant(v: M.BossVariant) {
    if (this.bossVariant === v) return;
    this.bossVariant = v;
    for (const u of [this.enemies.boss, this.corpseMeshes.boss]) {
      u.mesh.geometry.dispose();
      const g = M.bossGeometry(v);
      u.mesh.geometry = g;
      if (u.outline) u.outline.geometry = g;
      g.setAttribute('aAnim', u.attrs.anim);
      g.setAttribute('aFlash', u.attrs.flash);
    }
  }

  reset() {
    this.flash.clear();
    this.cool.clear();
    this.corpses.length = 0;
    this.prevCount = -1;
    this.birth.fill(0);
  }

  // ------------------------------------------------------------ event hooks

  hit(id: number) {
    if (this.flash.has(id) || this.cool.has(id)) return;
    this.flash.set(id, FLASH_TIME);
  }

  /** Enemy killed: it is gone from the sim, so the corpse is a purely visual body flung forward. */
  enemyDied(kind: EnemyKind, x: number, y: number) {
    if (this.corpses.length > 380) return;
    const heavy = kind === 'boss' ? 0.3 : kind === 'brute' ? 0.6 : 1;
    this.corpses.push({
      kind,
      x,
      y: 0.1,
      z: -y,
      vx: (Math.random() - 0.5) * 3.2 * heavy,
      vy: (3.2 + Math.random() * 2.6) * (kind === 'boss' ? 0.5 : heavy),
      vz: -(1.5 + Math.random() * 3.2) * heavy, // away from the squad
      rx: 0,
      rz: 0,
      spin: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 6) * heavy,
      life: kind === 'boss' ? 1.6 : 0.6,
      maxLife: kind === 'boss' ? 1.6 : 0.6,
    });
  }

  /** `lost` soldiers die: a few bodies tumble off the back of the crowd. */
  soldiersDied(lost: number, game: Game) {
    const sq = game.squad;
    const n = Math.min(lost, 5);
    for (let k = 0; k < n; k++) {
      if (this.corpses.length > 380) return;
      const s = slot(Math.floor(Math.random() * Math.max(1, sq.count)), Math.max(1, sq.count));
      this.corpses.push({
        kind: 'soldier',
        x: sq.x + s.dx,
        y: 0.1,
        z: -(sq.y + s.dy),
        vx: (Math.random() - 0.5) * 3,
        vy: 3 + Math.random() * 2,
        vz: 1.5 + Math.random() * 2.5, // thrown backwards, towards the camera
        rx: 0,
        rz: 0,
        spin: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 5),
        life: 0.7,
        maxLife: 0.7,
      });
    }
  }

  // ----------------------------------------------------------------- draw

  draw(game: Game, dt: number, camera: THREE.Camera) {
    this.time += dt;
    this.shadowN = 0;
    this.drawSquad(game, dt);
    this.drawEnemies(game, dt, camera);
    this.drawCorpses(dt);
    this.shadows.count = this.shadowN;
    this.shadows.instanceMatrix.needsUpdate = true;
    this.drawBullets(game);
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

  private drawSquad(game: Game, dt: number) {
    const sq = game.squad;
    const total = sq.count;
    const n = Math.min(total, MAX_SOLDIERS);
    const moving = sq.y - this.prevY > 1e-4 || this.prevCount < 0;
    this.prevY = sq.y;
    if (this.prevCount < 0) this.prevCount = total; // no pop-in at level start
    if (total > this.prevCount) for (let i = this.prevCount; i < Math.min(total, MAX_SOLDIERS); i++) this.birth[i] = this.time;
    this.prevCount = total;

    const u = this.soldiers;
    const d = this.dummy;
    for (let i = 0; i < n; i++) {
      const s = slot(i, total);
      const px = sq.x + s.dx;
      const pz = -(sq.y + s.dy);
      // pop-in: overshoot scale so fresh recruits "spring" into the formation
      const age = (this.time - this.birth[i]) / 0.3;
      let sc = 1;
      if (age < 1) {
        const t = age - 1; // easeOutBack: 0 -> overshoot -> 1
        sc = 1 + 2.70158 * t * t * t + 1.70158 * t * t;
      }
      sc = Math.max(0.05, sc);
      d.position.set(px, 0, pz);
      d.rotation.set(0, 0, 0);
      d.scale.setScalar(sc * SOLDIER_SCALE);
      d.updateMatrix();
      u.mesh.setMatrixAt(i, d.matrix);
      u.attrs.anim.setXY(i, i * 1.7, moving ? 1.05 + (i % 5) * 0.03 : 0);
      u.attrs.flash.setX(i, 0);
      this.pushShadow(px, pz, sc * SOLDIER_SCALE);
    }
    u.mesh.count = n;
    u.mesh.instanceMatrix.needsUpdate = true;
    u.attrs.anim.needsUpdate = true;
    u.attrs.flash.needsUpdate = true;
    void dt;
  }

  private drawEnemies(game: Game, dt: number, camera: THREE.Camera) {
    const counts: Record<EnemyKind, number> = { grunt: 0, runner: 0, brute: 0, splitter: 0, mini: 0, boss: 0 };
    const farCounts: Partial<Record<EnemyKind, number>> = { grunt: 0, runner: 0, mini: 0, splitter: 0 };
    const d = this.dummy;
    const sq = game.squad;
    // LOD budget: with few enemies everything is detailed; thousands push the switch distance towards the squad
    const total = game.enemies.length;
    this.lodDistance = total < 450 ? 999 : Math.max(11, 42 - (total - 450) / 50);
    let bars = 0;
    for (const e of game.enemies) {
      let u = this.enemies[e.kind];
      const fu = this.far[e.kind];
      let far = false;
      if (fu && (Math.abs(e.y - sq.y) > this.lodDistance || counts[e.kind] >= u.max)) {
        u = fu;
        far = true;
      }
      const i = far ? farCounts[e.kind]! : counts[e.kind];
      if (i >= u.max) continue;
      if (far) farCounts[e.kind]!++;
      else counts[e.kind]++;
      d.position.set(e.x, 0, -e.y);
      d.rotation.set(0, Math.PI, 0);
      d.scale.setScalar(ENEMY_SCALE[e.kind]);
      d.updateMatrix();
      u.mesh.setMatrixAt(i, d.matrix);
      u.attrs.anim.setXY(i, hash01(e.id) * 6.28, e.awake ? RUN_RATE[e.kind] * (0.9 + hash01(e.id + 7) * 0.2) : 0);
      const f = this.flash.get(e.id);
      u.attrs.flash.setX(i, f ? Math.min(1, f / FLASH_TIME) * FLASH_GAIN[e.kind] : 0);
      if (!far) this.pushShadow(e.x, -e.y, SHADOW[e.kind] * ENEMY_SCALE[e.kind]);

      if (e.kind === 'brute' && e.hp < e.maxHp && bars < 90) {
        const frac = Math.max(0.02, e.hp / e.maxHp);
        d.position.set(e.x, 2.15 * ENEMY_SCALE.brute, -e.y);
        d.rotation.set(-0.55, 0, 0);
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        this.barBg.setMatrixAt(bars, d.matrix);
        d.position.set(e.x - (1 - frac) * 0.65, 2.15 * ENEMY_SCALE.brute, -e.y + 0.01);
        d.scale.set(frac, 0.7, 1);
        d.updateMatrix();
        this.barFill.setMatrixAt(bars, d.matrix);
        this.barFill.setColorAt(bars, this.tmp.setHSL(0.33 * frac, 0.9, 0.5));
        bars++;
      }
    }
    for (const k of Object.keys(counts) as EnemyKind[]) {
      const u = this.enemies[k];
      u.mesh.count = counts[k];
      if (u.outline) u.outline.count = counts[k];
      u.mesh.instanceMatrix.needsUpdate = true;
      u.attrs.anim.needsUpdate = true;
      u.attrs.flash.needsUpdate = true;
    }
    for (const k of Object.keys(farCounts) as EnemyKind[]) {
      const u = this.far[k]!;
      u.mesh.count = farCounts[k]!;
      u.mesh.instanceMatrix.needsUpdate = true;
      u.attrs.anim.needsUpdate = true;
      u.attrs.flash.needsUpdate = true;
    }
    this.barBg.count = bars;
    this.barFill.count = bars;
    this.barBg.instanceMatrix.needsUpdate = true;
    this.barFill.instanceMatrix.needsUpdate = true;
    if (this.barFill.instanceColor) this.barFill.instanceColor.needsUpdate = true;
    void camera;

    // flash timers: when a flash ends, a short cool-down starts
    for (const [id, t] of this.flash) {
      const nt = t - dt;
      if (nt <= 0) {
        this.flash.delete(id);
        this.cool.set(id, 0.16);
      } else this.flash.set(id, nt);
    }
    for (const [id, t] of this.cool) {
      const nt = t - dt;
      if (nt <= 0) this.cool.delete(id);
      else this.cool.set(id, nt);
    }
  }

  private drawCorpses(dt: number) {
    const counts: Record<CorpseKind, number> = { soldier: 0, grunt: 0, runner: 0, brute: 0, splitter: 0, mini: 0, boss: 0 };
    const d = this.dummy;
    for (let c = this.corpses.length - 1; c >= 0; c--) {
      const k = this.corpses[c];
      k.life -= dt;
      if (k.life <= 0) {
        this.corpses.splice(c, 1);
        continue;
      }
      k.vy -= 15 * dt;
      k.x += k.vx * dt;
      k.z += k.vz * dt;
      k.y += k.vy * dt;
      if (k.y < 0) {
        k.y = 0;
        k.vy = -k.vy * 0.25;
        k.vx *= 0.7;
        k.vz *= 0.7;
        k.spin *= 0.6;
      }
      k.rx += k.spin * dt;
      k.rz += k.spin * 0.5 * dt;
      const u = this.corpseMeshes[k.kind];
      const i = counts[k.kind];
      if (i >= u.max) continue;
      counts[k.kind]++;
      const fade = Math.min(1, (k.life / k.maxLife) * 3.5); // shrink away at the end
      d.position.set(k.x, k.y, k.z);
      d.rotation.set(k.rx, k.kind === 'soldier' ? 0 : Math.PI, k.rz);
      d.scale.setScalar(Math.max(0.01, fade) * scaleOf(k.kind));
      d.updateMatrix();
      u.mesh.setMatrixAt(i, d.matrix);
      u.attrs.anim.setXY(i, 0, 0);
      u.attrs.flash.setX(i, k.life > k.maxLife - 0.09 ? 1 : 0);
    }
    for (const kind of Object.keys(counts) as CorpseKind[]) {
      const u = this.corpseMeshes[kind];
      u.mesh.count = counts[kind];
      u.mesh.instanceMatrix.needsUpdate = true;
      u.attrs.anim.needsUpdate = true;
      u.attrs.flash.needsUpdate = true;
    }
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
      this.bullets.setColorAt(i, this.tmp.set(st.color));
    }
    if (this.bullets.instanceColor) this.bullets.instanceColor.needsUpdate = true;
    this.bullets.count = n;
    this.bullets.instanceMatrix.needsUpdate = true;
  }

  stats() {
    return {
      soldiers: this.soldiers.mesh.count,
      enemies: Object.values(this.enemies).reduce((a, u) => a + u.mesh.count, 0) + Object.values(this.far).reduce((a, u) => a + (u?.mesh.count ?? 0), 0),
      lodDistance: Math.round(this.lodDistance),
      bullets: this.bullets.count,
      corpses: this.corpses.length,
    };
  }
}
