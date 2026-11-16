# Swarm Vanguard

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
nothing in front of you is missed.

Pickups: shoot-blocks (+soldiers or weapon), counting blocks (shoot them to raise the value), math gates
(+N, xN, -N, /N) and purple **upgrade gates** (weapon or stat). Weapons: SHOTGUN (close, wide), ROCKETS
(splash, best vs wide hordes), LASER (piercing, best vs columns/tanks). Shoot **barrels** while enemies stand
next to them. **Splitters** burst into three fast minis. Bosses call in reinforcements at 66% and 33% HP.

Meta: coins buy permanent upgrades (squad size, firepower, fire rate, loot bonus). They are just sim modifiers;
the difficulty tuner and the bots always run with zero upgrades.

Four worlds x four levels: Sun Dunes, Red Canyon, Frozen Wastes, Ember Peak, each with its own boss.
`npx tsx tools/weapons.ts` compares the weapon types in a fixed arena. `?theme=0..3` previews a world.

## Architecture
`src/sim` is a deterministic fixed-step simulation with no three.js (also runs headless in Node for
bots). `src/render` draws it with InstancedMesh crowds. Stats are `base + modifiers`, and saves are
versioned (`src/meta/save.ts`), ready for a future upgrade shop.

## Deploy (GitHub Pages)
Create a GitHub repo, push `main`, then in Settings → Pages choose "GitHub Actions" as the source.
The workflow in `.github/workflows/deploy.yml` tests, builds and publishes `dist/`.
