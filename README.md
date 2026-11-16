# Squad Rush

A mobile-first 3D lane shooter: your squad auto-advances and auto-fires, you steer sideways.
Shoot blocks, pick gates, grow the squad, survive the hordes and beat the boss.
Expand (grab rewards) vs. exploit (stay and fight) is the core decision.

## Play / develop
```
npm install
npm run dev        # dev server, reachable on your LAN (open on your phone)
npm test           # sim unit tests (vitest)
npm run e2e        # Playwright: phone viewport, input, draw-call budget
npm run balance    # headless bot report: win rate per policy per level
npx tsx tools/tune.ts   # re-tune horde sizes -> src/levels/tuned.json
node tools/shots.mjs 3 1 600,1200   # screenshots at given ticks (level, seed, ticks)
npm run build      # static build in dist/ (relative base: works on GitHub Pages)
```
Controls: drag (touch/mouse) or ←/→ / A/D.

Rules worth knowing: enemies walk straight down the lane (no homing). Any enemy that reaches the squad,
or slips past it to the bottom of the screen, costs lives. Volleys span the squad's full width, so
nothing in front of you is missed. Weapon pickups (blocks): SHOTGUN (close, wide), ROCKETS (splash,
best vs wide hordes), LASER (piercing, best vs columns/tanks), plus stat upgrades (DMG, FAST, PIERCE, SPREAD).
`npx tsx tools/weapons.ts` compares the weapon types in a fixed arena.

Debug URL params: `?level=3&seed=42&speed=4&autostart=1`. `window.__game` exposes
`getState()`, `step(n)`, `setInput(x)`, `stats()`, `restart()`, `stress(n)`.

## Architecture
`src/sim` is a deterministic fixed-step simulation with no three.js (also runs headless in Node for
bots). `src/render` draws it with InstancedMesh crowds. Stats are `base + modifiers`, and saves are
versioned (`src/meta/save.ts`), ready for a future upgrade shop.

## Deploy (GitHub Pages)
Create a GitHub repo, push `main`, then in Settings → Pages choose "GitHub Actions" as the source.
The workflow in `.github/workflows/deploy.yml` tests, builds and publishes `dist/`.
