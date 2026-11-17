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
};

const LAWN: [number, number, number] = [86, 112, 54];

/**
 * Paints the whole city floor onto one canvas: asphalt with lane lines, crosswalks and stop
 * lines at intersections, curbs, sidewalk slabs, parking stalls, lawns under house lots, scrub.
 * Canvas row 0 = world y 0 (north), which is what a CanvasTexture on the ground plane expects.
 */
export function buildGroundTexture(map: CityMap): THREE.CanvasTexture {
  const W = Math.round(map.width * GROUND_PX);
  const H = Math.round(map.height * GROUND_PX);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  const rng = new Rng(4242);
  const cellPx = map.cell * GROUND_PX;

  // 1) per-pixel base colour from the tile map, with noise
  const img = g.createImageData(W, H);
  const lawnCells = new Set<number>();
  for (const b of map.buildings)
    if (b.kind === 'houses') for (let y = b.cells.y; y < b.cells.y + b.cells.h; y++) for (let x = b.cells.x; x < b.cells.x + b.cells.w; x++) lawnCells.add(y * map.cols + x);
  for (let py = 0; py < H; py++) {
    const cy = Math.min(map.rows - 1, Math.floor(py / cellPx));
    for (let px = 0; px < W; px++) {
      const cx = Math.min(map.cols - 1, Math.floor(px / cellPx));
      const ci = cy * map.cols + cx;
      const t = map.tiles[ci];
      let [r, gg, b] = lawnCells.has(ci) ? LAWN : TILE_COLORS[t] ?? [90, 90, 90];
      if ((t === Tile.Grass || t === Tile.Dirt) && !lawnCells.has(ci)) {
        // organic scrub: blend dirt↔grass with smooth noise instead of 3 m tile squares
        const wx = px / GROUND_PX;
        const wy = py / GROUND_PX;
        const n = fbm(wx, wy);
        const k = smooth((n - 0.42) / 0.16);
        const D = TILE_COLORS[Tile.Dirt];
        const G = TILE_COLORS[Tile.Grass];
        r = D[0] + (G[0] - D[0]) * k;
        gg = D[1] + (G[1] - D[1]) * k;
        b = D[2] + (G[2] - D[2]) * k;
      }
      let n = (rng.next() - 0.5) * 10;
      if (t === Tile.Grass || t === Tile.Dirt || lawnCells.has(ci)) n *= 2.2; // vegetation is noisier
      if (t === Tile.Road && rng.chance(0.004)) n -= 22; // cracks / oil specks
      const i = (py * W + px) * 4;
      img.data[i] = clamp8(r + n);
      img.data[i + 1] = clamp8(gg + n);
      img.data[i + 2] = clamp8(b + n * 0.8);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  const P = GROUND_PX;
  const fill = (color: string, x: number, y: number, w: number, h: number) => {
    g.fillStyle = color;
    g.fillRect(Math.round(x * P), Math.round(y * P), Math.max(1, Math.round(w * P)), Math.max(1, Math.round(h * P)));
  };

  // 2) grass tufts and dirt patches
  for (let i = 0; i < 2600; i++) {
    const x = rng.range(0, map.width);
    const y = rng.range(0, map.height);
    const t = map.tiles[Math.min(map.rows - 1, Math.floor(y / map.cell)) * map.cols + Math.min(map.cols - 1, Math.floor(x / map.cell))];
    if (t !== Tile.Grass && t !== Tile.Dirt) continue;
    fill(rng.chance(0.5) ? 'rgba(60,72,34,0.55)' : 'rgba(140,128,96,0.35)', x, y, rng.range(0.5, 1.5), rng.range(0.25, 0.75));
  }

  // 3) sidewalk slab joints + curbs
  for (let cy = 0; cy < map.rows; cy++)
    for (let cx = 0; cx < map.cols; cx++) {
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
  const intersections = findIntersections(map.roads);
  const inside = (x: number, y: number) => intersections.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  for (const road of map.roads) {
    const r = road.rect;
    const horiz = road.axis === 'h';
    const len = horiz ? r.w : r.h;
    const across = horiz ? r.h : r.w;
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

  // 5) a painted helipad and vehicle lane in the base
  const b = map.baseRect;
  g.strokeStyle = '#c8b25a';
  g.lineWidth = 2;
  g.beginPath();
  g.arc((b.x + b.w * 0.62) * P, (b.y + b.h * 0.2) * P, 7 * P, 0, Math.PI * 2);
  g.stroke();
  fill('#c8b25a', b.x + b.w * 0.62 - 2.2, b.y + b.h * 0.2 - 3, 0.8, 6);
  fill('#c8b25a', b.x + b.w * 0.62 + 1.4, b.y + b.h * 0.2 - 3, 0.8, 6);
  fill('#c8b25a', b.x + b.w * 0.62 - 1.4, b.y + b.h * 0.2 - 0.4, 2.8, 0.8);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
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
