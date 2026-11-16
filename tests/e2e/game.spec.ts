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

test('tapping a level in the menu starts that level directly', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('swarmvanguard.save')) {
      localStorage.setItem('swarmvanguard.save', JSON.stringify({ version: 1, unlockedLevel: 6, coins: 0, stars: {}, upgrades: {} }));
    }
  });
  await page.goto('/?seed=1');
  await page.waitForFunction(() => (window as any).__game);
  await page.locator('#levels .lv', { hasText: /^3/ }).click();
  await expect(page.locator('#start')).not.toHaveClass(/show/);
  await expect(page.locator('#lvl')).toHaveText('LEVEL 3');
  await page.waitForTimeout(400);
  const s = await page.evaluate(() => (window as any).__game.getState());
  expect(s.squad.y).toBeGreaterThan(0);
});

test('the menu can scroll on touch and the play button is above the level grid, even on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('/?seed=1');
  await page.waitForFunction(() => (window as any).__game);
  const btn = await page.locator('#startBtn').boundingBox();
  const grid = await page.locator('#levels').boundingBox();
  expect(btn!.y).toBeLessThan(grid!.y);
  expect(btn!.y + btn!.height).toBeLessThan(640); // visible without scrolling on a small phone
  const touch = await page.evaluate(() => getComputedStyle(document.getElementById('start')!).touchAction);
  expect(touch).toBe('pan-y');
});

test('the HUD and menu respect the iPhone notch (safe-area inset)', async ({ page }) => {
  await page.goto('/?seed=1&autostart=1');
  await page.waitForFunction(() => (window as any).__game);
  // env(safe-area-inset-top) cannot be emulated, so the layout reads it through --sat and we override that
  await page.evaluate(() => document.documentElement.style.setProperty('--sat', '59px'));
  const top = await page.locator('#top').boundingBox();
  expect(top!.y).toBeGreaterThanOrEqual(59);
  const mute = await page.locator('#mute').boundingBox();
  expect(mute!.y).toBeGreaterThanOrEqual(59);
  // the boss bar and the end/menu overlays also clear it
  const bossTop = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('boss')!).top));
  expect(bossTop).toBeGreaterThanOrEqual(59 + 50);
  const padTop = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('start')!).paddingTop));
  expect(padTop).toBeGreaterThanOrEqual(59);
});

test('install prompt: Android shows our sheet on beforeinstallprompt and Not now is remembered', async ({ page }) => {
  await page.goto('/?seed=1');
  await page.waitForFunction(() => (window as any).__game);
  await page.evaluate(() => {
    const ev: any = new Event('beforeinstallprompt', { cancelable: true });
    ev.prompt = async () => { (window as any).__promptCalled = true; };
    ev.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(ev);
  });
  await expect(page.locator('#install')).toHaveClass(/show/, { timeout: 5000 });
  await expect(page.locator('#installBtn')).toHaveText('Install');
  await page.locator('#installLater').click();
  await expect(page.locator('#install')).not.toHaveClass(/show/);
  // reload: dismissed for a week, so no sheet even when the browser offers installation again
  await page.reload();
  await page.waitForFunction(() => (window as any).__game);
  await page.evaluate(() => {
    const ev: any = new Event('beforeinstallprompt', { cancelable: true });
    ev.prompt = async () => undefined;
    ev.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(ev);
  });
  await page.waitForTimeout(2200);
  await expect(page.locator('#install')).not.toHaveClass(/show/);
  // ...but the player can still ask for it from the menu
  await expect(page.locator('#installMenuBtn')).toBeVisible();
});

test('install prompt: Install triggers the browser prompt and remembers the install', async ({ page }) => {
  await page.goto('/?seed=1');
  await page.waitForFunction(() => (window as any).__game);
  await page.evaluate(() => {
    const ev: any = new Event('beforeinstallprompt', { cancelable: true });
    ev.prompt = async () => { (window as any).__promptCalled = true; };
    ev.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(ev);
  });
  await page.locator('#installBtn').click();
  await expect.poll(() => page.evaluate(() => (window as any).__promptCalled)).toBe(true);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('swarmvanguard.settings') ?? '{}').installed)).toBe(true);
  await expect(page.locator('#installMenuBtn')).toBeHidden();
});

test.describe('iPhone', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', hasTouch: true });
  test('install prompt: iOS gets the manual Share -> Add to Home Screen steps', async ({ page }) => {
    await page.goto('/?seed=1');
    await page.waitForFunction(() => (window as any).__game);
    await expect(page.locator('#install')).toHaveClass(/show/, { timeout: 6000 });
    await expect(page.locator('#installText')).toContainText('Add to Home Screen');
    await expect(page.locator('#installBtn')).toHaveText('Got it');
  });
});

test('PWA files: manifest is valid and every icon it lists exists', async ({ page, request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m.display).toBe('standalone');
  expect(m.start_url).toBe('./');
  expect(m.icons.some((i: any) => i.purpose === 'maskable')).toBe(true);
  expect(m.icons.some((i: any) => i.sizes === '192x192')).toBe(true);
  expect(m.icons.some((i: any) => i.sizes === '512x512')).toBe(true);
  for (const i of m.icons) expect((await request.get('/' + i.src)).ok(), i.src).toBe(true);
  expect((await request.get('/icons/apple-touch-icon.png')).ok()).toBe(true);
  expect((await request.get('/sw.js')).ok()).toBe(true);
  await page.goto('/');
  await expect(page.locator('link[rel=manifest]')).toHaveAttribute('href', './manifest.webmanifest');
  await expect(page.locator('link[rel=apple-touch-icon]')).toHaveCount(1);
});
