import * as THREE from 'three';
import { Rng } from '../../core/rng';
import { Tile, type CityMap, type PropDef } from '../../sim/map';
import type { NavGrid } from '../../sim/grid';
import { Batch } from './batch';

/** Palm: segmented, slightly leaning trunk with drooping fronds. 6–9 m. */
export function palmTree(B: Batch, x: number, z: number, rng: Rng, scale = 1): void {
  const h = rng.range(6, 9) * scale;
  const lean = rng.range(-0.12, 0.12);
  const leanDir = rng.range(0, Math.PI * 2);
  const segs = 7;
  let px = x;
  let pz = z;
  for (let i = 0; i < segs; i++) {
    const y = (i + 0.5) * (h / segs);
    const r = 0.22 - i * 0.012;
    B.cyl(r * 0.92, r, h / segs, 6, i % 2 ? 0x8a7458 : 0x7a6448, px, y, pz);
    px += Math.cos(leanDir) * lean * (h / segs) * (i / segs) * 2;
    pz += Math.sin(leanDir) * lean * (h / segs) * (i / segs) * 2;
  }
  const fronds = 8;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const len = rng.range(2.4, 3.2) * scale;
    const droop = rng.range(0.35, 0.6);
    const col = rng.pick([0x4e6a2a, 0x5a7a30, 0x46602a]);
    // two-segment frond: out and up, then drooping down
    const ox = Math.cos(a);
    const oz = Math.sin(a);
    B.box(len * 0.55, 0.06, 0.55, col, px + ox * len * 0.25, h + 0.15, pz + oz * len * 0.25, -a, 0, 0.15);
    B.box(len * 0.55, 0.06, 0.45, col, px + ox * len * 0.68, h - 0.25 * droop * len, pz + oz * len * 0.68, -a, 0, -droop);
  }
  B.box(0.5, 0.5, 0.5, 0x6a5a3a, px, h - 0.1, pz); // coconut cluster
}

/** Broadleaf tree: trunk + clustered flat-shaded canopy. */
export function leafyTree(B: Batch, x: number, z: number, rng: Rng, scale = 1): void {
  const h = rng.range(3.2, 4.6) * scale;
  B.cyl(0.18 * scale, 0.26 * scale, h, 6, 0x5a4632, x, h / 2, z);
  const green = rng.pick([0x4a6a2e, 0x55752f, 0x3e5e2a, 0x667a34]);
  for (let i = 0; i < 4; i++) {
    const r = rng.range(1.2, 1.9) * scale;
    const g = new THREE.IcosahedronGeometry(r, 0);
    const c = new THREE.Color(green).offsetHSL(0, 0, rng.range(-0.04, 0.04)).getHex();
    B.add(g, c, B.trs(x + rng.range(-0.9, 0.9) * scale, h + rng.range(0.2, 1.4) * scale, z + rng.range(-0.9, 0.9) * scale, rng.range(0, 3)));
  }
}

function shrub(B: Batch, x: number, z: number, rng: Rng): void {
  const r = rng.range(0.5, 1.0);
  B.add(new THREE.IcosahedronGeometry(r, 0), rng.pick([0x4a5e2a, 0x5a6a34, 0x6a6a3a]), B.trs(x, r * 0.6, z, rng.range(0, 3)));
}

/** Cobra-head streetlight. `ry` points the arm over the road. */
export function streetlight(B: Batch, x: number, z: number, ry: number): void {
  B.cyl(0.11, 0.14, 7.5, 6, 0x5a5c5e, x, 3.75, z);
  B.box(0.4, 0.3, 0.4, 0x4a4c4e, x, 0.15, z);
  const ax = Math.cos(ry);
  const az = Math.sin(ry);
  B.box(2.2, 0.1, 0.1, 0x5a5c5e, x + ax * 1.1, 7.4, z + az * 1.1, -ry);
  B.box(0.9, 0.18, 0.4, 0x3a3c3e, x + ax * 2.2, 7.3, z + az * 2.2, -ry);
  B.box(0.7, 0.05, 0.3, 0xe8e0b0, x + ax * 2.2, 7.2, z + az * 2.2, -ry);
}

/** Round 15 #189: a square of soil with a low kerb, for a street tree that has no grass to stand in. */
function treePit(B: Batch, x: number, z: number): void {
  B.box(1.7, 0.07, 1.7, 0x8e8a80, x, 0.035, z);
  B.box(1.35, 0.09, 1.35, 0x4a3a2a, x, 0.045, z);
}

function hydrant(B: Batch, x: number, z: number): void {
  B.cyl(0.15, 0.18, 0.7, 6, 0xb0302a, x, 0.35, z);
  B.box(0.45, 0.12, 0.12, 0xb0302a, x, 0.45, z);
}

export type DecorKind = 'palm' | 'tree' | 'shrub' | 'streetlight' | 'hydrant' | 'pit';
export interface DecorPlacement {
  kind: DecorKind;
  x: number;
  z: number;
  ry: number;
  scale: number;
  seed: number;
}

/** Draw one placement procedurally (used when no glTF model is registered for its kind). */
export function drawDecor(B: Batch, p: DecorPlacement): void {
  const rng = new Rng(p.seed);
  if (p.kind === 'palm') palmTree(B, p.x, p.z, rng, p.scale);
  else if (p.kind === 'tree') leafyTree(B, p.x, p.z, rng, p.scale);
  else if (p.kind === 'shrub') shrub(B, p.x, p.z, rng);
  else if (p.kind === 'streetlight') streetlight(B, p.x, p.z, p.ry);
  else if (p.kind === 'pit') treePit(B, p.x, p.z);
  else hydrant(B, p.x, p.z);
}

/**
 * Street furniture and greenery, placed deterministically from the map: streetlights and palms
 * along sidewalks, trees/shrubs in open scrub. Purely cosmetic: none of it blocks movement.
 * Returns placements so each kind can be drawn procedurally or swapped for a loaded model.
 */
export function scatterDecor(map: CityMap, grid: NavGrid): DecorPlacement[] {
  const out: DecorPlacement[] = [];
  const put = (kind: DecorKind, x: number, z: number, ry = 0, scale = 1) => out.push({ kind, x, z, ry, scale, seed: Math.floor(x * 131 + z * 977) });
  const rng = new Rng(77);
  const tile = (x: number, y: number) => {
    const cx = Math.floor(x / map.cell);
    const cy = Math.floor(y / map.cell);
    return cx < 0 || cy < 0 || cx >= map.cols || cy >= map.rows ? -1 : map.tiles[cy * map.cols + cx];
  };
  const inBase = (x: number, y: number) => x > map.baseRect.x - 6 && x < map.baseRect.x + map.baseRect.w + 6 && y > map.baseRect.y - 6 && y < map.baseRect.y + map.baseRect.h + 6;
  const nearIntersection = (x: number, y: number) =>
    map.roads.some((a) => a.axis === 'v' && x > a.rect.x - 9 && x < a.rect.x + a.rect.w + 9) && map.roads.some((a) => a.axis === 'h' && y > a.rect.y - 9 && y < a.rect.y + a.rect.h + 9);

  for (const road of map.roads) {
    const r = road.rect;
    const horiz = road.axis === 'h';
    const len = horiz ? r.w : r.h;
    for (const side of [-1, 1]) {
      // sidewalk centre line, 1.5 m beyond the road edge
      const off = side < 0 ? -1.5 : (horiz ? r.h : r.w) + 1.5;
      for (let s = 6; s < len; s += 12) {
        const x = horiz ? r.x + s : r.x + off;
        const y = horiz ? r.y + off : r.y + s;
        if (inBase(x, y) || nearIntersection(x, y) || tile(x, y) !== Tile.Sidewalk || grid.isBlockedXY(x, y)) continue;
        const k = Math.round(s / 12);
        if (k % 2 === 0) put('streetlight', x, y, horiz ? (side < 0 ? Math.PI / 2 : -Math.PI / 2) : side < 0 ? 0 : Math.PI);
        else if (rng.chance(0.75)) {
          // round 15 #189: not out of the concrete: on the grass just past the sidewalk if there is some,
          // otherwise in a tree pit
          const out = side < 0 ? -map.cell : map.cell;
          const gx = horiz ? x : x + out;
          const gy = horiz ? y + out : y;
          const g = tile(gx, gy);
          if ((g === Tile.Grass || g === Tile.Dirt) && !grid.isBlockedXY(gx, gy)) put('palm', gx, gy);
          else {
            put('pit', x, y);
            put('palm', x, y);
          }
        }
        if (rng.chance(0.08)) put('hydrant', x + 1.2, y + 0.6);
      }
    }
  }

  // greenery on open ground
  for (let i = 0; i < 700; i++) {
    const x = rng.range(0, map.width);
    const y = rng.range(0, map.height);
    const t = tile(x, y);
    if ((t !== Tile.Grass && t !== Tile.Dirt) || inBase(x, y) || grid.isBlockedXY(x, y)) continue;
    // keep clear of the pavement so trees don't sprout in the road
    if ([[-3, 0], [3, 0], [0, -3], [0, 3]].some(([dx, dy]) => [Tile.Road, Tile.Sidewalk, Tile.Parking].includes(tile(x + dx, y + dy)))) continue;
    const roll = rng.next();
    if (roll < 0.18) put('tree', x, y);
    else if (roll < 0.28) put('palm', x, y, 0, 0.9);
    else if (roll < 0.6) put('shrub', x, y);
  }
  return out;
}

const CAR_TYPES = ['sedan', 'sedan', 'hatch', 'suv', 'pickup', 'van'] as const;

/** One abandoned vehicle as its own batched mesh (so it can be crushed/removed later, doc §6a). */
export function makeCar(p: PropDef): THREE.Mesh {
  const B = new Batch();
  const rng = new Rng(p.id * 131);
  const type = CAR_TYPES[p.id % CAR_TYPES.length];
  const col = new THREE.Color(p.color);
  const dark = col.clone().offsetHSL(0, -0.1, -0.1).getHex();
  const L = type === 'van' ? 5 : type === 'pickup' ? 5.2 : type === 'suv' ? 4.8 : type === 'hatch' ? 4 : 4.6;
  const Wd = type === 'van' || type === 'suv' || type === 'pickup' ? 1.95 : 1.8;
  const bodyH = type === 'van' ? 1.5 : type === 'suv' ? 0.95 : 0.75;
  const flat = (k: number) => (p.id + k) % 5 === 0;
  // wheels (some flat)
  const wx = L / 2 - 0.85;
  for (const [sx, sz, k] of [[wx, Wd / 2 - 0.05, 1], [wx, -Wd / 2 + 0.05, 2], [-wx, Wd / 2 - 0.05, 3], [-wx, -Wd / 2 + 0.05, 4]]) {
    const y = flat(k) ? 0.26 : 0.36;
    B.add(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10).rotateX(Math.PI / 2), 0x1c1c1c, B.trs(sx, y, sz));
    B.add(new THREE.CylinderGeometry(0.19, 0.19, 0.28, 8).rotateX(Math.PI / 2), 0x8a8a86, B.trs(sx, y, sz));
  }
  const y0 = 0.42;
  B.box(L, bodyH, Wd, col, 0, y0 + bodyH / 2, 0);
  // cabin / glasshouse
  if (type === 'pickup') {
    B.box(1.9, 0.75, Wd - 0.15, col, 0.9, y0 + bodyH + 0.37, 0);
    B.box(1.92, 0.45, Wd - 0.13, 0x2b3438, 0.9, y0 + bodyH + 0.45, 0);
    B.box(2.2, 0.35, Wd - 0.1, dark, -1.4, y0 + bodyH + 0.1, 0); // bed walls
    B.box(2.0, 0.1, Wd - 0.3, 0x2a2a2a, -1.4, y0 + bodyH + 0.02, 0);
  } else if (type === 'van') {
    B.box(0.9, 0.6, Wd - 0.1, 0x2b3438, L / 2 - 0.6, y0 + bodyH - 0.45, 0);
    B.box(L - 1.5, 0.5, 0.02, 0x2b3438, -0.4, y0 + bodyH - 0.4, Wd / 2 + 0.01);
  } else {
    const cl = type === 'hatch' ? 2.2 : type === 'suv' ? 2.8 : 2.4;
    const ch = type === 'suv' ? 0.65 : 0.55;
    B.box(cl, ch, Wd - 0.15, col, type === 'hatch' ? -0.4 : -0.2, y0 + bodyH + ch / 2, 0);
    B.box(cl + 0.02, ch * 0.62, Wd - 0.13, 0x2b3438, type === 'hatch' ? -0.4 : -0.2, y0 + bodyH + ch * 0.55, 0);
  }
  // bumpers, lights, mirrors
  B.box(0.14, 0.24, Wd - 0.05, 0x3a3a3a, L / 2, y0 + 0.12, 0);
  B.box(0.14, 0.24, Wd - 0.05, 0x3a3a3a, -L / 2, y0 + 0.12, 0);
  for (const s of [Wd / 2 - 0.35, -Wd / 2 + 0.35]) {
    B.box(0.06, 0.16, 0.36, 0xd8d2b0, L / 2 + 0.02, y0 + bodyH * 0.7, s);
    B.box(0.06, 0.16, 0.3, 0x8a2020, -L / 2 - 0.02, y0 + bodyH * 0.7, s);
    B.box(0.15, 0.12, 0.2, dark, 0.6, y0 + bodyH + 0.15, s + Math.sign(s) * 0.38);
  }
  // abandonment: a door left open, dirt/rust
  if (rng.chance(0.3)) B.box(1.0, bodyH * 0.9, 0.06, col, 0.6, y0 + bodyH / 2, Wd / 2 + 0.5, 0.9);
  if (rng.chance(0.5)) B.box(L * 0.6, 0.02, Wd * 0.6, 0x6a5a40, rng.range(-0.5, 0.5), y0 + bodyH + (type === 'pickup' || type === 'van' ? 0.02 : 0.6), 0);
  const mesh = B.build();
  mesh.position.set(p.pos.x, 0, p.pos.y);
  mesh.rotation.y = (p.h > p.w ? Math.PI / 2 : 0) + ((p.id % 7) - 3) * 0.05 + (p.id % 2 ? Math.PI : 0);
  return mesh;
}

/** A gas-pump island (v4.10, Gas Station Strip): kerbed island, two pump cabinets, bollards. */
export function makePumpIsland(p: PropDef): THREE.Mesh {
  const B = new Batch();
  const L = p.w * 3; // footprint in metres (2 cells)
  B.box(L - 0.4, 0.2, 1.6, 0xb8b4a8, 0, 0.1, 0); // kerbed island
  for (const x of [-L / 4, L / 4]) {
    B.box(0.8, 1.6, 0.55, 0xd8d4c8, x, 1.0, 0); // pump cabinet
    B.box(0.82, 0.35, 0.57, p.color, x, 1.55, 0); // branded top
    B.box(0.5, 0.35, 0.05, 0x2b3438, x, 1.1, 0.29); // display
    B.box(0.06, 0.5, 0.06, 0x1c1c1c, x + 0.3, 0.9, 0.3); // nozzle
  }
  for (const x of [-L / 2 + 0.25, L / 2 - 0.25]) B.box(0.18, 0.8, 0.18, 0xd8b030, x, 0.5, 0); // bollards
  const mesh = B.build();
  mesh.position.set(p.pos.x, 0, p.pos.y);
  if (p.h > p.w) mesh.rotation.y = Math.PI / 2;
  return mesh;
}

/** Forecourt canopy: a flat roof on four posts with a branded fascia (walkable underneath). */
export function drawCanopy(B: Batch, r: { x: number; y: number; w: number; h: number }): void {
  const cx = r.x + r.w / 2;
  const cz = r.y + r.h / 2;
  const H = 5.2;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B.box(0.4, H, 0.4, 0xd8d4c8, cx + sx * (r.w / 2 - 2), H / 2, cz + sz * (r.h / 2 - 1.5));
  B.box(r.w, 0.35, r.h, 0xe8e6e0, cx, H + 0.2, cz); // roof slab
  B.box(r.w + 0.1, 0.7, r.h + 0.1, 0xb83a2a, cx, H + 0.55, cz); // fascia band
  B.box(r.w - 0.5, 0.12, r.h - 0.5, 0xf4f2ea, cx, H - 0.02, cz); // light panel underside
}

/** The fence line closing off a locked tutorial region: chain-link with jersey barriers across the roads. */
export function makeBorder(map: CityMap, r: { x: number; y: number; w: number; h: number }): THREE.Mesh {
  const B = new Batch();
  const vertical = r.h > r.w;
  const len = vertical ? r.h : r.w;
  const at = (s: number) => (vertical ? { x: r.x + r.w / 2, z: r.y + s } : { x: r.x + s, z: r.y + r.h / 2 });
  const tile = (x: number, z: number) => map.tiles[Math.floor(z / map.cell) * map.cols + Math.floor(x / map.cell)];
  const ry = vertical ? Math.PI / 2 : 0;
  for (let s = 0; s < len; s += 3) {
    const p = at(s + 1.5);
    const road = tile(p.x, p.z) === Tile.Road;
    if (road) {
      B.box(2.8, 0.85, 0.6, 0xb8b4aa, p.x, 0.42, p.z, ry); // jersey barrier
      B.box(2.8, 0.12, 0.62, 0xc84a2a, p.x, 0.75, p.z, ry); // red stripe
    } else {
      const q = at(s);
      B.box(0.1, 2.4, 0.1, 0x6a6a66, q.x, 1.2, q.z); // post
      B.box(3, 2.1, 0.03, 0x8a8a84, p.x, 1.2, p.z, ry); // mesh panel
      B.box(3, 0.06, 0.06, 0x6a6a66, p.x, 2.35, p.z, ry); // top rail
    }
  }
  // a "ROAD CLOSED" sign on the main road
  const mid = map.roads.find((x) => x.axis === 'h');
  if (mid) {
    const p = vertical ? { x: r.x - 2, z: mid.rect.y + mid.rect.h / 2 } : { x: r.x, z: r.y };
    B.box(0.1, 1.6, 0.1, 0x3a3a3a, p.x, 0.8, p.z - 1.2);
    B.box(0.1, 1.6, 0.1, 0x3a3a3a, p.x, 0.8, p.z + 1.2);
    B.box(0.08, 0.9, 3, 0xe0b030, p.x, 1.9, p.z);
    B.box(0.1, 0.25, 2.8, 0x1c1c1c, p.x, 1.9, p.z);
  }
  return B.build();
}
