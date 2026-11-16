import { LANE_HALF } from '../sim/game';

/**
 * Turns pointer drag (relative) and arrow/A-D keys into a lateral target X.
 * A debug override lets tests/bots inject input.
 */
export class Controls {
  targetX = 0;
  override: number | null = null;
  private dragging = false;
  private startPx = 0;
  private startTarget = 0;
  private keys = new Set<string>();

  constructor(el: HTMLElement) {
    el.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.startPx = e.clientX;
      this.startTarget = this.targetX;
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const w = el.clientWidth || 360;
      // dragging across the full stage width moves ~1.6 lane widths
      this.targetX = clampX(this.startTarget + ((e.clientX - this.startPx) / w) * LANE_HALF * 2 * 1.6);
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
    if (dir) this.targetX = clampX(this.targetX + dir * 9 * dt);
  }

  value(): number {
    return this.override ?? this.targetX;
  }

  reset() {
    this.targetX = 0;
    this.override = null;
  }
}

function clampX(x: number) {
  return Math.max(-LANE_HALF, Math.min(LANE_HALF, x));
}
