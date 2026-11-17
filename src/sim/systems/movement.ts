import type { Vec2 } from '../../core/math';
import type { NavGrid } from '../grid';

/** Axis-separated slide against blocked tiles. Returns true if movement was (partly) blocked. */
export function moveWithCollision(grid: NavGrid, pos: Vec2, dx: number, dy: number, r: number, ignoreId = 0): boolean {
  let blocked = false;
  const free = (x: number, y: number) => {
    for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
      const tx = Math.floor(x + ox);
      const ty = Math.floor(y + oy);
      if (grid.isBlocked(tx, ty) && !(ignoreId && grid.occupant[grid.idx(tx, ty)] === ignoreId)) return false;
    }
    return true;
  };
  // already overlapping something (spawned or knocked into it)? let it slide out instead of freezing
  if (!free(pos.x, pos.y)) {
    if (!grid.isBlocked(Math.floor(pos.x + dx), Math.floor(pos.y + dy))) {
      pos.x += dx;
      pos.y += dy;
    }
    return true;
  }
  if (dx) {
    if (free(pos.x + dx, pos.y)) pos.x += dx;
    else blocked = true;
  }
  if (dy) {
    if (free(pos.x, pos.y + dy)) pos.y += dy;
    else blocked = true;
  }
  return blocked;
}

/** Which tile would we enter moving by (dx, dy)? Used to find the structure a zombie is scratching at. */
export function blockingTile(grid: NavGrid, pos: Vec2, dx: number, dy: number, r: number): number {
  const l = Math.hypot(dx, dy) || 1;
  const x = Math.floor(pos.x + (dx / l) * (r + 0.3));
  const y = Math.floor(pos.y + (dy / l) * (r + 0.3));
  return grid.inBounds(x, y) ? grid.occupant[grid.idx(x, y)] : 0;
}
