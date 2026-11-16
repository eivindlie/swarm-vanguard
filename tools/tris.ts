import type * as THREE from 'three';
import * as M from '../src/render/models';
const n = (g: THREE.BufferGeometry) => g.attributes.position.count / 3;
console.log('soldier', n(M.soldierGeometry()), 'grunt', n(M.gruntGeometry()), 'runner', n(M.runnerGeometry()), 'brute', n(M.bruteGeometry()));
for (const v of ['golem', 'ogre', 'frost', 'demon'] as const) console.log('boss', v, n(M.bossGeometry(v)));
