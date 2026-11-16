// Production check of the PWA: serve the built dist/ under a sub-path, make sure the service worker takes
// control, then go OFFLINE and reload: the game must still start. Usage: npm run build && node tools/pwa-check.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/swarm-vanguard/, '');
  let p = path.join(root, rel);
  if (p.endsWith('/') || rel === '') p = path.join(root, rel, 'index.html');
  fs.readFile(p, (e, d) => (e ? (res.writeHead(404), res.end()) : (res.writeHead(200, { 'content-type': types[path.extname(p)] ?? 'application/octet-stream' }), res.end(d))));
}).listen(5190);

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const url = 'http://localhost:5190/swarm-vanguard/';
await page.goto(url);
await page.waitForFunction(() => window.__game);
const reg = await page.evaluate(async () => {
  const r = await navigator.serviceWorker.ready;
  return { scope: r.scope, active: !!r.active };
});
console.log('service worker:', JSON.stringify(reg));
await page.reload(); // now controlled by the worker; this also fills the runtime cache
await page.waitForFunction(() => window.__game);
const caches = await page.evaluate(async () => (await window.caches.keys()));
const cached = await page.evaluate(async () => (await (await window.caches.open((await window.caches.keys())[0])).keys()).map((r) => new URL(r.url).pathname));
console.log('caches:', JSON.stringify(caches), 'entries:', cached.length);
await ctx.setOffline(true);
await page.reload();
await page.waitForFunction(() => window.__game, null, { timeout: 15000 });
await page.evaluate(() => { window.__game.start(); });
await page.waitForTimeout(800);
const st = await page.evaluate(() => window.__game.getState());
console.log('OFFLINE start ok, squad y =', st.squad.y);
const manifestOk = await page.evaluate(async () => (await fetch('./manifest.webmanifest')).ok);
console.log('manifest offline:', manifestOk, '| errors:', errors.length ? errors : 'none');
await browser.close(); srv.close();
