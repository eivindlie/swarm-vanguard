// Screenshots of the start menu and end screens (win/lose) at phone-portrait size.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
const server = await createServer({ server: { port: 5196 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => localStorage.setItem('swarmvanguard.save', JSON.stringify({ version: 1, unlockedLevel: 9, coins: 260, stars: { 1: 3, 2: 3, 3: 2, 4: 3, 5: 1, 6: 2, 7: 3, 8: 2 }, upgrades: { size: 2, damage: 1 } })));
await page.goto('http://localhost:5196/');
await page.waitForFunction(() => window.__game);
await page.screenshot({ path: 'screenshots/menu.png' });
await page.getByRole('button', { name: 'Upgrades' }).click();
await page.screenshot({ path: 'screenshots/shop.png' });
await page.getByRole('button', { name: 'Back' }).click();
// force a win: run the naive sim to the end through the debug API
await page.evaluate(() => { window.__game.start(); window.__game.pause(); window.__game.setInput(0); });
await page.evaluate(() => { const g = window.__game.raw(); g.squad.count = 250; g.squad.maxCount = 250; });
await page.evaluate(() => window.__game.step(4000));
await page.evaluate(() => window.__game.resume());
await page.waitForTimeout(800);
await page.screenshot({ path: 'screenshots/end.png' });
console.log(JSON.stringify(await page.evaluate(() => window.__game.getState())), 'errors:', errors.length ? errors : 'none');
await browser.close(); await server.close();
