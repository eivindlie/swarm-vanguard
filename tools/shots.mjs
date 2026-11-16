// Usage: node tools/shots.mjs [level] [seed] [ticks,ticks,...] [x | policyName] [theme 0-3] [dpr]
// Starts a vite dev server, opens the game at phone-portrait size, steps the sim
// deterministically through __game and writes screenshots to ./screenshots.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const level = process.argv[2] ?? '1';
const seed = process.argv[3] ?? '1';
const ticks = (process.argv[4] ?? '1,200,500,900').split(',').map(Number);
const arg5 = process.argv[5] ?? '0';
const bot = Number.isNaN(Number(arg5)) ? arg5 : null; // policy name => autoplay
const inputX = bot ? 0 : Number(arg5);
const theme = process.argv[6];
const dpr = Number(process.argv[7] ?? 1);

const server = await createServer({ server: { port: 5199 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:5199/?level=${level}&seed=${seed}${bot ? `&autoplay=${bot}` : ''}${theme !== undefined ? `&theme=${theme}` : ''}`);
await page.waitForFunction(() => window.__game);
await page.evaluate(() => { window.__game.start(); window.__game.pause(); });
await page.evaluate((x) => window.__game.setInput(x), inputX);
let done = 0;
for (const t of ticks) {
  const state = await page.evaluate((n) => window.__game.step(n), t - done);
  done = t;
  await page.screenshot({ path: `screenshots/L${level}-t${t}${theme !== undefined ? `-th${theme}` : ''}.png` });
  console.log(`t=${t}`, JSON.stringify(state), JSON.stringify(await page.evaluate(() => window.__game.stats())));
}
console.log('console errors:', errors.length ? errors : 'none');
await browser.close();
await server.close();
