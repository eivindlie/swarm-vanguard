import * as THREE from 'three';

const MAX = 500;

/** Pooled cube particles in one InstancedMesh (ring buffer, CPU simulated). */
export class Particles {
  readonly mesh: THREE.InstancedMesh;
  private pos = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private size = new Float32Array(MAX);
  private grav = new Float32Array(MAX);
  private head = 0;
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < MAX; i++) this.mesh.setColorAt(i, this.color.set(0xffffff));
    this.mesh.count = MAX;
    scene.add(this.mesh);
  }

  /** Burst at sim-space (x, y) with height h. */
  burst(x: number, y: number, h: number, n: number, color: number, speed = 3, size = 0.12, life = 0.5, up = 2, gravity = 1) {
    for (let k = 0; k < n; k++) {
      const i = this.head;
      this.head = (this.head + 1) % MAX;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.pos.set([x, h, -y], i * 3);
      this.vel.set([Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s], i * 3);
      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.6);
      this.size[i] = size * (0.6 + Math.random() * 0.8);
      this.grav[i] = gravity;
      this.mesh.setColorAt(i, this.color.set(color));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number) {
    const d = this.dummy;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) {
        d.position.set(0, -50, 0);
        d.scale.setScalar(0.0001);
      } else {
        this.life[i] -= dt;
        const o = i * 3;
        this.vel[o + 1] -= 9 * this.grav[i] * dt;
        this.pos[o] += this.vel[o] * dt;
        this.pos[o + 1] = Math.max(0.03, this.pos[o + 1] + this.vel[o + 1] * dt);
        this.pos[o + 2] += this.vel[o + 2] * dt;
        d.position.set(this.pos[o], this.pos[o + 1], this.pos[o + 2]);
        d.scale.setScalar(this.size[i] * Math.max(0.1, this.life[i] / this.maxLife[i]));
      }
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/**
 * Reward tiles that rain onto the squad when a jackpot block breaks (or a big gate is passed):
 * the count visibly "arrives" in the crowd instead of just changing.
 */
export class Cascade {
  readonly mesh: THREE.InstancedMesh;
  private static readonly MAX = 180;
  private sx = new Float32Array(Cascade.MAX);
  private sy = new Float32Array(Cascade.MAX);
  private sz = new Float32Array(Cascade.MAX);
  private ox = new Float32Array(Cascade.MAX);
  private oz = new Float32Array(Cascade.MAX);
  private age = new Float32Array(Cascade.MAX);
  private delay = new Float32Array(Cascade.MAX);
  private dur = new Float32Array(Cascade.MAX);
  private live = new Uint8Array(Cascade.MAX);
  private head = 0;
  private dummy = new THREE.Object3D();
  private col = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.08, 0.32), new THREE.MeshBasicMaterial({ fog: false }), Cascade.MAX);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  /** `n` tiles start spread over `width` at sim-space (x, y), height h, and home in on the squad. */
  spawn(x: number, y: number, width: number, h: number, n: number, spread = 0.9) {
    for (let k = 0; k < n; k++) {
      const i = this.head;
      this.head = (this.head + 1) % Cascade.MAX;
      this.sx[i] = x + (Math.random() - 0.5) * width;
      this.sy[i] = h + Math.random() * 1.2;
      this.sz[i] = -y + (Math.random() - 0.5) * 1.5;
      this.ox[i] = (Math.random() - 0.5) * spread * 2;
      this.oz[i] = (Math.random() - 0.5) * spread * 2;
      this.age[i] = 0;
      this.delay[i] = Math.random() * 0.7;
      this.dur[i] = 0.55 + Math.random() * 0.35;
      this.live[i] = 1;
      this.mesh.setColorAt(i, this.col.set(Math.random() < 0.18 ? 0xffc21a : 0x2f7bff));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** Squad position in three.js space (x, z). Returns how many tiles are in flight. */
  update(dt: number, squadX: number, squadZ: number): number {
    const d = this.dummy;
    let n = 0;
    for (let i = 0; i < Cascade.MAX; i++) {
      if (!this.live[i]) {
        d.position.set(0, -50, 0);
        d.scale.setScalar(0.0001);
      } else {
        this.age[i] += dt;
        const t = (this.age[i] - this.delay[i]) / this.dur[i];
        if (t >= 1) {
          this.live[i] = 0;
          d.position.set(0, -50, 0);
          d.scale.setScalar(0.0001);
        } else if (t < 0) {
          // waiting at the source
          d.position.set(this.sx[i], this.sy[i], this.sz[i]);
          d.rotation.set(0.6, 0, 0);
          d.scale.setScalar(1);
          n++;
        } else {
          const e = t * t; // accelerate into the crowd
          d.position.set(
            this.sx[i] + (squadX + this.ox[i] - this.sx[i]) * e,
            this.sy[i] + (0.9 - this.sy[i]) * e + Math.sin(t * Math.PI) * 1.4,
            this.sz[i] + (squadZ + this.oz[i] - this.sz[i]) * e,
          );
          d.rotation.set(0.6 + t * 4, t * 3, 0);
          d.scale.setScalar(1 - t * 0.55);
          n++;
        }
      }
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.count = Cascade.MAX;
    this.mesh.instanceMatrix.needsUpdate = true;
    return n;
  }
}
