import * as THREE from 'three';
import { Rng } from '../../core/rng';
import { Tile, type CityMap, type RoadDef } from '../../sim/map';
import type { Rect } from '../../core/math';

/** Texels per metre of the ground texture. */
export const GROUND_PX = 5;

const TILE_COLORS: Record<number, [number, number, number]> = {
  [Tile.Dirt]: [108, 96, 74],
  [Tile.Road]: [58, 60, 62],
  [Tile.Sidewalk]: [146, 142, 132],
  [Tile.BaseConcrete]: [122, 124, 118],
  [Tile.Parking]: [66, 68, 70],
  [Tile.Building]: [96, 96, 92],
  [Tile.Grass]: [92, 106, 60],
  [Tile.Rail]: [104, 98, 90], // ballast
};

const LAWN: [number, number, number] = [86, 112, 54];

/** What every chunk of a map shares: lawn cells, the scatter of tufts, road intersections (computed once). */
interface GroundShared {
  lawnCells: Set<number>;
  /** Round 17 #205: the ground to paint under a (non-house) building's cells. */
  underTile: Map<number, number>;
  tufts: { x: number; y: number; w: number; h: number; color: string }[];
  intersections: Rect[];
}
const shared = new WeakMap<CityMap, GroundShared>();
function sharedFor(map: CityMap): GroundShared {
  let s = shared.get(map);
  if (s) return s;
  const lawnCells = new Set<number>();
  // round 17 #205: other buildings' footprints take the ground that's most common around them (they're often
  // smaller than their cells, and the flat grey under them showed as a band)
  const underTile = new Map<number, number>();
  for (const b of map.buildings) {
    const c = b.cells;
    if (b.kind === 'houses') {
      for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) lawnCells.add(y * map.cols + x);
      continue;
    }
    const count = new Map<number, number>();
    for (let y = c.y - 1; y <= c.y + c.h; y++)
      for (let x = c.x - 1; x <= c.x + c.w; x++) {
        if (x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h) continue; // the ring just outside
        if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) continue;
        const t = map.tiles[y * map.cols + x];
        if (t === Tile.Building || t === Tile.Road || t === Tile.Rail) continue;
        count.set(t, (count.get(t) ?? 0) + 1);
      }
    const best = [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? Tile.Dirt;
    for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) underTile.set(y * map.cols + x, best);
  }
  // grass tufts and dirt patches, scattered over the whole map once (each chunk draws the ones in it)
  const rng = new Rng(4242);
  const tufts: GroundShared['tufts'] = [];
  const n = Math.round((2600 * map.width * map.height) / (510 * 456)); // the same density as the v4.17 map
  for (let i = 0; i < n; i++) {
    const x = rng.range(0, map.width);
    const y = rng.range(0, map.height);
    const color = rng.chance(0.5) ? 'rgba(60,72,34,0.55)' : 'rgba(140,128,96,0.35)';
    const w = rng.range(0.5, 1.5);
    const h = rng.range(0.25, 0.75);
    const t = map.tiles[Math.min(map.rows - 1, Math.floor(y / map.cell)) * map.cols + Math.min(map.cols - 1, Math.floor(x / map.cell))];
    if (t === Tile.Grass || t === Tile.Dirt) tufts.push({ x, y, w, h, color });
  }
  s = { lawnCells, underTile, tufts, intersections: findIntersections(map.roads) };
  shared.set(map, s);
  return s;
}

/**
 * Paints one window of the city floor (STATUS #14, v4.46: the ground comes in chunks): asphalt with lane
 * lines, crosswalks and stop lines at intersections, curbs, sidewalk slabs, parking stalls, lawns under
 * house lots, scrub. `win` is in metres; `P` is texels per metre (GROUND_PX for full detail, less for the
 * zoomed-out ops map). Noise comes from the world position, so neighbouring chunks meet without a seam.
 * Canvas row 0 = the window's north edge, which is what a CanvasTexture on a ground plane expects.
 */
export function paintGround(map: CityMap, win: Rect, P = GROUND_PX): HTMLCanvasElement {
  const job = groundJob(map, win, P);
  while (!job.step(Infinity));
  return job.canvas;
}

/**
 * The same painting as a job that can be done a bit at a time (v4.46): `step(ms)` paints rows for up to
 * about that long and returns true once the canvas is finished. Streaming chunks paint within a small
 * per-frame budget instead of stalling a frame for ~100 ms.
 */
export function groundJob(map: CityMap, win: Rect, P = GROUND_PX): { canvas: HTMLCanvasElement; step: (ms: number) => boolean } {
  const W = Math.max(1, Math.round(win.w * P));
  const H = Math.max(1, Math.round(win.h * P));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  const { lawnCells, underTile, tufts, intersections } = sharedFor(map);

  // 1) per-pixel base colour from the tile map, with noise (row by row, resumable)
  const img = g.createImageData(W, H);
  let row = 0;
  const pixels = (rows: number) => {
    const end = Math.min(H, row + rows);
    for (let py = row; py < end; py++) {
      const wyp = win.y + py / P;
      const cy = Math.max(0, Math.min(map.rows - 1, Math.floor(wyp / map.cell)));
      for (let px = 0; px < W; px++) {
        const wxp = win.x + px / P;
        const cx = Math.max(0, Math.min(map.cols - 1, Math.floor(wxp / map.cell)));
        const ci = cy * map.cols + cx;
        const t0 = map.tiles[ci];
        const t = t0 === Tile.Building ? (underTile.get(ci) ?? t0) : t0;
        let [r, gg, b] = lawnCells.has(ci) ? LAWN : TILE_COLORS[t] ?? [90, 90, 90];
        if ((t === Tile.Grass || t === Tile.Dirt) && !lawnCells.has(ci)) {
          // organic scrub: blend dirt↔grass with smooth noise instead of 3 m tile squares
          const n = fbm(wxp, wyp);
          const k = smooth((n - 0.42) / 0.16);
          const D = TILE_COLORS[Tile.Dirt];
          const G = TILE_COLORS[Tile.Grass];
          r = D[0] + (G[0] - D[0]) * k;
          gg = D[1] + (G[1] - D[1]) * k;
          b = D[2] + (G[2] - D[2]) * k;
        }
        // per-texel grain from the world position (at full detail), so it's the same in every chunk
        const hx = Math.floor(wxp * GROUND_PX);
        const hy = Math.floor(wyp * GROUND_PX);
        let n = (hash2(hx, hy) - 0.5) * 10;
        if (t === Tile.Grass || t === Tile.Dirt || lawnCells.has(ci)) n *= 2.2; // vegetation is noisier
        if (t === Tile.Road && hash2(hx + 7919, hy - 104729) < 0.004) n -= 22; // cracks / oil specks
        const i = (py * W + px) * 4;
        img.data[i] = clamp8(r + n);
        img.data[i + 1] = clamp8(gg + n);
        img.data[i + 2] = clamp8(b + n * 0.8);
        img.data[i + 3] = 255;
      }
    }
    row = end;
  };

  const finish = () => {
    g.putImageData(img, 0, 0);

    // everything below is drawn in world metres, shifted into the window; anything outside it is skipped
    const x1 = win.x + win.w;
    const y1 = win.y + win.h;
    const fill = (color: string, x: number, y: number, w: number, h: number) => {
      if (x > x1 || y > y1 || x + w < win.x || y + h < win.y) return;
      g.fillStyle = color;
      g.fillRect(Math.round((x - win.x) * P), Math.round((y - win.y) * P), Math.max(1, Math.round(w * P)), Math.max(1, Math.round(h * P)));
  };

  // 2) grass tufts and dirt patches
  for (const t of tufts) fill(t.color, t.x, t.y, t.w, t.h);

  // 3) sidewalk slab joints + curbs (only the cells in and right around the window)
  const c0x = Math.max(0, Math.floor(win.x / map.cell) - 2);
  const c0y = Math.max(0, Math.floor(win.y / map.cell) - 2);
  const c1x = Math.min(map.cols, Math.ceil(x1 / map.cell) + 2);
  const c1y = Math.min(map.rows, Math.ceil(y1 / map.cell) + 2);
  for (let cy = c0y; cy < c1y; cy++)
    for (let cx = c0x; cx < c1x; cx++) {
      const t = map.tiles[cy * map.cols + cx];
      const x = cx * map.cell;
      const y = cy * map.cell;
      if (t === Tile.Sidewalk) {
        for (let k = 0; k < map.cell; k += 1.5) {
          fill('rgba(0,0,0,0.10)', x + k, y, 0.25, map.cell);
          fill('rgba(0,0,0,0.10)', x, y + k, map.cell, 0.25);
        }
        // curb: a light line wherever sidewalk meets road
        const nb = (dx: number, dy: number) => map.tiles[(cy + dy) * map.cols + (cx + dx)];
        if (cy > 0 && nb(0, -1) === Tile.Road) fill('#b8b4a8', x, y, map.cell, 0.25);
        if (cy < map.rows - 1 && nb(0, 1) === Tile.Road) fill('#b8b4a8', x, y + map.cell - 0.25, map.cell, 0.25);
        if (cx > 0 && nb(-1, 0) === Tile.Road) fill('#b8b4a8', x, y, 0.25, map.cell);
        if (cx < map.cols - 1 && nb(1, 0) === Tile.Road) fill('#b8b4a8', x + map.cell - 0.25, y, 0.25, map.cell);
      }
      if (t === Tile.BaseConcrete && (cx + cy) % 2 === 0) {
        fill('rgba(0,0,0,0.07)', x, y, map.cell * 2, 0.25);
        fill('rgba(0,0,0,0.07)', x, y, 0.25, map.cell * 2);
      }
      // parking stalls: a white divider at each cell edge inside a lot, with a drive aisle every third row
      if (t === Tile.Parking && cy % 3 !== 1) {
        const left = map.tiles[cy * map.cols + cx - 1];
        if (left === Tile.Parking) fill('rgba(220,220,210,0.75)', x, y + 0.4, 0.2, map.cell - 0.8);
      }
    }

  // 4) road markings, crosswalks, stop lines
  const inside = (x: number, y: number) => intersections.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  for (const road of map.roads) {
    const r = road.rect;
    const horiz = road.axis === 'h';
    const len = horiz ? r.w : r.h;
    const across = horiz ? r.h : r.w;
    if (r.x > x1 || r.y > y1 || r.x + r.w < win.x || r.y + r.h < win.y) continue;
    for (let s = 0; s < len; s += 0.5) {
      const along = (horiz ? r.x : r.y) + s;
      const at = (off: number) => (horiz ? { x: along, y: r.y + off } : { x: r.x + off, y: along });
      const c = at(across / 2);
      if (inside(c.x, c.y)) continue;
      const inBase = c.x < map.baseRect.x + map.baseRect.w && c.y > map.baseRect.y && c.y < map.baseRect.y + map.baseRect.h;
      if (inBase) continue;
      // double yellow centre line
      for (const o of [-0.25, 0.1]) {
        const p = at(across / 2 + o);
        fill('#c8a640', p.x, p.y, horiz ? 0.5 : 0.15, horiz ? 0.15 : 0.5);
      }
      // dashed white lane lines (3 m dash, 6 m gap)
      if (s % 9 < 3)
        for (const f of [0.25, 0.75]) {
          const p = at(across * f);
          fill('#d6d4cc', p.x, p.y, horiz ? 0.5 : 0.15, horiz ? 0.15 : 0.5);
        }
    }
  }
  for (const box of intersections) {
    // zebra crossings on all four approaches, 1.5 m outside the box, plus stop lines
    const stripes = (x0: number, y0: number, w: number, h: number, vertStripes: boolean) => {
      const n = Math.floor((vertStripes ? w : h) / 1.1);
      for (let i = 0; i < n; i++) {
        if (vertStripes) fill('#dcdad2', x0 + i * 1.1 + 0.3, y0, 0.55, h);
        else fill('#dcdad2', x0, y0 + i * 1.1 + 0.3, w, 0.55);
      }
    };
    stripes(box.x, box.y - 4.5, box.w, 3, true);
    stripes(box.x, box.y + box.h + 1.5, box.w, 3, true);
    stripes(box.x - 4.5, box.y, 3, box.h, false);
    stripes(box.x + box.w + 1.5, box.y, 3, box.h, false);
    fill('#dcdad2', box.x, box.y - 5.2, box.w / 2, 0.4);
    fill('#dcdad2', box.x + box.w / 2, box.y + box.h + 4.8, box.w / 2, 0.4);
    fill('#dcdad2', box.x - 5.2, box.y + box.h / 2, 0.4, box.h / 2);
    fill('#dcdad2', box.x + box.w + 4.8, box.y, 0.4, box.h / 2);
  }

  // 4b) railway: sleepers and two rails along each line (v4.17, Rail Siding). Round 10 #117: the rails run
  // on over the roads at level crossings (no sleepers there, just a crossing panel), on top of the markings.
  for (const r of map.rails ?? []) {
    const yMid = r.y + r.h / 2;
    for (let x0 = r.x; x0 < r.x + r.w; x0 += map.cell) {
      const tile = map.tiles[Math.floor(yMid / map.cell) * map.cols + Math.floor(x0 / map.cell)];
      if (tile === Tile.Road) fill('#4a4a48', x0, yMid - 1.2, map.cell, 2.4); // crossing panel
      else for (let s = 0.4; s < map.cell; s += 0.65) fill('#5a4636', x0 + s, yMid - 1.4, 0.28, 2.8); // sleepers
      fill('#8a8a86', x0, yMid - 0.78, map.cell, 0.12); // rails
      fill('#8a8a86', x0, yMid + 0.66, map.cell, 0.12);
    }
  }

  // 5) a painted helipad and vehicle lane in the base
  const b = map.baseRect;
  g.strokeStyle = '#c8b25a';
  g.lineWidth = Math.max(1, (2 * P) / GROUND_PX);
  g.beginPath();
  g.arc((b.x + b.w * 0.62 - win.x) * P, (b.y + b.h * 0.2 - win.y) * P, 7 * P, 0, Math.PI * 2);
  g.stroke();
  fill('#c8b25a', b.x + b.w * 0.62 - 2.2, b.y + b.h * 0.2 - 3, 0.8, 6);
  fill('#c8b25a', b.x + b.w * 0.62 + 1.4, b.y + b.h * 0.2 - 3, 0.8, 6);
  fill('#c8b25a', b.x + b.w * 0.62 - 1.4, b.y + b.h * 0.2 - 0.4, 2.8, 0.8);

  };

  let done = false;
  return {
    canvas,
    step(ms: number): boolean {
      const t0 = performance.now();
      while (row < H) {
        pixels(8);
        if (performance.now() - t0 > ms) return false;
      }
      if (row >= H && !done) {
        finish();
        done = true;
      }
      return true;
    },
  };
}
/** A ground texture for one window (see paintGround). */
export function groundTexture(map: CityMap, win: Rect, P = GROUND_PX): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(paintGround(map, win, P));
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function findIntersections(roads: RoadDef[]): Rect[] {
  const out: Rect[] = [];
  for (const a of roads)
    for (const b of roads) {
      if (a.axis !== 'h' || b.axis !== 'v') continue;
      const x = Math.max(a.rect.x, b.rect.x);
      const y = Math.max(a.rect.y, b.rect.y);
      const x2 = Math.min(a.rect.x + a.rect.w, b.rect.x + b.rect.w);
      const y2 = Math.min(a.rect.y + a.rect.h, b.rect.y + b.rect.h);
      if (x2 > x && y2 > y) out.push({ x, y, w: x2 - x, h: y2 - y });
    }
  return out;
}

const clamp8 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

// ---- smooth value noise for organic ground patches ----
const hash2 = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(x: number, y: number): number {
  return vnoise(x / 14, y / 14) * 0.6 + vnoise(x / 5, y / 5) * 0.3 + vnoise(x / 1.8, y / 1.8) * 0.1;
}
const smooth = (t: number) => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};
