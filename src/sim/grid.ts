import type { Vec2 } from '../core/math';

/**
 * Walkability grid shared by pathfinding and collision.
 * Static layer (buildings, cars) + dynamic layer (player structures, rubble later).
 * `slow` holds per-tile speed multipliers for area denial (barbed wire).
 */
export class NavGrid {
  readonly blocked: Uint8Array;
  readonly slow: Float32Array;
  /** structure id occupying a tile (0 = none). Lets zombies attack what blocks them. */
  readonly occupant: Int32Array;
  /** Sight blockers (buildings, later rubble). Cars and sandbags are low — you shoot over them. */
  readonly opaque: Uint8Array;
  /** Bumped whenever walkability changes so cached paths can be invalidated. */
  version = 0;

  constructor(readonly width: number, readonly height: number) {
    this.blocked = new Uint8Array(width * height);
    this.slow = new Float32Array(width * height).fill(1);
    this.occupant = new Int32Array(width * height);
    this.opaque = new Uint8Array(width * height);
  }

  idx(x: number, y: number): number {
    return y * this.width + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  isBlocked(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return true;
    return this.blocked[y * this.width + x] !== 0;
  }

  isBlockedAt(p: Vec2): boolean {
    return this.isBlocked(Math.floor(p.x), Math.floor(p.y));
  }

  setRect(x0: number, y0: number, w: number, h: number, blocked: boolean, occupant = 0): void {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        if (!this.inBounds(x, y)) continue;
        const i = this.idx(x, y);
        this.blocked[i] = blocked ? 1 : 0;
        this.occupant[i] = blocked ? occupant : 0;
      }
    this.version++;
  }

  setSlow(x0: number, y0: number, w: number, h: number, mult: number, occupant = 0): void {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        if (!this.inBounds(x, y)) continue;
        const i = this.idx(x, y);
        this.slow[i] = mult;
        if (occupant || mult === 1) this.occupant[i] = mult === 1 ? 0 : occupant;
      }
  }

  rectFree(x0: number, y0: number, w: number, h: number): boolean {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (this.isBlocked(x, y)) return false;
    return true;
  }

  /** Nearest walkable tile center to p (spiral search). */
  nearestFree(p: Vec2, maxR = 8): Vec2 {
    const cx = Math.floor(p.x);
    const cy = Math.floor(p.y);
    if (!this.isBlocked(cx, cy)) return p;
    for (let r = 1; r <= maxR; r++) {
      let best: Vec2 | null = null;
      let bestD = Infinity;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (this.isBlocked(x, y)) continue;
          const d = (x + 0.5 - p.x) ** 2 + (y + 0.5 - p.y) ** 2;
          if (d < bestD) {
            bestD = d;
            best = { x: x + 0.5, y: y + 0.5 };
          }
        }
      if (best) return best;
    }
    return p;
  }

  /** Bresenham line-of-sight across tiles. */
  lineClear(a: Vec2, b: Vec2): boolean {
    let x0 = Math.floor(a.x);
    let y0 = Math.floor(a.y);
    const x1 = Math.floor(b.x);
    const y1 = Math.floor(b.y);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (x0 === x1 && y0 === y1) return true;
      if (!this.inBounds(x0, y0)) return false;
      if (this.opaque[this.idx(x0, y0)] && !(x0 === Math.floor(a.x) && y0 === Math.floor(a.y))) return false;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
}
