// Spawns a boss next to a 90-strong squad in each world and screenshots it (visual check of boss models).
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
const server = await createServer({ server: { port: 5194 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
for (let theme = 0; theme < 4; theme++) {
  await page.goto(`http://localhost:5194/?level=1&seed=1&theme=${theme}`);
  await page.waitForFunction(() => window.__game);
  await page.evaluate(() => {
    const api = window.__game;
    api.start(); api.pause();
    const g = api.raw();
    g.squad.count = 90;
    g.debugSpawn('boss', 1, 11);
    api.step(50);
  });
  await page.screenshot({ path: `screenshots/boss-th${theme}.png` });
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close(); await server.close();
