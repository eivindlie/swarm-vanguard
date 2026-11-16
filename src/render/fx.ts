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
  burst(x: number, y: number, h: number, n: number, color: number, speed = 3, size = 0.12, life = 0.5, up = 2) {
    for (let k = 0; k < n; k++) {
      const i = this.head;
      this.head = (this.head + 1) % MAX;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.pos.set([x, h, -y], i * 3);
      this.vel.set([Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s], i * 3);
      this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.6);
      this.size[i] = size * (0.6 + Math.random() * 0.8);
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
        this.vel[o + 1] -= 9 * dt;
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
