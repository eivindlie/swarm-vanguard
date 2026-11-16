// CPU cost of updating every crowd instance per frame (no GPU involved) at the peak of the swarm level.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
const server = await createServer({ server: { port: 5192 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://localhost:5192/?level=104&seed=1&autoplay=balanced');
await page.waitForFunction(() => window.__game);
const out = await page.evaluate(() => {
  const api = window.__game;
  api.start(); api.pause();
  let peak = 0;
  for (let i = 0; i < 400; i++) { api.step(10); peak = Math.max(peak, api.raw().enemies.length); if (api.raw().enemies.length > 1800) break; }
  const r = api.renderer();
  const g = api.raw();
  const t0 = performance.now();
  for (let i = 0; i < 100; i++) r.crowd.draw(g, 1 / 60, r.camera);
  const crowd = (performance.now() - t0) / 100;
  const t1 = performance.now();
  for (let i = 0; i < 100; i++) r.fxEvents(g);
  return { enemies: g.enemies.length, crowdDrawMs: +crowd.toFixed(2) };
});
console.log(JSON.stringify(out), '(CPU-side per-instance update only; GPU time is not measurable here)');
await browser.close(); await server.close();
