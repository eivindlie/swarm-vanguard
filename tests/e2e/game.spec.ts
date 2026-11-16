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

test('perf proxy: a 2000-strong horde vs 300 soldiers stays inside the draw-call and triangle budget', async ({ page }) => {
  await page.goto('/?level=1&seed=1');
  await page.waitForFunction(() => (window as any).__game);
  await page.evaluate(() => { const g = (window as any).__game; g.start(); g.pause(); g.stress(2000); g.step(30); });
  const st = await page.evaluate(() => (window as any).__game.stats());
  console.log('stress stats', st);
  expect(st.enemies).toBeGreaterThanOrEqual(1900); // nothing silently dropped past instance capacity
  expect(st.soldiers).toBeGreaterThanOrEqual(300);
  // budgets for the animated, outlined, themed scene (headless FPS says nothing about phones)
  expect(st.drawCalls).toBeLessThan(90);
  expect(st.triangles).toBeLessThan(330_000);
  expect(st.lodDistance).toBeLessThan(40); // the LOD kicked in
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
  test.setTimeout(120_000);
  await page.goto('/?level=1&seed=1');
  await page.waitForFunction(() => (window as any).__game);
  const res = await page.evaluate(() => {
    const api = (window as any).__game;
    api.start();
    api.pause();
    const out: string[] = [];
    // pairs known to collide entity ids between the old and the new game (found by scanning all 90 pairs;
    // rebuilding a whole world per restart makes an exhaustive scan too slow for a routine test)
    const pairs: [number, number][] = [[1, 4], [1, 8], [2, 6], [2, 10], [4, 1], [8, 1], [6, 2], [10, 2], [3, 7], [5, 9], [9, 3], [7, 5]];
    for (const [from, to] of pairs) {
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

test('shop: buying an upgrade spends coins, persists and applies at the next start', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('swarmvanguard.save')) {
      localStorage.setItem('swarmvanguard.save', JSON.stringify({ version: 1, unlockedLevel: 3, coins: 500, stars: {}, upgrades: {} }));
    }
  });
  await page.goto('/?seed=1');
  await page.waitForFunction(() => (window as any).__game);
  await page.getByRole('button', { name: 'Upgrades' }).click();
  await page.locator('#shopRows .row').first().locator('button').click(); // squad size level 1 costs 40
  await expect(page.locator('#shopCoins')).toHaveText('Coins: 460');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: /Play level/ }).click();
  const state = await page.evaluate(() => (window as any).__game.getState());
  expect(state.squad.count).toBe(6); // base 5 + 1
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('swarmvanguard.save')!));
  expect(save.upgrades.size).toBe(1);
  expect(save.coins).toBe(460);
});

test('upgrade gates, barrels and splitters are on screen without errors', async ({ page }) => {
  await page.goto('/?level=12&seed=1&autoplay=balanced&autostart=1&speed=6');
  await page.waitForFunction(() => (window as any).__game);
  await page.waitForTimeout(4000);
  const st = await page.evaluate(() => (window as any).__game.stats());
  expect(st.drawCalls).toBeGreaterThan(5);
});

test('level select shows one bonus level after each world', async ({ page }) => {
  await page.goto('/?seed=1');
  await page.waitForFunction(() => (window as any).__game);
  await expect(page.locator('#levels .lv.bonus')).toHaveCount(4);
  await expect(page.locator('#levels .lvh')).toHaveCount(4);
});

test('a bot clears the Jackpot Vault bonus level and gets the bonus payout', async ({ page }) => {
  await page.goto('/?level=101&seed=1&autoplay=balanced&autostart=1&speed=8');
  await page.waitForFunction(() => (window as any).__game);
  await expect(page.locator('#end')).toHaveClass(/show/, { timeout: 50_000 });
  await expect(page.locator('#endTitle')).toHaveText('BONUS CLEAR!');
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('swarmvanguard.save')!));
  // 60 base + 3 stars (+10) + first clear (+60) + 0.6 per survivor (~300) => well above a normal level
  expect(save.coins).toBeGreaterThan(250);
});
