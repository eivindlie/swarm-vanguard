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
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('swarmvanguard.save')!));
  expect(save.version).toBe(1);
  expect(save.unlockedLevel).toBe(2);
  expect(save.coins).toBeGreaterThan(0);
  expect(save.stars['1']).toBeGreaterThanOrEqual(1);
  await page.screenshot({ path: 'screenshots/e2e-win.png' });
});

test('switching level leaves no stale block/gate/counter views behind', async ({ page }) => {
  await page.goto('/?level=1&seed=1');
  await page.waitForFunction(() => (window as any).__game);
  const res = await page.evaluate(() => {
    const api = (window as any).__game;
    api.start();
    api.pause();
    const out: string[] = [];
    // every ordered pair of levels: guarantees some entity ids collide between the old and the new game
    for (let from = 1; from <= 10; from++) {
      for (let to = 1; to <= 10; to++) {
        if (from === to) continue;
        api.restart(from, 1);
        api.step(250);
        api.restart(to, 1);
        api.step(1);
        const g = api.raw();
        const v = api.stats().views;
        const bad = api.viewMismatches();
        if (bad > 0 || v.blocks !== g.blocks.length || v.gates !== g.gates.length || v.counters !== g.counters.length) {
          out.push(`${from}->${to}: ${bad} views at the wrong place; views ${JSON.stringify(v)}`);
        }
      }
    }
    return out;
  });
  expect(res).toEqual([]);
});

test('drag target never exceeds what the squad can reach (no dead zone)', async ({ page }) => {
  await page.goto('/?level=1&seed=1&autostart=1');
  await page.waitForFunction(() => (window as any).__game);
  await page.evaluate(() => { const g = (window as any).__game.raw(); g.squad.count = 250; });
  const box = (await page.locator('#stage').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width, box.y + box.height * 0.8, { steps: 6 });
  await page.waitForTimeout(300);
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.8, { steps: 6 });
  await page.waitForTimeout(500);
  await page.mouse.up();
  const x = await page.evaluate(() => (window as any).__game.getState().squad.x);
  // after dragging back left the squad must already be left of centre: no hidden overshoot to unwind
  expect(x).toBeLessThan(0.5);
});
