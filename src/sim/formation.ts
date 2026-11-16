// One formation shared by simulation (bullets, collisions) and renderer (drawing),
// so the squad you SEE is exactly the squad that shoots and gets hit.
const MAX_HALF_WIDTH = 3.2; // lane half-width (4) minus margin; no import from game.ts (avoids a cycle)

export function spacing(n: number): number {
  return Math.max(0.26, Math.min(0.38, 0.38 - n * 0.0005));
}

/** Natural radius of the sunflower layout for n soldiers. */
function radius(n: number): number {
  return spacing(n) * Math.sqrt(Math.max(1, n));
}

/** Half-width the squad occupies (capped to the lane; crowds grow deeper instead). */
export function halfWidth(n: number): number {
  return Math.min(radius(n), MAX_HALF_WIDTH) + 0.2;
}

/** Half-depth along the lane. When width is capped the crowd packs deeper. */
export function halfDepth(n: number): number {
  const r = radius(n);
  const f = Math.min(1, MAX_HALF_WIDTH / r);
  return (r * 0.9) / f + 0.2;
}

/** Offset of soldier i (of n) from the squad centre; +dy is towards the enemy. */
export function slot(i: number, n: number): { dx: number; dy: number } {
  const r = spacing(n) * Math.sqrt(i + 0.5);
  const f = Math.min(1, MAX_HALF_WIDTH / radius(n));
  const a = i * 2.39996;
  return { dx: Math.cos(a) * r * f, dy: (Math.sin(a) * r * 0.9) / f };
}
