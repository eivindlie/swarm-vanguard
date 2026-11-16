// Runs after `vite build`: stamps dist/sw.js with (1) a build id, so every deploy gets its own cache (the worker
// deletes older "swarm-vanguard-*" caches when it activates) and (2) the list of every file in dist/assets, which the
// worker precaches on install so the whole build is available offline right away.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const file = new URL('sw.js', dist);
const src = readFileSync(file, 'utf8');
if (!src.includes('__BUILD_ID__') || !src.includes('__ASSET_LIST__')) throw new Error('dist/sw.js is missing its placeholders');
const assets = readdirSync(new URL('assets/', dist)).map((f) => `./assets/${f}`);
const id = Date.now().toString(36);
writeFileSync(file, src.replaceAll('__BUILD_ID__', id).replaceAll('__ASSET_LIST__', JSON.stringify(assets)));
console.log(`service worker stamped: swarm-vanguard-${id}, precaching ${assets.length} asset file(s)`);
