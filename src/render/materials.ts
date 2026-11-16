import * as THREE from 'three';

// Shared clock for all animated materials (one uniform object, updated once per frame).
export const uTime = { value: 0 };

/** Soft 4-step toon ramp. Nearest filtering gives the hard cel bands. */
function makeRamp(): THREE.DataTexture {
  const data = new Uint8Array([120, 120, 120, 255, 175, 175, 175, 255, 225, 225, 225, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}
const ramp = makeRamp();

// Per-vertex body-part ids (set by models.ts):
//   0 body/static, 1 left leg, 2 right leg, 3 left arm, 4 right arm, 5 head
// Per-instance: aAnim.x = phase, aAnim.y = run rate (0 = idle), aFlash = hit flash 0..1
const ANIM_VERTEX_PARS = /* glsl */ `
attribute float aPart;
attribute vec3 aPivot;
attribute vec2 aAnim;
attribute float aFlash;
uniform float uTime;
varying float vFlash;
`;

const ANIM_VERTEX_BODY = /* glsl */ `
vFlash = aFlash;
float run = step(0.01, aAnim.y);
float ph = uTime * 11.0 * aAnim.y + aAnim.x;
float sw = sin(ph);
float ang = 0.0;
if (aPart > 0.5) {
  if (aPart < 1.5) ang = sw * 0.75;
  else if (aPart < 2.5) ang = -sw * 0.75;
  else if (aPart < 3.5) ang = -sw * 0.65;
  else if (aPart < 4.5) ang = sw * 0.65;
}
ang *= run;
vec3 pp = transformed - aPivot;
float ca = cos(ang);
float sa = sin(ang);
pp = vec3(pp.x, pp.y * ca - pp.z * sa, pp.y * sa + pp.z * ca);
transformed = pp + aPivot;
transformed.y += (abs(sin(ph)) * 0.075 + 0.0) * run;
if (aPart > 4.5) transformed.y += sin(ph * 2.0) * 0.012 * run;
`;

export interface AnimOptions {
  /** Extrude along normals by this much (inverted-hull outline). 0 = off. */
  outline?: number;
}

function inject(shader: THREE.WebGLProgramParametersWithUniforms, opts: AnimOptions, rim: boolean) {
  shader.uniforms.uTime = uTime;
  shader.vertexShader = shader.vertexShader
    .replace('void main() {', `${ANIM_VERTEX_PARS}\nvoid main() {`)
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\n${ANIM_VERTEX_BODY}${opts.outline ? `\ntransformed += normalize(normal) * ${opts.outline.toFixed(3)};` : ''}`,
    );
  if (rim) {
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'varying float vFlash;\nvoid main() {')
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        float rimT = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.4);
        outgoingLight += rimT * 0.22;
        outgoingLight = mix(outgoingLight, vec3(1.0), clamp(vFlash, 0.0, 1.0) * 0.8);
        #include <opaque_fragment>`,
      );
  } else {
    shader.fragmentShader = shader.fragmentShader.replace('void main() {', 'varying float vFlash;\nvoid main() {');
  }
}

/** Toon-shaded, vertex-coloured, GPU-animated material for crowd units. */
export function animToonMaterial(): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
  m.onBeforeCompile = (s) => inject(s, {}, true);
  m.customProgramCacheKey = () => 'anim-toon';
  return m;
}

/** Black back-face hull following the same animation: cheap outline for big units. */
export function animOutlineMaterial(thickness = 0.05): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color: 0x14101c, side: THREE.BackSide });
  m.onBeforeCompile = (s) => inject(s, { outline: thickness }, false);
  m.customProgramCacheKey = () => `anim-outline-${thickness}`;
  return m;
}

/** Static toon material for props (no animation, vertex colours). */
export function propMaterial(): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
}

export function toonColor(color: number): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: ramp });
}

/** Per-instance attributes used by the animated materials. */
export interface AnimAttrs {
  anim: THREE.InstancedBufferAttribute;
  flash: THREE.InstancedBufferAttribute;
}

export function addAnimAttrs(mesh: THREE.InstancedMesh, max: number): AnimAttrs {
  const anim = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2);
  const flash = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
  anim.setUsage(THREE.DynamicDrawUsage);
  flash.setUsage(THREE.DynamicDrawUsage);
  mesh.geometry.setAttribute('aAnim', anim);
  mesh.geometry.setAttribute('aFlash', flash);
  return { anim, flash };
}
