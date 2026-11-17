import type { Vec2 } from '../core/math';
import type { NavGrid } from './grid';

/** Binary-heap A* over the nav grid, 8-connected with no corner cutting, plus line-of-sight smoothing. */
export function findPath(grid: NavGrid, from: Vec2, to: Vec2, maxNodes = 6000): Vec2[] | null {
  const W = grid.width;
  const sx = Math.floor(from.x);
  const sy = Math.floor(from.y);
  const goal = grid.nearestFree(to);
  const gx = Math.floor(goal.x);
  const gy = Math.floor(goal.y);
  if (sx === gx && sy === gy) return [goal];

  const start = sy * W + sx;
  const target = gy * W + gx;
  const g = new Map<number, number>([[start, 0]]);
  const came = new Map<number, number>();
  const closed = new Set<number>();
  const heap: [number, number][] = [[0, start]];
  const h = (i: number) => {
    const x = i % W;
    const y = (i / W) | 0;
    const dx = Math.abs(x - gx);
    const dy = Math.abs(y - gy);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };
  const push = (f: number, i: number) => {
    heap.push([f, i]);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (heap[p][0] <= heap[c][0]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = (): number => {
    const top = heap[0][1];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = 2 * c + 1;
        const r = l + 1;
        let m = c;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]];
        c = m;
      }
    }
    return top;
  };

  let expanded = 0;
  let best = start;
  let bestH = h(start);
  while (heap.length) {
    const cur = pop();
    if (closed.has(cur)) continue;
    if (cur === target) {
      best = cur;
      break;
    }
    closed.add(cur);
    if (++expanded > maxNodes) break;
    const cx = cur % W;
    const cy = (cur / W) | 0;
    const ch = h(cur);
    if (ch < bestH) {
      bestH = ch;
      best = cur;
    }
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (grid.isBlocked(nx, ny)) continue;
        if (dx && dy && (grid.isBlocked(cx + dx, cy) || grid.isBlocked(cx, cy + dy))) continue;
        const ni = ny * W + nx;
        if (closed.has(ni)) continue;
        const cost = (g.get(cur) ?? 0) + (dx && dy ? Math.SQRT2 : 1) / grid.slow[ni];
        if (cost < (g.get(ni) ?? Infinity)) {
          g.set(ni, cost);
          came.set(ni, cur);
          push(cost + h(ni), ni);
        }
      }
  }

  // Reconstruct (to the target, or the closest reachable tile if the target is sealed off).
  const tilePath: number[] = [];
  let c: number | undefined = best;
  while (c !== undefined && c !== start) {
    tilePath.push(c);
    c = came.get(c);
  }
  if (!tilePath.length) return null;
  tilePath.reverse();
  const pts = tilePath.map((i) => ({ x: (i % W) + 0.5, y: ((i / W) | 0) + 0.5 }));
  if (best === target) pts[pts.length - 1] = goal;
  return smooth(grid, from, pts);
}

function walkable(grid: NavGrid, a: Vec2, b: Vec2): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.ceil(d / 0.25);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const y = a.y + (b.y - a.y) * t;
    // sample a small footprint so smoothed paths don't clip corners
    for (const [ox, oy] of [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]])
      if (grid.isBlocked(Math.floor(x + ox), Math.floor(y + oy))) return false;
  }
  return true;
}

function smooth(grid: NavGrid, from: Vec2, pts: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  let anchor = from;
  let i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !walkable(grid, anchor, pts[j])) j--;
    out.push(pts[j]);
    anchor = pts[j];
    i = j + 1;
  }
  return out;
}
