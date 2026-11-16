// Screenshots of the install sheet (iOS wording) and the HUD with a simulated 59px notch.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
const server = await createServer({ server: { port: 5191 }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
await page.goto('http://localhost:5191/?seed=1');
await page.waitForFunction(() => window.__game);
await page.evaluate(() => document.documentElement.style.setProperty('--sat', '59px'));
await page.waitForSelector('#install.show', { timeout: 8000 });
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/pwa-install-ios.png' });
await page.locator('#installLater').click();
await page.evaluate(() => { window.__game.start(); });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'screenshots/pwa-notch-hud.png' });
await browser.close(); await server.close();
