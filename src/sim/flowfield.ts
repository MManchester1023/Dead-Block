import type { Vec2 } from '../core/math';
import type { NavGrid } from './grid';

/**
 * Flow fields for crowds (doc §14 v4.1 crowd tech).
 *
 * Instead of every zombie running its own A*, one Dijkstra pass from a goal cell gives every cell
 * its distance-to-goal; a zombie anywhere just steps to its cheapest neighbour. A thousand zombies
 * chasing the same squad or the same gunshot share one field. Fields are cached per goal cell and
 * thrown away when walkability changes (grid.version).
 */
export class FlowFields {
  private cache = new Map<number, { version: number; cost: Float32Array; used: number }>();
  private heapIdx: Int32Array;
  private heapKey: Float32Array;
  private tick = 0;
  /** Fields computed this session (for profiling/tests). */
  computed = 0;

  constructor(private grid: NavGrid, private maxCached = 48) {
    const n = grid.width * grid.height;
    this.heapIdx = new Int32Array(n * 8);
    this.heapKey = new Float32Array(n * 8);
  }

  /** Distance-to-goal for every cell (Infinity = unreachable). */
  field(goal: Vec2): Float32Array {
    const g = this.grid;
    const gx = Math.min(g.width - 1, Math.max(0, g.c(goal.x)));
    const gy = Math.min(g.height - 1, Math.max(0, g.c(goal.y)));
    const key = gy * g.width + gx;
    this.tick++;
    const hit = this.cache.get(key);
    if (hit && hit.version === g.version) {
      hit.used = this.tick;
      return hit.cost;
    }
    const cost = this.compute(gx, gy);
    if (this.cache.size >= this.maxCached) {
      let oldK = -1;
      let oldT = Infinity;
      for (const [k, v] of this.cache) if (v.used < oldT) (oldT = v.used), (oldK = k);
      this.cache.delete(oldK);
    }
    this.cache.set(key, { version: g.version, cost, used: this.tick });
    return cost;
  }

  /**
   * Unit direction to walk from `pos` toward the field's goal, or null if `pos` can't reach it.
   * Picks the cheapest of the 8 neighbours (no corner cutting), aiming at that cell's centre.
   */
  direction(cost: Float32Array, pos: Vec2): Vec2 | null {
    const g = this.grid;
    const cx = g.c(pos.x);
    const cy = g.c(pos.y);
    if (!g.inBounds(cx, cy)) return null;
    const here = cost[cy * g.width + cx];
    let best = here;
    let bx = cx;
    let by = cy;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (g.isBlocked(nx, ny)) continue;
        if (dx && dy && (g.isBlocked(cx + dx, cy) || g.isBlocked(cx, cy + dy))) continue;
        const c = cost[ny * g.width + nx];
        if (c < best) (best = c), (bx = nx), (by = ny);
      }
    if (best === Infinity) return null;
    if (bx === cx && by === cy) return null; // at the goal cell
    const tx = g.center(bx) - pos.x;
    const ty = g.center(by) - pos.y;
    const l = Math.hypot(tx, ty) || 1;
    return { x: tx / l, y: ty / l };
  }

  private compute(gx: number, gy: number): Float32Array {
    this.computed++;
    const g = this.grid;
    const W = g.width;
    const n = W * g.height;
    const cost = new Float32Array(n).fill(Infinity);
    const hi = this.heapIdx;
    const hk = this.heapKey;
    let size = 0;
    const push = (i: number, k: number) => {
      let c = size++;
      hi[c] = i;
      hk[c] = k;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (hk[p] <= hk[c]) break;
        const ti = hi[p], tk = hk[p];
        hi[p] = hi[c]; hk[p] = hk[c];
        hi[c] = ti; hk[c] = tk;
        c = p;
      }
    };
    const pop = (): number => {
      const top = hi[0];
      size--;
      if (size > 0) {
        hi[0] = hi[size];
        hk[0] = hk[size];
        let c = 0;
        for (;;) {
          const l = 2 * c + 1;
          const r = l + 1;
          let m = c;
          if (l < size && hk[l] < hk[m]) m = l;
          if (r < size && hk[r] < hk[m]) m = r;
          if (m === c) break;
          const ti = hi[m], tk = hk[m];
          hi[m] = hi[c]; hk[m] = hk[c];
          hi[c] = ti; hk[c] = tk;
          c = m;
        }
      }
      return top;
    };
    const start = gy * W + gx;
    cost[start] = 0;
    push(start, 0);
    while (size > 0) {
      const cur = pop();
      const cc = cost[cur];
      const cx = cur % W;
      const cy = (cur / W) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (g.isBlocked(nx, ny)) continue;
          if (dx && dy && (g.isBlocked(cx + dx, cy) || g.isBlocked(cx, cy + dy))) continue;
          const ni = ny * W + nx;
          const nc = cc + (dx && dy ? Math.SQRT2 : 1) / g.slow[ni];
          if (nc < cost[ni]) {
            cost[ni] = nc;
            if (size < hi.length) push(ni, nc);
          }
        }
    }
    return cost;
  }
}
