import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Procedural low-poly figures: merged geometry with vertex colours, so every
// unit type is a single InstancedMesh (one draw call). All models face -Z.

type Part = { geo: THREE.BufferGeometry; color: number; pos?: [number, number, number]; rot?: [number, number, number]; scale?: [number, number, number] };

function build(parts: Part[]): THREE.BufferGeometry {
  const geos = parts.map((p) => {
    let g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    g.deleteAttribute('uv');
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...(p.pos ?? [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot ?? [0, 0, 0]))),
      new THREE.Vector3(...(p.scale ?? [1, 1, 1])),
    );
    g.applyMatrix4(m);
    const c = new THREE.Color(p.color);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  });
  return mergeGeometries(geos, false)!;
}

const cap = (r: number, h: number) => new THREE.CapsuleGeometry(r, h, 2, 7);
const sph = (r: number) => new THREE.SphereGeometry(r, 8, 6);
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
const cone = (r: number, h: number) => new THREE.ConeGeometry(r, h, 6);

export function soldierGeometry(): THREE.BufferGeometry {
  return build([
    { geo: cap(0.15, 0.22), color: 0x2f6fff, pos: [0, 0.28, 0] },
    { geo: sph(0.13), color: 0xffd1a1, pos: [0, 0.56, 0] },
    { geo: sph(0.145), color: 0x1d3f9e, pos: [0, 0.6, 0.01], scale: [1, 0.7, 1] },
    { geo: box(0.05, 0.06, 0.34), color: 0x333844, pos: [0.14, 0.33, -0.18] },
  ]);
}

export function gruntGeometry(): THREE.BufferGeometry {
  return build([
    { geo: cap(0.17, 0.2), color: 0xd93636, pos: [0, 0.28, 0] },
    { geo: sph(0.15), color: 0xa81f1f, pos: [0, 0.57, 0] },
    { geo: cone(0.04, 0.14), color: 0xf3e6c8, pos: [-0.09, 0.72, 0], rot: [0, 0, 0.35] },
    { geo: cone(0.04, 0.14), color: 0xf3e6c8, pos: [0.09, 0.72, 0], rot: [0, 0, -0.35] },
    { geo: sph(0.03), color: 0xffee55, pos: [-0.05, 0.6, -0.13] },
    { geo: sph(0.03), color: 0xffee55, pos: [0.05, 0.6, -0.13] },
  ]);
}

export function runnerGeometry(): THREE.BufferGeometry {
  return build([
    { geo: cap(0.12, 0.2), color: 0xff8a1f, pos: [0, 0.26, 0], rot: [-0.45, 0, 0] },
    { geo: sph(0.12), color: 0xc9600a, pos: [0, 0.5, -0.12] },
    { geo: cone(0.04, 0.14), color: 0xf3e6c8, pos: [0, 0.65, -0.12] },
    { geo: sph(0.025), color: 0xffee55, pos: [-0.04, 0.52, -0.23] },
    { geo: sph(0.025), color: 0xffee55, pos: [0.04, 0.52, -0.23] },
  ]);
}

export function bruteGeometry(): THREE.BufferGeometry {
  return build([
    { geo: cap(0.4, 0.5), color: 0x9a2020, pos: [0, 0.7, 0] },
    { geo: sph(0.3), color: 0x6d1313, pos: [0, 1.4, -0.05] },
    { geo: sph(0.24), color: 0x7a1717, pos: [-0.5, 1.05, 0] },
    { geo: sph(0.24), color: 0x7a1717, pos: [0.5, 1.05, 0] },
    { geo: cone(0.09, 0.32), color: 0xf3e6c8, pos: [-0.22, 1.72, 0], rot: [0, 0, 0.4] },
    { geo: cone(0.09, 0.32), color: 0xf3e6c8, pos: [0.22, 1.72, 0], rot: [0, 0, -0.4] },
    { geo: sph(0.06), color: 0xffee55, pos: [-0.11, 1.45, -0.28] },
    { geo: sph(0.06), color: 0xffee55, pos: [0.11, 1.45, -0.28] },
  ]);
}

export function bossGeometry(): THREE.BufferGeometry {
  return build([
    { geo: box(2.2, 2.0, 1.5), color: 0x5b1a73, pos: [0, 1.6, 0] },
    { geo: box(1.6, 0.5, 1.6), color: 0x3a0f4d, pos: [0, 0.5, 0] },
    { geo: sph(0.85), color: 0x7a2a99, pos: [0, 3.2, 0] },
    { geo: sph(0.55), color: 0x8e3bb0, pos: [-1.5, 2.3, 0] },
    { geo: sph(0.55), color: 0x8e3bb0, pos: [1.5, 2.3, 0] },
    { geo: box(0.5, 1.6, 0.5), color: 0x4d1566, pos: [-1.5, 1.4, -0.2] },
    { geo: box(0.5, 1.6, 0.5), color: 0x4d1566, pos: [1.5, 1.4, -0.2] },
    { geo: cone(0.22, 0.9), color: 0xf3e6c8, pos: [-0.55, 4.0, 0], rot: [0, 0, 0.35] },
    { geo: cone(0.22, 0.9), color: 0xf3e6c8, pos: [0.55, 4.0, 0], rot: [0, 0, -0.35] },
    { geo: sph(0.16), color: 0xffee55, pos: [-0.3, 3.3, -0.75] },
    { geo: sph(0.16), color: 0xffee55, pos: [0.3, 3.3, -0.75] },
  ]);
}

export function cactusGeometry(): THREE.BufferGeometry {
  return build([
    { geo: new THREE.CylinderGeometry(0.22, 0.26, 1.6, 7), color: 0x3f9a4a, pos: [0, 0.8, 0] },
    { geo: new THREE.CylinderGeometry(0.14, 0.14, 0.7, 6), color: 0x3f9a4a, pos: [0.4, 1.0, 0] },
    { geo: new THREE.CylinderGeometry(0.14, 0.14, 0.5, 6), color: 0x3f9a4a, pos: [-0.38, 0.75, 0] },
    { geo: sph(0.22), color: 0x3f9a4a, pos: [0, 1.6, 0] },
  ]);
}

export function rockGeometry(): THREE.BufferGeometry {
  return build([{ geo: new THREE.DodecahedronGeometry(0.7, 0), color: 0xb08a5a, pos: [0, 0.3, 0], scale: [1.3, 0.8, 1] }]);
}

export function mesaGeometry(): THREE.BufferGeometry {
  return build([
    { geo: new THREE.CylinderGeometry(2.4, 3.2, 5, 8), color: 0xc98f55, pos: [0, 2.5, 0] },
    { geo: new THREE.CylinderGeometry(2.5, 2.5, 0.4, 8), color: 0xe0b075, pos: [0, 5.1, 0] },
  ]);
}
