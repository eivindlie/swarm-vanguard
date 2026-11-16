// What a brand-new player sees at the start of level 1: fresh storage, no autoplay, a few moments in.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
const server = await createServer({ server: { port: 5189 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('http://localhost:5189/?level=1&seed=1');
await page.waitForFunction(() => window.__game);
await page.locator('#startBtn').click();
for (const ms of [900, 3500]) {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: `screenshots/first-minute-${ms}.png` });
  console.log(ms, 'tip visible:', await page.evaluate(() => document.getElementById('tip').classList.contains('show')), 'hint visible:', await page.evaluate(() => document.getElementById('hint').classList.contains('show')), JSON.stringify(await page.evaluate(() => window.__game.getState().squad)));
}
await browser.close(); await server.close();
