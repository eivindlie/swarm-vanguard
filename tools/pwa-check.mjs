// Production check of the PWA: serve the built dist/ under a sub-path and prove that the game starts OFFLINE in
// the two situations that matter on a phone:
//   1. FIRST INSTALL: load once, wait for the service worker, go offline immediately (no extra reload), reload.
//   2. UPDATE: load build A twice, deploy build B, load once, go offline, reload (the new build must be complete,
//      the old cache must be gone).
// Build B is build A with the JS bundle renamed (new hash) and a new cache id, which is what a real redeploy changes.
// Usage: npm run build && node tools/pwa-check.mjs
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const dirA = path.resolve('dist');
const dirB = fs.mkdtempSync(path.join(os.tmpdir(), 'pwa-build-b-'));
fs.cpSync(dirA, dirB, { recursive: true });
const assetsB = path.join(dirB, 'assets');
const js = fs.readdirSync(assetsB).find((f) => f.endsWith('.js'));
const jsB = 'index-BBBBBBBB.js';
fs.renameSync(path.join(assetsB, js), path.join(assetsB, jsB));
fs.writeFileSync(path.join(dirB, 'index.html'), fs.readFileSync(path.join(dirB, 'index.html'), 'utf8').replaceAll(js, jsB));
const swA = fs.readFileSync(path.join(dirA, 'sw.js'), 'utf8');
const idA = swA.match(/swarm-vanguard-([a-z0-9]+)'/)[1];
fs.writeFileSync(path.join(dirB, 'sw.js'), swA.replaceAll(js, jsB).replaceAll(idA, 'buildb'));

let root = dirA;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const srv = http
  .createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/swarm-vanguard/, '');
    let p = path.join(root, rel);
    if (p.endsWith('/') || rel === '') p = path.join(root, rel, 'index.html');
    fs.readFile(p, (e, d) => (e ? (res.writeHead(404), res.end()) : (res.writeHead(200, { 'content-type': types[path.extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-cache' }), res.end(d))));
  })
  .listen(5190);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const url = 'http://localhost:5190/swarm-vanguard/';
let failed = false;
const check = (ok, msg) => {
  console.log(ok ? 'PASS' : 'FAIL', msg);
  if (!ok) failed = true;
};

async function playsOffline(page, label) {
  await page.waitForFunction(() => window.__game, null, { timeout: 15000 });
  await page.evaluate(() => window.__game.start());
  await page.waitForTimeout(600);
  const y = await page.evaluate(() => window.__game.getState().squad.y);
  check(y > 0, `${label}: the game starts and runs offline (squad y = ${y.toFixed(2)})`);
}

// ---------------------------------------------------------------- 1. first install
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.waitForFunction(() => window.__game);
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  check(scope.endsWith('/swarm-vanguard/'), `first install: worker active under ${scope}`);
  await ctx.setOffline(true); // right away: no second visit to fill the cache
  await page.reload();
  await playsOffline(page, 'first install');
  check(errors.length === 0, `first install: no page errors (${errors.join('; ') || 'none'})`);
  await ctx.close();
}

// -------------------------------------------------------------------- 2. update
{
  root = dirA;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForFunction(() => window.__game);
  await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  await page.reload();
  await page.waitForFunction(() => window.__game);
  const before = await page.evaluate(async () => await window.caches.keys());
  check(before.some((k) => k.includes(idA)), `update: build A cache present (${before.join(', ')})`);

  root = dirB; // "deploy" build B
  await page.reload(); // online: the page gets B's index, the browser notices the new worker
  await page.waitForFunction(() => window.__game);
  // poll from node (an async predicate inside waitForFunction is easy to get wrong)
  let after = [];
  for (let i = 0; i < 60; i++) {
    after = await page.evaluate(async () => await window.caches.keys());
    if (after.length === 1 && after[0].includes('buildb')) break;
    await page.waitForTimeout(250);
  }
  check(after.length === 1 && after[0].includes('buildb'), `update: only the new cache remains (${after.join(', ')})`);
  const cached = await page.evaluate(async () => (await (await window.caches.open((await window.caches.keys())[0])).keys()).map((r) => new URL(r.url).pathname));
  check(cached.some((p) => p.endsWith(jsB)), `update: the new bundle is precached (${cached.length} entries)`);

  await ctx.setOffline(true);
  await page.reload();
  await playsOffline(page, 'after update');
  const scriptSrc = await page.evaluate(() => [...document.scripts].map((s) => s.src).join(' '));
  check(scriptSrc.includes(jsB), `update: the offline page runs build B (${scriptSrc.split('/').pop()})`);
  await ctx.close();
}

await browser.close();
srv.close();
fs.rmSync(dirB, { recursive: true, force: true });
console.log(failed ? '\nPWA CHECK FAILED' : '\nPWA check passed');
process.exit(failed ? 1 : 0);
