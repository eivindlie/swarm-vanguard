import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Procedural low-poly figures. Everything is merged into ONE geometry per unit type with
//  - vertex colours (no textures),
//  - aPart: which body part a vertex belongs to (0 body, 1/2 legs, 3/4 arms, 5 head),
//  - aPivot: the joint that part rotates around.
// The vertex shader (materials.ts) swings limbs from aPart/aPivot, so crowds animate in one draw call.
// All models face -Z and stand on y = 0.

export const PART = { body: 0, legL: 1, legR: 2, armL: 3, armR: 4, head: 5 } as const;
type V3 = [number, number, number];

interface Part {
  geo: THREE.BufferGeometry;
  color: number;
  pos?: V3;
  rot?: V3;
  scale?: V3;
  part?: number;
  pivot?: V3;
}

function build(parts: Part[]): THREE.BufferGeometry {
  const geos = parts.map((p) => {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    g.deleteAttribute('uv');
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...(p.pos ?? [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot ?? [0, 0, 0]))),
      new THREE.Vector3(...(p.scale ?? [1, 1, 1])),
    );
    g.applyMatrix4(m);
    const c = new THREE.Color(p.color);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    const part = new Float32Array(n).fill(p.part ?? 0);
    const piv = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col.set([c.r, c.g, c.b], i * 3);
      piv.set(p.pivot ?? [0, 0, 0], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
    g.setAttribute('aPivot', new THREE.BufferAttribute(piv, 3));
    return g;
  });
  return mergeGeometries(geos, false)!;
}

const cap = (r: number, h: number) => new THREE.CapsuleGeometry(r, h, 1, 6);
// coarse spheres keep crowds cheap; tiny details (eyes) are even coarser
const sph = (r: number) => (r < 0.07 ? new THREE.SphereGeometry(r, 4, 3) : new THREE.SphereGeometry(r, 6, 4));
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
const cone = (r: number, h: number, seg = 6) => new THREE.ConeGeometry(r, h, seg);
const cyl = (rt: number, rb: number, h: number, seg = 7) => new THREE.CylinderGeometry(rt, rb, h, seg);

// ---------------------------------------------------------------- crowd units

export function soldierGeometry(): THREE.BufferGeometry {
  const armor = 0x2f6fff;
  const dark = 0x1d3f9e;
  const pants = 0x24306b;
  const skin = 0xffd1a1;
  return build([
    { geo: cap(0.13, 0.16), color: armor, pos: [0, 0.31, 0] },
    { geo: box(0.2, 0.06, 0.15), color: 0x1a2147, pos: [0, 0.22, 0] }, // belt
    { geo: box(0.17, 0.22, 0.08), color: dark, pos: [0, 0.34, 0.13] }, // backpack
    { geo: sph(0.115), color: skin, pos: [0, 0.6, 0], part: PART.head, pivot: [0, 0.5, 0] },
    { geo: sph(0.135), color: dark, pos: [0, 0.645, 0.005], scale: [1, 0.72, 1], part: PART.head, pivot: [0, 0.5, 0] },
    { geo: box(0.15, 0.045, 0.03), color: 0x8fe9ff, pos: [0, 0.605, -0.115], part: PART.head, pivot: [0, 0.5, 0] }, // visor
    { geo: box(0.095, 0.21, 0.11), color: pants, pos: [-0.07, 0.105, 0], part: PART.legL, pivot: [-0.07, 0.21, 0] },
    { geo: box(0.095, 0.21, 0.11), color: pants, pos: [0.07, 0.105, 0], part: PART.legR, pivot: [0.07, 0.21, 0] },
    { geo: box(0.075, 0.2, 0.075), color: armor, pos: [-0.2, 0.36, 0], part: PART.armL, pivot: [-0.2, 0.45, 0] },
    { geo: box(0.075, 0.2, 0.075), color: armor, pos: [0.2, 0.36, 0], part: PART.armR, pivot: [0.2, 0.45, 0] },
    { geo: box(0.05, 0.06, 0.34), color: 0x2b2f3a, pos: [0.19, 0.31, -0.17] }, // rifle
  ]);
}

export function gruntGeometry(): THREE.BufferGeometry {
  const red = 0xd93636;
  const dark = 0xa81f1f;
  const bone = 0xf3e6c8;
  return build([
    { geo: cap(0.16, 0.14), color: red, pos: [0, 0.29, 0] },
    { geo: sph(0.145), color: dark, pos: [0, 0.57, -0.01], part: PART.head, pivot: [0, 0.48, 0] },
    { geo: cone(0.04, 0.15), color: bone, pos: [-0.09, 0.73, 0], rot: [0, 0, 0.4], part: PART.head, pivot: [0, 0.48, 0] },
    { geo: cone(0.04, 0.15), color: bone, pos: [0.09, 0.73, 0], rot: [0, 0, -0.4], part: PART.head, pivot: [0, 0.48, 0] },
    { geo: sph(0.032), color: 0xffee55, pos: [-0.055, 0.6, -0.125], part: PART.head, pivot: [0, 0.48, 0] },
    { geo: sph(0.032), color: 0xffee55, pos: [0.055, 0.6, -0.125], part: PART.head, pivot: [0, 0.48, 0] },
    { geo: cone(0.022, 0.06), color: bone, pos: [-0.04, 0.51, -0.13], rot: [Math.PI, 0, 0], part: PART.head, pivot: [0, 0.48, 0] },
    { geo: cone(0.022, 0.06), color: bone, pos: [0.04, 0.51, -0.13], rot: [Math.PI, 0, 0], part: PART.head, pivot: [0, 0.48, 0] },
    { geo: box(0.1, 0.18, 0.11), color: dark, pos: [-0.075, 0.09, 0], part: PART.legL, pivot: [-0.075, 0.18, 0] },
    { geo: box(0.1, 0.18, 0.11), color: dark, pos: [0.075, 0.09, 0], part: PART.legR, pivot: [0.075, 0.18, 0] },
    { geo: box(0.08, 0.22, 0.08), color: red, pos: [-0.22, 0.33, -0.04], rot: [-0.5, 0, 0], part: PART.armL, pivot: [-0.22, 0.43, 0] },
    { geo: box(0.08, 0.22, 0.08), color: red, pos: [0.22, 0.33, -0.04], rot: [-0.5, 0, 0], part: PART.armR, pivot: [0.22, 0.43, 0] },
    { geo: cone(0.05, 0.16), color: dark, pos: [0, 0.2, 0.2], rot: [Math.PI / 2 + 0.3, 0, 0] }, // tail
  ]);
}

export function runnerGeometry(): THREE.BufferGeometry {
  const orange = 0xff8a1f;
  const dark = 0xc9600a;
  const bone = 0xf3e6c8;
  const lean: V3 = [-0.55, 0, 0];
  return build([
    { geo: cap(0.12, 0.2), color: orange, pos: [0, 0.3, -0.04], rot: lean },
    { geo: sph(0.115), color: dark, pos: [0, 0.5, -0.17], part: PART.head, pivot: [0, 0.45, -0.1] },
    { geo: cone(0.035, 0.16), color: bone, pos: [0, 0.66, -0.17], rot: [-0.6, 0, 0], part: PART.head, pivot: [0, 0.45, -0.1] },
    { geo: sph(0.026), color: 0xffee55, pos: [-0.045, 0.52, -0.27], part: PART.head, pivot: [0, 0.45, -0.1] },
    { geo: sph(0.026), color: 0xffee55, pos: [0.045, 0.52, -0.27], part: PART.head, pivot: [0, 0.45, -0.1] },
    { geo: cone(0.04, 0.12), color: dark, pos: [0, 0.42, 0.1], rot: [Math.PI / 2 - 0.2, 0, 0] },
    { geo: cone(0.04, 0.12), color: dark, pos: [0, 0.34, 0.14], rot: [Math.PI / 2 - 0.2, 0, 0] },
    { geo: box(0.08, 0.2, 0.09), color: dark, pos: [-0.06, 0.1, 0], part: PART.legL, pivot: [-0.06, 0.2, 0] },
    { geo: box(0.08, 0.2, 0.09), color: dark, pos: [0.06, 0.1, 0], part: PART.legR, pivot: [0.06, 0.2, 0] },
    { geo: box(0.06, 0.2, 0.06), color: orange, pos: [-0.17, 0.34, -0.1], rot: [-0.9, 0, 0], part: PART.armL, pivot: [-0.17, 0.42, -0.05] },
    { geo: box(0.06, 0.2, 0.06), color: orange, pos: [0.17, 0.34, -0.1], rot: [-0.9, 0, 0], part: PART.armR, pivot: [0.17, 0.42, -0.05] },
  ]);
}

export function bruteGeometry(): THREE.BufferGeometry {
  const hide = 0x9a2020;
  const dark = 0x6d1313;
  const bone = 0xf3e6c8;
  return build([
    { geo: cap(0.38, 0.36), color: hide, pos: [0, 0.8, 0] },
    { geo: box(0.7, 0.14, 0.5), color: 0x3b1b12, pos: [0, 0.55, 0] }, // belt
    { geo: sph(0.24), color: dark, pos: [0, 1.4, -0.06], part: PART.head, pivot: [0, 1.2, 0] },
    { geo: cone(0.09, 0.34), color: bone, pos: [-0.2, 1.68, -0.04], rot: [0, 0, 0.45], part: PART.head, pivot: [0, 1.2, 0] },
    { geo: cone(0.09, 0.34), color: bone, pos: [0.2, 1.68, -0.04], rot: [0, 0, -0.45], part: PART.head, pivot: [0, 1.2, 0] },
    { geo: sph(0.055), color: 0xffee55, pos: [-0.1, 1.43, -0.27], part: PART.head, pivot: [0, 1.2, 0] },
    { geo: sph(0.055), color: 0xffee55, pos: [0.1, 1.43, -0.27], part: PART.head, pivot: [0, 1.2, 0] },
    { geo: box(0.26, 0.55, 0.28), color: dark, pos: [-0.22, 0.27, 0], part: PART.legL, pivot: [-0.22, 0.55, 0] },
    { geo: box(0.26, 0.55, 0.28), color: dark, pos: [0.22, 0.27, 0], part: PART.legR, pivot: [0.22, 0.55, 0] },
    { geo: box(0.24, 0.62, 0.24), color: hide, pos: [-0.58, 0.8, -0.05], part: PART.armL, pivot: [-0.58, 1.12, 0] },
    { geo: box(0.24, 0.62, 0.24), color: hide, pos: [0.58, 0.8, -0.05], part: PART.armR, pivot: [0.58, 1.12, 0] },
    { geo: sph(0.19), color: dark, pos: [-0.58, 0.42, -0.05], part: PART.armL, pivot: [-0.58, 1.12, 0] },
    { geo: sph(0.19), color: dark, pos: [0.58, 0.42, -0.05], part: PART.armR, pivot: [0.58, 1.12, 0] },
    { geo: cone(0.09, 0.28), color: bone, pos: [-0.62, 1.28, 0], rot: [0, 0, 0.5], part: PART.armL, pivot: [-0.58, 1.12, 0] },
    { geo: cone(0.09, 0.28), color: bone, pos: [0.62, 1.28, 0], rot: [0, 0, -0.5], part: PART.armR, pivot: [0.58, 1.12, 0] },
    { geo: cyl(0.07, 0.11, 0.75), color: 0x5a3a22, pos: [0.62, 0.55, -0.32], rot: [-0.5, 0, 0], part: PART.armR, pivot: [0.58, 1.12, 0] }, // club
    { geo: sph(0.17), color: 0x6b4a2c, pos: [0.62, 0.9, -0.55], part: PART.armR, pivot: [0.58, 1.12, 0] },
  ]);
}

export type BossVariant = 'golem' | 'ogre' | 'frost' | 'demon' | 'idol' | 'robot' | 'candy' | 'lunar';

/** Four bosses on one animated skeleton, differentiated by palette and silhouette. */
export function bossGeometry(v: BossVariant): THREE.BufferGeometry {
  const pal = {
    golem: { skin: 0xc9a063, dark: 0x8f6f3d, accent: 0xffd23a, trim: 0xe8d3a0 },
    ogre: { skin: 0xb5533c, dark: 0x7a2f22, accent: 0xffee55, trim: 0xf3e6c8 },
    frost: { skin: 0x9fd8ff, dark: 0x5fa3d6, accent: 0xffffff, trim: 0xe6f6ff },
    demon: { skin: 0x3a2330, dark: 0x1d1119, accent: 0xff7a1a, trim: 0xff5a2a },
    idol: { skin: 0x7f8f6a, dark: 0x4f6240, accent: 0x5af0d0, trim: 0xc7d99a },
    robot: { skin: 0x3a4466, dark: 0x1c2238, accent: 0xff3ad0, trim: 0x3af0ff },
    candy: { skin: 0xff8fc4, dark: 0xc2467e, accent: 0xfff27a, trim: 0xffffff },
    lunar: { skin: 0xd8dde6, dark: 0x8b93a6, accent: 0x6ae0ff, trim: 0xff6a4a },
  }[v];
  const parts: Part[] = [
    { geo: box(2.1, 1.9, 1.4), color: pal.skin, pos: [0, 2.15, 0] },
    { geo: box(2.2, 0.35, 1.5), color: pal.dark, pos: [0, 1.3, 0] },
    { geo: box(0.75, 1.3, 0.85), color: pal.dark, pos: [-0.6, 0.65, 0], part: PART.legL, pivot: [-0.6, 1.3, 0] },
    { geo: box(0.75, 1.3, 0.85), color: pal.dark, pos: [0.6, 0.65, 0], part: PART.legR, pivot: [0.6, 1.3, 0] },
    { geo: box(0.62, 1.9, 0.62), color: pal.skin, pos: [-1.5, 2.1, -0.1], part: PART.armL, pivot: [-1.5, 3.0, 0] },
    { geo: box(0.62, 1.9, 0.62), color: pal.skin, pos: [1.5, 2.1, -0.1], part: PART.armR, pivot: [1.5, 3.0, 0] },
    { geo: sph(0.55), color: pal.dark, pos: [-1.5, 1.05, -0.1], part: PART.armL, pivot: [-1.5, 3.0, 0] },
    { geo: sph(0.55), color: pal.dark, pos: [1.5, 1.05, -0.1], part: PART.armR, pivot: [1.5, 3.0, 0] },
    { geo: sph(0.55), color: pal.dark, pos: [-1.45, 3.1, 0] }, // shoulders
    { geo: sph(0.55), color: pal.dark, pos: [1.45, 3.1, 0] },
  ];
  const head: Part[] = [];
  const H = { part: PART.head, pivot: [0, 3.1, 0] as V3 };
  if (v === 'golem') {
    head.push({ geo: box(1.0, 0.85, 0.95), color: pal.skin, pos: [0, 3.55, -0.05], ...H });
    head.push({ geo: box(0.7, 0.14, 0.1), color: pal.accent, pos: [0, 3.58, -0.55], ...H }); // glowing visor slit
    parts.push({ geo: box(0.55, 0.55, 0.12), color: pal.accent, pos: [0, 2.3, -0.72] }); // rune core
    parts.push({ geo: new THREE.DodecahedronGeometry(0.5, 0), color: pal.dark, pos: [-1.6, 3.5, 0] });
    parts.push({ geo: new THREE.DodecahedronGeometry(0.42, 0), color: pal.dark, pos: [1.6, 3.5, 0.1] });
  } else if (v === 'idol') {
    // a mossy stone totem: blocky head with a tall headdress, glowing teal eyes and chest gem, vines hanging off it
    head.push({ geo: box(1.1, 0.9, 1.0), color: pal.skin, pos: [0, 3.55, -0.05], ...H });
    for (let i = -2; i <= 2; i++) head.push({ geo: box(0.2, 0.7 + (2 - Math.abs(i)) * 0.35, 0.3), color: i % 2 ? pal.trim : pal.dark, pos: [i * 0.26, 4.25 + (2 - Math.abs(i)) * 0.17, 0], ...H }); // headdress
    head.push({ geo: sph(0.14), color: pal.accent, pos: [-0.3, 3.62, -0.58], ...H });
    head.push({ geo: sph(0.14), color: pal.accent, pos: [0.3, 3.62, -0.58], ...H });
    head.push({ geo: box(0.55, 0.18, 0.12), color: pal.dark, pos: [0, 3.2, -0.55], ...H }); // mouth
    parts.push({ geo: new THREE.OctahedronGeometry(0.42, 0), color: pal.accent, pos: [0, 2.4, -0.78] }); // chest gem
    for (const [x, y, z] of [[-0.7, 3.0, -0.72], [0.8, 2.6, -0.72], [-0.2, 1.8, -0.72], [1.6, 2.4, -0.4], [-1.6, 2.0, -0.4]] as const) {
      parts.push({ geo: box(0.12, 0.9, 0.12), color: 0x3f9a4a, pos: [x, y, z] }); // vines
    }
    parts.push({ geo: sph(0.5), color: 0x4a8a3c, pos: [-1.45, 3.1, 0.1] }); // moss on the shoulders
    parts.push({ geo: sph(0.4), color: 0x4a8a3c, pos: [1.5, 3.2, 0.1] });
  } else if (v === 'robot') {
    // a neon mech: boxy head with a cyan visor strip, antennae and magenta chest core
    head.push({ geo: box(1.1, 0.8, 0.95), color: pal.skin, pos: [0, 3.5, -0.05], ...H });
    head.push({ geo: box(0.95, 0.16, 0.1), color: pal.trim, pos: [0, 3.55, -0.55], ...H });
    head.push({ geo: cyl(0.04, 0.04, 0.9, 5), color: pal.dark, pos: [-0.4, 4.3, 0], ...H });
    head.push({ geo: cyl(0.04, 0.04, 0.7, 5), color: pal.dark, pos: [0.4, 4.2, 0], ...H });
    head.push({ geo: sph(0.1), color: pal.accent, pos: [-0.4, 4.78, 0], ...H });
    head.push({ geo: sph(0.1), color: pal.trim, pos: [0.4, 4.58, 0], ...H });
    parts.push({ geo: box(0.9, 0.9, 0.12), color: pal.accent, pos: [0, 2.3, -0.74] });
    for (let i = 0; i < 3; i++) parts.push({ geo: box(2.0, 0.07, 0.1), color: pal.trim, pos: [0, 1.7 + i * 0.3, -0.72] });
  } else if (v === 'candy') {
    // a giant gummy bear: round soft head, button eyes, icing belt and lollipop shoulders
    head.push({ geo: sph(0.8), color: pal.skin, pos: [0, 3.5, -0.05], ...H });
    head.push({ geo: sph(0.32), color: pal.skin, pos: [-0.62, 4.1, 0], ...H });
    head.push({ geo: sph(0.32), color: pal.skin, pos: [0.62, 4.1, 0], ...H });
    head.push({ geo: sph(0.12), color: 0x3a1a2a, pos: [-0.28, 3.6, -0.7], ...H });
    head.push({ geo: sph(0.12), color: 0x3a1a2a, pos: [0.28, 3.6, -0.7], ...H });
    head.push({ geo: box(0.4, 0.1, 0.1), color: pal.dark, pos: [0, 3.25, -0.74], ...H });
    parts.push({ geo: box(2.2, 0.4, 1.5), color: pal.trim, pos: [0, 1.55, 0] });
    for (let i = -2; i <= 2; i++) parts.push({ geo: sph(0.14), color: i % 2 ? pal.accent : pal.dark, pos: [i * 0.4, 2.7, -0.74] });
    parts.push({ geo: cyl(0.06, 0.06, 1.2, 5), color: pal.trim, pos: [-1.6, 3.9, 0.1] });
    parts.push({ geo: sph(0.4), color: pal.accent, pos: [-1.6, 4.6, 0.1] });
  } else if (v === 'lunar') {
    // a moon-base colossus: helmeted dome head, visor glow, antenna dish and warning stripes
    head.push({ geo: sph(0.85), color: pal.skin, pos: [0, 3.5, -0.05], ...H });
    head.push({ geo: box(1.0, 0.4, 0.2), color: pal.accent, pos: [0, 3.55, -0.7], ...H });
    head.push({ geo: cyl(0.04, 0.04, 0.8, 5), color: pal.dark, pos: [0.5, 4.4, 0], ...H });
    head.push({ geo: cone(0.3, 0.2), color: pal.trim, pos: [0.5, 4.85, 0], rot: [Math.PI, 0, 0], ...H });
    parts.push({ geo: box(1.2, 1.0, 0.3), color: pal.dark, pos: [0, 2.3, 0.9] }); // life-support pack
    for (let i = 0; i < 4; i++) parts.push({ geo: box(0.35, 0.08, 0.1), color: pal.trim, pos: [-0.75 + i * 0.5, 1.45, -0.74], rot: [0, 0, 0.5] });
    parts.push({ geo: sph(0.4), color: pal.dark, pos: [-1.45, 3.1, 0.1] });
    parts.push({ geo: sph(0.4), color: pal.dark, pos: [1.5, 3.2, 0.1] });
  } else if (v === 'ogre') {
    head.push({ geo: sph(0.72), color: pal.skin, pos: [0, 3.5, -0.05], ...H });
    head.push({ geo: cone(0.18, 0.85), color: pal.trim, pos: [-0.5, 4.15, 0], rot: [0, 0, 0.5], ...H });
    head.push({ geo: cone(0.18, 0.85), color: pal.trim, pos: [0.5, 4.15, 0], rot: [0, 0, -0.5], ...H });
    head.push({ geo: cone(0.1, 0.4), color: pal.trim, pos: [-0.25, 3.15, -0.62], rot: [Math.PI, 0, 0], ...H }); // tusks
    head.push({ geo: cone(0.1, 0.4), color: pal.trim, pos: [0.25, 3.15, -0.62], rot: [Math.PI, 0, 0], ...H });
    head.push({ geo: sph(0.11), color: pal.accent, pos: [-0.28, 3.6, -0.66], ...H });
    head.push({ geo: sph(0.11), color: pal.accent, pos: [0.28, 3.6, -0.66], ...H });
    parts.push({ geo: box(2.0, 0.6, 1.3), color: 0x3b1b12, pos: [0, 1.55, 0] }); // belt
  } else if (v === 'frost') {
    head.push({ geo: sph(0.7), color: pal.skin, pos: [0, 3.5, -0.05], ...H });
    for (let i = -2; i <= 2; i++) {
      head.push({ geo: cone(0.14, 0.9 - Math.abs(i) * 0.15), color: pal.trim, pos: [i * 0.28, 4.15, 0], rot: [0, 0, -i * 0.2], ...H });
    }
    head.push({ geo: sph(0.1), color: 0x2a6bff, pos: [-0.27, 3.58, -0.64], ...H });
    head.push({ geo: sph(0.1), color: 0x2a6bff, pos: [0.27, 3.58, -0.64], ...H });
    for (const [x, z] of [[-1.5, 0.1], [1.5, 0.1], [-0.6, 0.8], [0.6, 0.8], [0, 0.85]] as const) {
      parts.push({ geo: cone(0.22, 1.1), color: pal.trim, pos: [x, 3.55, z], rot: [0.2, 0, x * 0.1] }); // ice crystals
    }
    parts.push({ geo: cap(0.4, 0.5), color: 0xffffff, pos: [0, 1.62, -0.7], rot: [0, 0, Math.PI / 2] }); // fur belt
  } else {
    head.push({ geo: sph(0.7), color: pal.skin, pos: [0, 3.5, -0.05], ...H });
    head.push({ geo: cone(0.2, 1.1), color: pal.dark, pos: [-0.55, 4.2, 0.05], rot: [0, 0, 0.6], ...H });
    head.push({ geo: cone(0.2, 1.1), color: pal.dark, pos: [0.55, 4.2, 0.05], rot: [0, 0, -0.6], ...H });
    for (let i = -1; i <= 1; i++) head.push({ geo: cone(0.12, 0.5 + (1 - Math.abs(i)) * 0.3), color: pal.trim, pos: [i * 0.26, 4.15, -0.05], ...H }); // flame crown
    head.push({ geo: sph(0.12), color: pal.accent, pos: [-0.27, 3.58, -0.64], ...H });
    head.push({ geo: sph(0.12), color: pal.accent, pos: [0.27, 3.58, -0.64], ...H });
    for (let i = 0; i < 4; i++) parts.push({ geo: box(1.5 - i * 0.2, 0.08, 0.1), color: pal.accent, pos: [0, 2.9 - i * 0.38, -0.72] }); // lava cracks
  }
  return build([...parts, ...head]);
}


// ------------------------------------------------------------------- page 2 enemies and decor

/** Bomber: a round walking bomb with a glowing fuse and a hazard band (explodes on contact for heavy losses). */
export function bomberGeometry(): THREE.BufferGeometry {
  return build([
    { geo: sph(0.3), color: 0x2a2f45, pos: [0, 0.42, 0] },
    { geo: box(0.64, 0.08, 0.64), color: 0xffd22a, pos: [0, 0.42, 0] },
    { geo: cyl(0.04, 0.04, 0.2, 5), color: 0x777777, pos: [0, 0.78, 0] },
    { geo: sph(0.08), color: 0xff3a2a, pos: [0, 0.9, 0] },
    { geo: box(0.1, 0.2, 0.1), color: 0x1c2030, pos: [-0.1, 0.1, 0], part: PART.legL, pivot: [-0.1, 0.2, 0] },
    { geo: box(0.1, 0.2, 0.1), color: 0x1c2030, pos: [0.1, 0.1, 0], part: PART.legR, pivot: [0.1, 0.2, 0] },
    { geo: sph(0.05), color: 0xff3a2a, pos: [-0.1, 0.5, -0.27] },
    { geo: sph(0.05), color: 0xff3a2a, pos: [0.1, 0.5, -0.27] },
  ]);
}

/** Jelly: a wobbly candy blob with a cherry on top. */
export function jellyGeometry(): THREE.BufferGeometry {
  return build([
    { geo: sph(0.36), color: 0xff6aa8, pos: [0, 0.38, 0], scale: [1, 0.9, 1] },
    { geo: sph(0.2), color: 0xff9ccb, pos: [-0.1, 0.52, -0.2] },
    { geo: sph(0.05), color: 0x2a1020, pos: [-0.12, 0.5, -0.34], part: PART.head, pivot: [0, 0.4, 0] },
    { geo: sph(0.05), color: 0x2a1020, pos: [0.12, 0.5, -0.34], part: PART.head, pivot: [0, 0.4, 0] },
    { geo: sph(0.09), color: 0xd01a3a, pos: [0, 0.8, 0] },
    { geo: box(0.1, 0.12, 0.1), color: 0xc2467e, pos: [-0.12, 0.06, 0], part: PART.legL, pivot: [-0.12, 0.14, 0] },
    { geo: box(0.1, 0.12, 0.1), color: 0xc2467e, pos: [0.12, 0.06, 0], part: PART.legR, pivot: [0.12, 0.14, 0] },
  ]);
}

/** Drone: a hovering moon-base bot with a single lens. */
export function droneGeometry(): THREE.BufferGeometry {
  return build([
    { geo: sph(0.3), color: 0xc9d0dc, pos: [0, 0.7, 0], scale: [1.2, 0.8, 1.2] },
    { geo: sph(0.12), color: 0xff4a3a, pos: [0, 0.72, -0.3] },
    { geo: box(0.9, 0.05, 0.14), color: 0x7d869a, pos: [0, 0.86, 0], part: PART.head, pivot: [0, 0.86, 0] },
    { geo: cone(0.12, 0.25), color: 0x7d869a, pos: [0, 0.35, 0], rot: [Math.PI, 0, 0], part: PART.legL, pivot: [0, 0.5, 0] },
  ]);
}

export function skyscraperGeometry(): THREE.BufferGeometry {
  const parts: Part[] = [{ geo: box(1.6, 5.2, 1.6), color: 0x232845, pos: [0, 2.6, 0] }];
  for (let i = 0; i < 7; i++) {
    const c = [0xff3ad0, 0x3af0ff, 0xfff27a][i % 3];
    parts.push({ geo: box(1.64, 0.14, 1.64), color: c, pos: [0, 0.6 + i * 0.7, 0] });
  }
  parts.push({ geo: cyl(0.04, 0.04, 1.2, 5), color: 0x777777, pos: [0, 5.8, 0] });
  parts.push({ geo: sph(0.1), color: 0xff3a2a, pos: [0, 6.45, 0] });
  return build(parts);
}
export function pylonGeometry(): THREE.BufferGeometry {
  return build([
    { geo: cyl(0.1, 0.14, 2.6, 6), color: 0x3a4466, pos: [0, 1.3, 0] },
    { geo: box(1.2, 0.5, 0.1), color: 0xff3ad0, pos: [0, 2.7, 0] },
    { geo: box(0.9, 0.3, 0.12), color: 0x3af0ff, pos: [0, 2.2, 0] },
  ]);
}
export function lollipopGeometry(): THREE.BufferGeometry {
  return build([
    { geo: cyl(0.06, 0.06, 1.7, 5), color: 0xffffff, pos: [0, 0.85, 0] },
    { geo: cyl(0.55, 0.55, 0.12, 12), color: 0xff5aa0, pos: [0, 1.95, 0], rot: [Math.PI / 2, 0, 0] },
    { geo: cyl(0.34, 0.34, 0.14, 12), color: 0xfff27a, pos: [0, 1.95, 0], rot: [Math.PI / 2, 0, 0] },
    { geo: cyl(0.14, 0.14, 0.16, 8), color: 0x7ae0ff, pos: [0, 1.95, 0], rot: [Math.PI / 2, 0, 0] },
  ]);
}
export function candyCaneGeometry(): THREE.BufferGeometry {
  const parts: Part[] = [];
  for (let i = 0; i < 6; i++) parts.push({ geo: cyl(0.14, 0.14, 0.3, 8), color: i % 2 ? 0xffffff : 0xe0245a, pos: [0, 0.15 + i * 0.3, 0] });
  parts.push({ geo: cyl(0.14, 0.14, 0.5, 8), color: 0xe0245a, pos: [0.22, 1.9, 0], rot: [0, 0, Math.PI / 2] });
  return build(parts);
}
export function gumdropGeometry(): THREE.BufferGeometry {
  return build([
    { geo: sph(0.7), color: 0x7ae07a, pos: [0, 0.35, 0], scale: [1, 0.8, 1] },
    { geo: sph(0.1), color: 0xffffff, pos: [-0.2, 0.7, -0.3] },
    { geo: cyl(0.7, 0.7, 0.12, 12), color: 0xffffff, pos: [0, 0.06, 0] },
  ]);
}
export function cupcakeGeometry(): THREE.BufferGeometry {
  return build([
    { geo: cone(0.7, 0.8), color: 0xd9a066, pos: [0, 0.4, 0], rot: [Math.PI, 0, 0] },
    { geo: sph(0.72), color: 0xff9ccb, pos: [0, 1.0, 0], scale: [1, 0.7, 1] },
    { geo: sph(0.5), color: 0xffffff, pos: [0, 1.4, 0], scale: [1, 0.7, 1] },
    { geo: sph(0.14), color: 0xd01a3a, pos: [0, 1.8, 0] },
  ]);
}
export function domeGeometry(): THREE.BufferGeometry {
  return build([
    { geo: cyl(1.8, 2.0, 0.6, 14), color: 0x8b93a6, pos: [0, 0.3, 0] },
    { geo: new THREE.SphereGeometry(1.6, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), color: 0xbfe6f5, pos: [0, 0.6, 0] },
    { geo: box(0.5, 0.7, 0.3), color: 0x4b5468, pos: [0, 0.65, -1.9] },
  ]);
}
export function antennaGeometry(): THREE.BufferGeometry {
  return build([
    { geo: cyl(0.08, 0.12, 3.4, 6), color: 0xc9d0dc, pos: [0, 1.7, 0] },
    { geo: cone(0.55, 0.3), color: 0xe8edf5, pos: [0, 3.5, 0], rot: [Math.PI * 0.8, 0, 0] },
    { geo: sph(0.08), color: 0xff4a3a, pos: [0, 3.5, 0] },
  ]);
}
export function craterRockGeometry(): THREE.BufferGeometry {
  return build([
    { geo: new THREE.DodecahedronGeometry(0.8, 0), color: 0x9aa0ad, pos: [0, 0.35, 0], scale: [1.3, 0.7, 1.1] },
    { geo: new THREE.DodecahedronGeometry(0.4, 0), color: 0x777d8a, pos: [0.3, 0.6, 0.1], scale: [1.2, 0.4, 1] },
  ]);
}

// ------------------------------------------------------------------- props

export function cactusGeometry(): THREE.BufferGeometry {
  const g = 0x3f9a4a;
  return build([
    { geo: cyl(0.22, 0.26, 1.6), color: g, pos: [0, 0.8, 0] },
    { geo: cyl(0.14, 0.14, 0.7, 6), color: g, pos: [0.4, 1.0, 0] },
    { geo: cyl(0.14, 0.14, 0.5, 6), color: g, pos: [-0.38, 0.75, 0] },
    { geo: sph(0.22), color: g, pos: [0, 1.6, 0] },
    { geo: sph(0.06), color: 0xff6aa0, pos: [0, 1.82, 0] },
  ]);
}

export function rockGeometry(tint = 0xb08a5a, top = 0): THREE.BufferGeometry {
  const parts: Part[] = [{ geo: new THREE.DodecahedronGeometry(0.7, 0), color: tint, pos: [0, 0.3, 0], scale: [1.3, 0.8, 1] }];
  if (top) parts.push({ geo: new THREE.DodecahedronGeometry(0.5, 0), color: top, pos: [0, 0.55, 0], scale: [1.2, 0.45, 0.9] });
  return build(parts);
}

export function mesaGeometry(body = 0xc98f55, cap_ = 0xe0b075): THREE.BufferGeometry {
  return build([
    { geo: cyl(2.4, 3.2, 5, 8), color: body, pos: [0, 2.5, 0] },
    { geo: cyl(2.5, 2.5, 0.4, 8), color: cap_, pos: [0, 5.1, 0] },
    { geo: cyl(1.1, 1.4, 1.5, 7), color: body, pos: [0.8, 5.9, 0.4] },
  ]);
}

export function archGeometry(color = 0xb8573a): THREE.BufferGeometry {
  return build([
    { geo: box(1.3, 4.4, 1.6), color, pos: [-2.2, 2.2, 0] },
    { geo: box(1.3, 4.4, 1.6), color, pos: [2.2, 2.2, 0] },
    { geo: box(5.8, 1.3, 1.6), color: 0xcf6a48, pos: [0, 4.6, 0] },
    { geo: box(2.2, 1, 1.4), color, pos: [0, 5.6, 0] },
  ]);
}

export function pineGeometry(): THREE.BufferGeometry {
  return build([
    { geo: cyl(0.18, 0.24, 0.9), color: 0x5a3a22, pos: [0, 0.45, 0] },
    { geo: cone(1.1, 1.5, 7), color: 0x2f7f55, pos: [0, 1.5, 0] },
    { geo: cone(0.85, 1.3, 7), color: 0x37925f, pos: [0, 2.3, 0] },
    { geo: cone(0.55, 1.1, 7), color: 0x42a86d, pos: [0, 3.0, 0] },
    { geo: cone(0.45, 0.5, 7), color: 0xf4fbff, pos: [0, 3.35, 0] }, // snow cap
  ]);
}

export function crystalGeometry(): THREE.BufferGeometry {
  return build([
    { geo: cone(0.35, 2.2, 5), color: 0x9ee7ff, pos: [0, 1.1, 0] },
    { geo: cone(0.28, 1.5, 5), color: 0xc9f3ff, pos: [0.5, 0.75, 0.2], rot: [0.2, 0, -0.3] },
    { geo: cone(0.25, 1.2, 5), color: 0x7fd0ff, pos: [-0.45, 0.6, -0.1], rot: [-0.1, 0, 0.35] },
  ]);
}

export function deadTreeGeometry(): THREE.BufferGeometry {
  const w = 0x6b4a33;
  return build([
    { geo: cyl(0.1, 0.22, 2.4, 6), color: w, pos: [0, 1.2, 0] },
    { geo: cyl(0.06, 0.1, 1.0, 5), color: w, pos: [0.4, 1.9, 0], rot: [0, 0, -0.9] },
    { geo: cyl(0.05, 0.08, 0.8, 5), color: w, pos: [-0.35, 1.6, 0], rot: [0, 0, 0.9] },
    { geo: cyl(0.04, 0.06, 0.6, 5), color: w, pos: [0.15, 2.4, 0.1], rot: [0.5, 0, -0.4] },
  ]);
}

export function lavaSpikeGeometry(): THREE.BufferGeometry {
  return build([
    { geo: cone(0.55, 2.6, 5), color: 0x2a1a24, pos: [0, 1.3, 0] },
    { geo: cone(0.4, 1.6, 5), color: 0x3a2330, pos: [0.7, 0.8, 0.3], rot: [0.1, 0, -0.25] },
    { geo: cone(0.15, 0.9, 5), color: 0xff7a1a, pos: [0.05, 2.3, 0] }, // glowing tip
  ]);
}

export function lavaRockGeometry(): THREE.BufferGeometry {
  return build([
    { geo: new THREE.DodecahedronGeometry(0.8, 0), color: 0x2f2029, pos: [0, 0.35, 0], scale: [1.3, 0.8, 1] },
    { geo: new THREE.DodecahedronGeometry(0.35, 0), color: 0xff7a1a, pos: [0.3, 0.7, 0.2], scale: [1, 0.5, 1] },
  ]);
}

export function postGeometry(color = 0x8b6b45, cap_ = 0xe8d3a0): THREE.BufferGeometry {
  return build([
    { geo: cyl(0.14, 0.18, 1.0), color, pos: [0, 0.5, 0] },
    { geo: sph(0.17), color: cap_, pos: [0, 1.05, 0] },
  ]);
}

// ------------------------------------------- merged static props (fewer draw calls)

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}

/** Posts + lamps + top bar of a gate as ONE vertex-coloured mesh (unlit). */
export function gateFrameGeometry(w: number, kind: 'good' | 'bad' | 'up'): THREE.BufferGeometry {
  return cached(`gate|${w}|${kind}`, () => {
    const glow = kind === 'bad' ? 0xff6a6a : kind === 'up' ? 0xc99bff : 0x6aa8ff;
    const post = kind === 'bad' ? 0x8a2a2a : kind === 'up' ? 0x5a2a9a : 0x2a4f9a;
    return build([
      { geo: box(w, 0.24, 0.24), color: glow, pos: [0, 2.6, 0] },
      { geo: box(0.28, 2.7, 0.28), color: post, pos: [-w / 2, 1.35, 0] },
      { geo: box(0.28, 2.7, 0.28), color: post, pos: [w / 2, 1.35, 0] },
      { geo: sph(0.22), color: glow, pos: [-w / 2, 2.85, 0] },
      { geo: sph(0.22), color: glow, pos: [w / 2, 2.85, 0] },
    ]);
  });
}

/** Crate/stone block: body, lid and side bands merged into one mesh. */
export function blockGeometry(w: number, d: number, special: boolean): THREE.BufferGeometry {
  return cached(`block|${w}|${d}|${special}`, () => {
    const body = special ? 0xe3a823 : 0x7e93b0;
    const lid = special ? 0xffd75e : 0xb4c8e0;
    const band = special ? 0xb97a10 : 0x566a86;
    return build([
      { geo: box(w, 1.5, d), color: body, pos: [0, 0.75, 0] },
      { geo: box(w + 0.12, 0.2, d + 0.12), color: lid, pos: [0, 1.55, 0] },
      { geo: box(0.16, 1.55, d + 0.1), color: band, pos: [-(w / 2 - 0.08), 0.78, 0] },
      { geo: box(0.16, 1.55, d + 0.1), color: band, pos: [w / 2 - 0.08, 0.78, 0] },
    ]);
  });
}

export function counterGeometry(w: number): THREE.BufferGeometry {
  return cached(`counter|${w}`, () => {
    const parts: Part[] = [
      { geo: box(w, 0.8, 1.0), color: 0xffc21a, pos: [0, 0.4, 0] },
      { geo: box(w + 0.1, 0.14, 1.1), color: 0xffe27a, pos: [0, 0.85, 0] },
    ];
    for (let i = 0; i < 4; i++) parts.push({ geo: cyl(0.34, 0.34, 0.1, 14), color: i % 2 ? 0xffd23a : 0xffe98a, pos: [-0.7 + i * 0.47, 1.0 + (i % 2) * 0.1, 0] });
    return build(parts);
  });
}

/** Finish arch pillars + caps + banner posts as one mesh. */
export function finishGeometry(width: number, pillar: number, cap_: number): THREE.BufferGeometry {
  return build([
    { geo: box(0.7, 5, 0.7), color: pillar, pos: [-width / 2, 2.5, 0] },
    { geo: box(0.7, 5, 0.7), color: pillar, pos: [width / 2, 2.5, 0] },
    { geo: box(1, 0.4, 1), color: cap_, pos: [-width / 2, 5.1, 0] },
    { geo: box(1, 0.4, 1), color: cap_, pos: [width / 2, 5.1, 0] },
  ]);
}

// ------------------------------------------------------------ slimes and barrels

export function splitterGeometry(): THREE.BufferGeometry {
  const body = 0x5ad15a;
  const spot = 0x38a038;
  const eyeW = 0xffffff;
  const pupil = 0x1b2a1b;
  return build([
    { geo: new THREE.SphereGeometry(0.52, 7, 5), color: body, pos: [0, 0.56, 0], scale: [1, 0.88, 1] },
    { geo: sph(0.17), color: spot, pos: [0.28, 0.86, 0.15] },
    { geo: sph(0.13), color: spot, pos: [-0.32, 0.7, 0.2] },
    { geo: sph(0.11), color: spot, pos: [0.1, 1.0, 0.0] },
    { geo: sph(0.14), color: eyeW, pos: [-0.18, 0.7, -0.44], part: PART.head, pivot: [0, 0.6, 0] },
    { geo: sph(0.14), color: eyeW, pos: [0.18, 0.7, -0.44], part: PART.head, pivot: [0, 0.6, 0] },
    { geo: sph(0.065), color: pupil, pos: [-0.18, 0.69, -0.56], part: PART.head, pivot: [0, 0.6, 0] },
    { geo: sph(0.065), color: pupil, pos: [0.18, 0.69, -0.56], part: PART.head, pivot: [0, 0.6, 0] },
    { geo: box(0.3, 0.07, 0.06), color: pupil, pos: [0, 0.46, -0.5], part: PART.head, pivot: [0, 0.6, 0] },
    { geo: box(0.2, 0.18, 0.22), color: spot, pos: [-0.22, 0.09, 0], part: PART.legL, pivot: [-0.22, 0.18, 0] },
    { geo: box(0.2, 0.18, 0.22), color: spot, pos: [0.22, 0.09, 0], part: PART.legR, pivot: [0.22, 0.18, 0] },
  ]);
}

export function miniGeometry(): THREE.BufferGeometry {
  const body = 0x8cf08c;
  const spot = 0x58c458;
  return build([
    { geo: new THREE.SphereGeometry(0.22, 6, 4), color: body, pos: [0, 0.24, 0], scale: [1, 0.9, 1] },
    { geo: sph(0.06), color: 0xffffff, pos: [-0.08, 0.3, -0.19], part: PART.head, pivot: [0, 0.25, 0] },
    { geo: sph(0.06), color: 0xffffff, pos: [0.08, 0.3, -0.19], part: PART.head, pivot: [0, 0.25, 0] },
    { geo: box(0.07, 0.07, 0.07), color: spot, pos: [-0.09, 0.04, 0], part: PART.legL, pivot: [-0.09, 0.08, 0] },
    { geo: box(0.07, 0.07, 0.07), color: spot, pos: [0.09, 0.04, 0], part: PART.legR, pivot: [0.09, 0.08, 0] },
  ]);
}

export function barrelGeometry(): THREE.BufferGeometry {
  return cached('barrel', () =>
    build([
      { geo: cyl(0.4, 0.44, 1.0, 9), color: 0xc4372b, pos: [0, 0.5, 0] },
      { geo: cyl(0.46, 0.46, 0.12, 9), color: 0x3a2a2a, pos: [0, 0.18, 0] },
      { geo: cyl(0.46, 0.46, 0.12, 9), color: 0x3a2a2a, pos: [0, 0.82, 0] },
      { geo: cyl(0.415, 0.415, 0.2, 9), color: 0xffd23a, pos: [0, 0.5, 0] }, // hazard band
      { geo: box(0.1, 0.06, 0.1), color: 0x1b1b1b, pos: [0.05, 0.5, -0.43] },
      { geo: cyl(0.1, 0.1, 0.08, 6), color: 0x3a2a2a, pos: [0, 1.04, 0] },
      { geo: cone(0.06, 0.18, 5), color: 0xff7a1a, pos: [0, 1.17, 0] }, // fuse flame
    ]),
  );
}

// ------------------------------------------------------- far LODs for huge crowds
// ~24 triangles each: far away, a horde only needs the right colour and silhouette.

export function gruntFarGeometry(): THREE.BufferGeometry {
  return build([
    { geo: box(0.34, 0.5, 0.26), color: 0xd93636, pos: [0, 0.28, 0] },
    { geo: box(0.24, 0.22, 0.22), color: 0xa81f1f, pos: [0, 0.65, 0] },
  ]);
}

export function runnerFarGeometry(): THREE.BufferGeometry {
  return build([
    { geo: box(0.26, 0.4, 0.36), color: 0xff8a1f, pos: [0, 0.3, 0], rot: [-0.4, 0, 0] },
    { geo: box(0.2, 0.2, 0.2), color: 0xc9600a, pos: [0, 0.48, -0.2] },
  ]);
}

export function miniFarGeometry(): THREE.BufferGeometry {
  return build([{ geo: box(0.34, 0.3, 0.34), color: 0x7fe67f, pos: [0, 0.18, 0] }]);
}

export function splitterFarGeometry(): THREE.BufferGeometry {
  return build([{ geo: new THREE.SphereGeometry(0.55, 5, 3), color: 0x5ad15a, pos: [0, 0.5, 0] }]);
}

// ------------------------------------------------------------------ tracers

/**
 * A glowing streak: two crossed kites along Z, white-hot at the head (z = -0.5, the direction of travel)
 * fading to transparent at the tail. Scaled per weapon; the instance colour tints it.
 */
export function tracerGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const kite = (ax: 'x' | 'y') => {
    const base = pos.length / 3;
    const w = 0.5;
    const pts: [number, number, number][] = [
      [0, 0, -0.5], // head tip
      ax === 'x' ? [-w, 0, -0.18] : [0, -w, -0.18],
      [0, 0, 0.5], // tail tip
      ax === 'x' ? [w, 0, -0.18] : [0, w, -0.18],
    ];
    const colors: [number, number, number, number][] = [
      [1, 1, 1, 1],
      [1, 0.92, 0.7, 0.85],
      [1, 0.55, 0.15, 0],
      [1, 0.92, 0.7, 0.85],
    ];
    pts.forEach((p, i) => {
      pos.push(...p);
      col.push(...colors[i]);
    });
    idx.push(base, base + 1, base + 3, base + 1, base + 2, base + 3);
  };
  kite('x');
  kite('y');
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------- rubble and the reward mountain

/** A scatter of stones that piles up in front of a block as it takes damage (scaled by damage in props.ts). */
export function rubbleGeometry(w: number): THREE.BufferGeometry {
  return cached(`rubble|${w}`, () => {
    const parts: Part[] = [];
    let s = 12345;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const tones = [0x8b97a8, 0xa2adbd, 0x6f7b8c, 0xb7c1cf];
    const n = Math.round(10 + w * 2.5);
    for (let i = 0; i < n; i++) {
      const r = 0.12 + rnd() * 0.2;
      parts.push({
        geo: new THREE.DodecahedronGeometry(r, 0),
        color: tones[i % tones.length],
        pos: [(rnd() - 0.5) * (w + 0.8), r * 0.6, 0.5 + rnd() * 0.9],
        rot: [rnd() * 3, rnd() * 3, rnd() * 3],
        scale: [1, 0.75, 1],
      });
    }
    return build(parts);
  });
}

/**
 * The "reward mountain": a slanted roof of blue +N tiles (a few gold ones at the edge) that sits on top of
 * a giant jackpot block. Breaking the block releases it as the cascade of tiles. One merged mesh.
 */
export function rewardRoofGeometry(w: number): THREE.BufferGeometry {
  return cached(`roof|${w}`, () => {
    const parts: Part[] = [];
    const cols = Math.max(4, Math.floor(w / 0.62));
    const rows = 7;
    const tilt = 0.95; // leans back, like a ramp rising away from the camera
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * (w / cols);
        const gold = c >= cols - 2;
        parts.push({
          geo: box(w / cols - 0.07, 0.07, 0.34),
          color: gold ? 0xffc21a : r % 2 ? 0x2f7bff : 0x4a90ff,
          pos: [x, 1.95 + r * 0.36, -0.2 - r * 0.32],
          rot: [tilt, 0, 0],
        });
      }
    }
    // a thin grey slab under the tiles so the pile reads as one object
    parts.push({ geo: box(w + 0.2, 0.12, 2.6), color: 0x8c93a0, pos: [0, 2.0 + 1.1, -1.15], rot: [tilt, 0, 0] });
    return build(parts);
  });
}

// -------------------------------------------------------------- landmarks

export function obeliskGeometry(): THREE.BufferGeometry {
  return build([
    { geo: box(1.6, 0.5, 1.6), color: 0xb89a64, pos: [0, 0.25, 0] },
    { geo: box(1.1, 0.4, 1.1), color: 0xcdb27c, pos: [0, 0.7, 0] },
    { geo: new THREE.CylinderGeometry(0.34, 0.5, 4.2, 4), color: 0xd9c08a, pos: [0, 3.0, 0], rot: [0, Math.PI / 4, 0] } as unknown as Part,
    { geo: cone(0.4, 0.9, 4), color: 0xffd23a, pos: [0, 5.55, 0], rot: [0, Math.PI / 4, 0] },
  ]);
}

export function towerGeometry(): THREE.BufferGeometry {
  return build([
    { geo: cyl(0.9, 1.15, 3.2, 8), color: 0xbfe2f5, pos: [0, 1.6, 0] },
    { geo: cyl(1.15, 1.15, 0.3, 8), color: 0x7fb3d8, pos: [0, 3.35, 0] },
    { geo: cyl(0.8, 0.9, 1.4, 8), color: 0xd6eefa, pos: [0, 4.2, 0] },
    { geo: cone(1.05, 1.1, 8), color: 0x4a7fb0, pos: [0, 5.45, 0] },
    { geo: sph(0.22), color: 0xff8a3a, pos: [0, 6.2, 0] }, // warm lantern
    { geo: cyl(0.12, 0.12, 2.2, 6), color: 0xff8a3a, pos: [1.25, 2.4, 0.2] }, // pipe
  ]);
}

export function chimneyGeometry(): THREE.BufferGeometry {
  return build([
    { geo: cyl(1.0, 1.4, 4.5, 7), color: 0x3a2b36, pos: [0, 2.25, 0] },
    { geo: cyl(1.15, 1.0, 0.5, 7), color: 0x2a1b24, pos: [0, 4.7, 0] },
    { geo: cyl(0.85, 0.85, 0.2, 7), color: 0xff7a1a, pos: [0, 4.98, 0] }, // glowing rim
    { geo: box(2.4, 0.5, 2.4), color: 0x2f2029, pos: [0, 0.25, 0] },
  ]);
}

// ------------------------------------------------------------------- elite

/** The Warlord: an armoured hero with a horned helmet and a war hammer, bigger than a brute, with a gold trim. */
export function eliteGeometry(): THREE.BufferGeometry {
  const steel = 0x4b5568;
  const dark = 0x2d3442;
  const gold = 0xe0a820;
  const bone = 0xf3e6c8;
  return build([
    { geo: cap(0.42, 0.5), color: steel, pos: [0, 0.95, 0] },
    { geo: box(0.7, 0.55, 0.12), color: gold, pos: [0, 1.05, -0.38] }, // chest plate
    { geo: box(0.86, 0.14, 0.62), color: 0x3b1b12, pos: [0, 0.62, 0] }, // belt
    { geo: sph(0.3), color: dark, pos: [0, 1.72, -0.04], part: PART.head, pivot: [0, 1.45, 0] },
    { geo: box(0.4, 0.1, 0.1), color: 0xff4a2a, pos: [0, 1.74, -0.3], part: PART.head, pivot: [0, 1.45, 0] }, // glowing visor
    { geo: cone(0.1, 0.55), color: bone, pos: [-0.36, 2.0, -0.02], rot: [0, 0, 0.7], part: PART.head, pivot: [0, 1.45, 0] },
    { geo: cone(0.1, 0.55), color: bone, pos: [0.36, 2.0, -0.02], rot: [0, 0, -0.7], part: PART.head, pivot: [0, 1.45, 0] },
    { geo: sph(0.3), color: dark, pos: [-0.62, 1.35, 0] }, // pauldrons
    { geo: sph(0.3), color: dark, pos: [0.62, 1.35, 0] },
    { geo: cone(0.1, 0.34), color: bone, pos: [-0.66, 1.68, 0] },
    { geo: cone(0.1, 0.34), color: bone, pos: [0.66, 1.68, 0] },
    { geo: box(0.3, 0.66, 0.3), color: dark, pos: [-0.24, 0.3, 0], part: PART.legL, pivot: [-0.24, 0.62, 0] },
    { geo: box(0.3, 0.66, 0.3), color: dark, pos: [0.24, 0.3, 0], part: PART.legR, pivot: [0.24, 0.62, 0] },
    { geo: box(0.26, 0.7, 0.26), color: steel, pos: [-0.64, 0.98, -0.04], part: PART.armL, pivot: [-0.64, 1.3, 0] },
    { geo: box(0.26, 0.7, 0.26), color: steel, pos: [0.64, 0.98, -0.04], part: PART.armR, pivot: [0.64, 1.3, 0] },
    { geo: sph(0.2), color: gold, pos: [-0.64, 0.58, -0.04], part: PART.armL, pivot: [-0.64, 1.3, 0] },
    { geo: sph(0.2), color: gold, pos: [0.64, 0.58, -0.04], part: PART.armR, pivot: [0.64, 1.3, 0] },
    { geo: cyl(0.07, 0.07, 1.3), color: 0x5a3a22, pos: [0.7, 0.7, -0.34], rot: [-0.5, 0, 0], part: PART.armR, pivot: [0.64, 1.3, 0] }, // hammer handle
    { geo: box(0.55, 0.4, 0.4), color: 0x9aa3b2, pos: [0.7, 1.25, -0.72], part: PART.armR, pivot: [0.64, 1.3, 0] }, // hammer head
  ]);
}

// ------------------------------------------------------------------------ siege

/** The nest roof: a huge slanted deck of +N tiles that rises away from the camera towards the back wall. */
export function arenaRoofGeometry(w: number, rows = 15): THREE.BufferGeometry {
  return cached(`arenaRoof|${w}|${rows}`, () => {
    const parts: Part[] = [];
    const cols = Math.max(6, Math.floor(w / 0.62));
    const tilt = 0.78; // tiles lean the way the deck rises: away from the camera
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * (w / cols);
        const gold = c >= cols - 3 && r % 2 === 0;
        parts.push({
          geo: box(w / cols - 0.07, 0.07, 0.36),
          color: gold ? 0xffc21a : r % 2 ? 0x2f7bff : 0x4a90ff,
          pos: [x, 3.0 + r * 0.3, -r * 0.34],
          rot: [tilt, 0, 0],
        });
      }
    }
    parts.push({ geo: box(w + 0.4, 0.14, rows * 0.34 + 1), color: 0x7d8594, pos: [0, 3.0 + (rows * 0.3) / 2 - 0.2, -(rows * 0.34) / 2], rot: [tilt, 0, 0] });
    return build(parts);
  });
}

/** The keystone: a tall stone pillar with banded shaft and capital (the thing that holds the roof up). */
export function keystoneGeometry(w: number, h = 3.2): THREE.BufferGeometry {
  return cached(`keystone|${w}|${h}`, () =>
    build([
      { geo: box(w + 0.7, 0.55, 1.9), color: 0x7e8696, pos: [0, 0.28, 0] },
      { geo: box(w, h, 1.5), color: 0xa7afbd, pos: [0, h / 2 + 0.5, 0] },
      { geo: box(w + 0.18, 0.3, 1.64), color: 0x6c7484, pos: [0, 1.6, 0] },
      { geo: box(w + 0.18, 0.3, 1.64), color: 0x6c7484, pos: [0, h * 0.55, 0] },
      { geo: box(w + 0.8, 0.5, 2.0), color: 0xc4cbd8, pos: [0, h + 0.75, 0] },
    ]),
  );
}

/** A floor tile you collect by walking over it: blue slab with a white + (a gold one for the big pickups). */
export function tileGeometry(gold = false): THREE.BufferGeometry {
  return cached(`tile|${gold}`, () =>
    build([
      { geo: box(0.86, 0.1, 0.62), color: gold ? 0xffc21a : 0x2f7bff, pos: [0, 0.05, 0] },
      { geo: box(0.9, 0.06, 0.66), color: gold ? 0xb98200 : 0x1d4fb0, pos: [0, 0.02, 0] },
      { geo: box(0.46, 0.04, 0.1), color: 0xffffff, pos: [0, 0.12, 0] },
      { geo: box(0.1, 0.04, 0.34), color: 0xffffff, pos: [0, 0.12, 0] },
    ]),
  );
}


// ----------------------------------------------------------------------- jungle

export function palmGeometry(): THREE.BufferGeometry {
  const parts: Part[] = [{ geo: cyl(0.16, 0.26, 3.4, 6), color: 0x8a6a42, pos: [0.2, 1.7, 0], rot: [0, 0, -0.1] }];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    parts.push({ geo: box(0.32, 0.06, 1.8), color: i % 2 ? 0x2f9a4a : 0x3fb55a, pos: [0.4 + Math.sin(a) * 0.8, 3.45, Math.cos(a) * 0.8], rot: [-0.45, a, 0] });
  }
  parts.push({ geo: sph(0.2), color: 0x8a5a2a, pos: [0.4, 3.3, 0.1] });
  return build(parts);
}

export function bushGeometry(): THREE.BufferGeometry {
  return build([
    { geo: new THREE.IcosahedronGeometry(0.7, 0), color: 0x2f8f3f, pos: [0, 0.5, 0], scale: [1.3, 0.8, 1.1] },
    { geo: new THREE.IcosahedronGeometry(0.5, 0), color: 0x3fae52, pos: [0.6, 0.45, 0.3] },
    { geo: new THREE.IcosahedronGeometry(0.45, 0), color: 0x267a36, pos: [-0.6, 0.4, -0.2] },
    { geo: sph(0.1), color: 0xff6a8a, pos: [0.2, 0.95, 0.4] }, // a flower
  ]);
}

export function ruinPillarGeometry(): THREE.BufferGeometry {
  return build([
    { geo: box(1.5, 0.5, 1.5), color: 0x8c9a7a, pos: [0, 0.25, 0] },
    { geo: cyl(0.55, 0.62, 3.2, 8), color: 0xa7b592, pos: [0, 2.1, 0] },
    { geo: box(1.3, 0.35, 1.3), color: 0x8c9a7a, pos: [0, 3.9, 0] },
    { geo: box(0.1, 1.6, 0.1), color: 0x3f9a4a, pos: [0.5, 2.3, -0.55] }, // a vine
    { geo: sph(0.5), color: 0x4a8a3c, pos: [-0.3, 3.9, 0.3], scale: [1.2, 0.5, 1] },
  ]);
}

export function templeGeometry(): THREE.BufferGeometry {
  const parts: Part[] = [];
  for (let i = 0; i < 4; i++) parts.push({ geo: box(6 - i * 1.2, 0.9, 6 - i * 1.2), color: i % 2 ? 0x9aa886 : 0xb0bd9a, pos: [0, 0.45 + i * 0.9, 0] });
  parts.push({ geo: box(1.6, 1.5, 1.6), color: 0x8c9a7a, pos: [0, 4.35, 0] });
  parts.push({ geo: cone(1.3, 1.1, 4), color: 0x4a8a3c, pos: [0, 5.6, 0], rot: [0, Math.PI / 4, 0] });
  parts.push({ geo: box(0.9, 1.1, 0.12), color: 0x25382a, pos: [0, 0.6, -3.0] }); // a dark doorway
  return build(parts);
}

export function mossRockGeometry(): THREE.BufferGeometry {
  return build([
    { geo: new THREE.DodecahedronGeometry(0.7, 0), color: 0x7f8a76, pos: [0, 0.3, 0], scale: [1.3, 0.8, 1] },
    { geo: new THREE.DodecahedronGeometry(0.5, 0), color: 0x4a8a3c, pos: [0, 0.55, 0], scale: [1.2, 0.45, 0.9] },
  ]);
}

/** Bulwark: a grunt-sized body behind a huge steel tower shield. Rifles and shotguns barely scratch it. */
export function bulwarkGeometry(): THREE.BufferGeometry {
  const steel = 0x8d99ab;
  const dark = 0x3d4656;
  const gold = 0xe0a820;
  return build([
    { geo: cap(0.2, 0.2), color: 0x6a4a3a, pos: [0, 0.32, 0.1] },
    { geo: sph(0.17), color: dark, pos: [0, 0.68, 0.06], part: PART.head, pivot: [0, 0.55, 0] },
    { geo: sph(0.04), color: 0xffee55, pos: [-0.07, 0.7, -0.1], part: PART.head, pivot: [0, 0.55, 0] },
    { geo: sph(0.04), color: 0xffee55, pos: [0.07, 0.7, -0.1], part: PART.head, pivot: [0, 0.55, 0] },
    { geo: box(0.1, 0.22, 0.12), color: dark, pos: [-0.09, 0.11, 0.1], part: PART.legL, pivot: [-0.09, 0.22, 0.1] },
    { geo: box(0.1, 0.22, 0.12), color: dark, pos: [0.09, 0.11, 0.1], part: PART.legR, pivot: [0.09, 0.22, 0.1] },
    { geo: box(1.0, 1.05, 0.14), color: steel, pos: [0, 0.55, -0.22] }, // the shield
    { geo: box(1.06, 0.1, 0.18), color: gold, pos: [0, 1.06, -0.22] },
    { geo: box(1.06, 0.1, 0.18), color: gold, pos: [0, 0.04, -0.22] },
    { geo: box(0.1, 1.05, 0.18), color: gold, pos: [-0.5, 0.55, -0.22] },
    { geo: box(0.1, 1.05, 0.18), color: gold, pos: [0.5, 0.55, -0.22] },
    { geo: new THREE.OctahedronGeometry(0.16, 0), color: 0xff4a2a, pos: [0, 0.58, -0.32] }, // emblem
  ]);
}
