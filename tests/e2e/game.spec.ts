import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => { throw e; });
  page.on('console', (m) => { if (m.type() === 'error') throw new Error(m.text()); });
});

test('loads, starts and the squad advances', async ({ page }) => {
  await page.goto('/?level=1&seed=1');
  await page.waitForFunction(() => (window as any).__game);
  await page.getByRole('button', { name: /Play level/ }).click();
  await page.waitForTimeout(600);
  const s = await page.evaluate(() => (window as any).__game.getState());
  expect(s.squad.y).toBeGreaterThan(0);
  expect(s.phase).toBe('playing');
});

test('drag input moves the squad sideways', async ({ page }) => {
  await page.goto('/?level=1&seed=1&autostart=1');
  await page.waitForFunction(() => (window as any).__game);
  const box = (await page.locator('#stage').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.8, { steps: 8 });
  await page.waitForTimeout(500);
  await page.mouse.up();
  const s = await page.evaluate(() => (window as any).__game.getState());
  expect(s.squad.x).toBeGreaterThan(0.5);
});

test('keyboard steers', async ({ page }) => {
  await page.goto('/?level=1&seed=1&autostart=1');
  await page.waitForFunction(() => (window as any).__game);
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowLeft');
  const s = await page.evaluate(() => (window as any).__game.getState());
  expect(s.squad.x).toBeLessThan(-0.5);
});

test('perf proxy: draw calls stay under budget with 300+ enemies', async ({ page }) => {
  await page.goto('/?level=1&seed=1');
  await page.waitForFunction(() => (window as any).__game);
  await page.evaluate(() => { const g = (window as any).__game; g.start(); g.pause(); g.stress(320); g.step(30); });
  const st = await page.evaluate(() => (window as any).__game.stats());
  console.log('stress stats', st);
  expect(st.enemies).toBeGreaterThanOrEqual(300);
  expect(st.drawCalls).toBeLessThan(60);
  await page.screenshot({ path: 'screenshots/stress.png' });
});

test('a bot can clear level 1: win screen, stars and persistent save', async ({ page }) => {
  await page.goto('/?level=1&seed=1&autoplay=balanced&autostart=1&speed=8');
  await page.waitForFunction(() => (window as any).__game);
  await expect(page.locator('#end')).toHaveClass(/show/, { timeout: 50_000 });
  await expect(page.locator('#endTitle')).toHaveText('VICTORY!');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('squadrush.save')!));
  expect(save.version).toBe(1);
  expect(save.unlockedLevel).toBe(2);
  expect(save.coins).toBeGreaterThan(0);
  expect(save.stars['1']).toBeGreaterThanOrEqual(1);
  await page.screenshot({ path: 'screenshots/e2e-win.png' });
});
