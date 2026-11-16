// Runs after `vite build`: stamps dist/sw.js with a build id so every deploy gets its own cache
// (the worker deletes older "swarm-vanguard-*" caches when it activates).
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../dist/sw.js', import.meta.url);
const src = readFileSync(file, 'utf8');
if (!src.includes('__BUILD_ID__')) throw new Error('dist/sw.js has no __BUILD_ID__ placeholder');
const id = Date.now().toString(36);
writeFileSync(file, src.replaceAll('__BUILD_ID__', id));
console.log(`service worker stamped: swarm-vanguard-${id}`);
