import type { Vec2 } from '../core/math';

/** Uniform-grid spatial hash for "who is near me" queries (zombie crowds can be hundreds). */
export class SpatialHash<T extends { pos: Vec2 }> {
  private cells = new Map<number, T[]>();
  constructor(private cell = 4) {}

  private key(cx: number, cy: number): number {
    return (cx + 1024) * 4096 + (cy + 1024);
  }

  clear(): void {
    this.cells.clear();
  }

  insert(item: T): void {
    const k = this.key(Math.floor(item.pos.x / this.cell), Math.floor(item.pos.y / this.cell));
    const list = this.cells.get(k);
    if (list) list.push(item);
    else this.cells.set(k, [item]);
  }

  query(p: Vec2, r: number, out: T[] = []): T[] {
    const c = this.cell;
    const x0 = Math.floor((p.x - r) / c);
    const x1 = Math.floor((p.x + r) / c);
    const y0 = Math.floor((p.y - r) / c);
    const y1 = Math.floor((p.y + r) / c);
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const list = this.cells.get(this.key(cx, cy));
        if (!list) continue;
        for (const it of list) {
          const dx = it.pos.x - p.x;
          const dy = it.pos.y - p.y;
          if (dx * dx + dy * dy <= r2) out.push(it);
        }
      }
    return out;
  }
}
