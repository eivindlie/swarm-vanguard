import { LANE_HALF, type Input } from '../sim/game';

/**
 * Turns pointer drag (relative) and arrow/WASD keys into a target position for the squad.
 * Lane levels use x only. Siege levels also use y (`yRange` is set from the game each frame): vertical drag
 * and W/S or up/down arrows move the squad along the arena.
 * A debug override lets tests/bots inject input.
 */
export class Controls {
  targetX = 0;
  targetY = 0;
  /** Current lateral limit of the squad (set every frame from the sim). */
  limit = LANE_HALF;
  /** Siege only: [minY, maxY] the squad may stand on. null in lane levels (vertical input is ignored). */
  yRange: [number, number] | null = null;
  override: number | null = null;
  overrideY: number | null = null;
  private dragging = false;
  private startPx = 0;
  private startPy = 0;
  private startTarget = 0;
  private startTargetY = 0;
  private keys = new Set<string>();

  constructor(el: HTMLElement) {
    el.addEventListener('pointerdown', (e) => {
      // Don't capture the pointer for UI taps: capture would retarget the click away from the button.
      if ((e.target as HTMLElement).closest?.('button, .overlay')) return;
      this.dragging = true;
      this.startPx = e.clientX;
      this.startPy = e.clientY;
      this.startTarget = this.targetX;
      this.startTargetY = this.targetY;
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const w = el.clientWidth || 360;
      const h = el.clientHeight || 640;
      // dragging across the full stage width moves ~1.6 lane widths
      this.targetX = this.clamp(this.startTarget + ((e.clientX - this.startPx) / w) * LANE_HALF * 2 * 1.6);
      // siege: a full stage height of drag is about 22 arena units (screen up = towards the nest)
      if (this.yRange) this.targetY = this.clampY(this.startTargetY - ((e.clientY - this.startPy) / h) * 22);
    });
    const up = () => (this.dragging = false);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** Call once per frame with real dt. */
  update(dt: number) {
    const dir = (this.keys.has('arrowright') || this.keys.has('d') ? 1 : 0) - (this.keys.has('arrowleft') || this.keys.has('a') ? 1 : 0);
    if (dir) this.targetX = this.clamp(this.targetX + dir * 9 * dt);
    else this.targetX = this.clamp(this.targetX);
    if (this.yRange) {
      const dy = (this.keys.has('arrowup') || this.keys.has('w') ? 1 : 0) - (this.keys.has('arrowdown') || this.keys.has('s') ? 1 : 0);
      this.targetY = this.clampY(this.targetY + dy * 9 * dt);
    }
  }

  private clamp(x: number): number {
    return Math.max(-this.limit, Math.min(this.limit, x));
  }

  private clampY(y: number): number {
    return this.yRange ? Math.max(this.yRange[0], Math.min(this.yRange[1], y)) : y;
  }

  value(): number {
    return this.override ?? this.targetX;
  }

  /** What to feed the simulation this tick. */
  input(): Input {
    return this.yRange ? { targetX: this.value(), targetY: this.overrideY ?? this.targetY } : { targetX: this.value() };
  }

  /** `startY` is where the squad starts in a siege (so the first frame does not yank it). */
  reset(startY = 0) {
    this.targetX = 0;
    this.targetY = startY;
    this.override = null;
    this.overrideY = null;
  }
}
