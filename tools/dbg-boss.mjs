import { createServer } from 'vite';
import { chromium } from '@playwright/test';
const server = await createServer({ server: { port: 5193 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://localhost:5193/?level=1&seed=1&theme=0');
await page.waitForFunction(() => window.__game);
const out = await page.evaluate(() => {
  const api = window.__game; api.start(); api.pause();
  const g = api.raw(); g.squad.count = 90; g.debugSpawn('boss', 1, 11); api.step(50);
  const crowd = api.renderer().crowd;
  const b = crowd.enemies.boss;
  const geo = b.mesh.geometry;
  const col = geo.getAttribute('color');
  return {
    count: b.mesh.count,
    flash: Array.from(b.attrs.flash.array),
    anim: Array.from(b.attrs.anim.array),
    attrs: Object.keys(geo.attributes),
    firstColors: Array.from(col.array.slice(0, 6)),
    verts: col.count,
    sameGeoAsOutline: b.outline.geometry === geo,
  };
});
console.log(JSON.stringify(out));
await browser.close(); await server.close();
