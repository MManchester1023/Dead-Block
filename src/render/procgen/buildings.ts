import * as THREE from 'three';
import { Rng } from '../../core/rng';
import { Tile, type BuildingDef, type CityMap } from '../../sim/map';
import { Batch, gableRoof } from './batch';
import { leafyTree, palmTree } from './props';

/**
 * Procedural buildings for the doc §14 target look: suburban houses with pitched roofs, porches,
 * yards and fences; apartment blocks with balconies and rooftop clutter; a two-storey motel with
 * an exterior walkway; shops with awnings; a corrugated warehouse.
 *
 * Each generator works in a canonical frame — footprint centred on the origin, frontage along
 * local X, **front facing +Z** — and the caller rotates it to face the street.
 */

const WALLS_HOUSE = [0xe8dcc0, 0xeeeae2, 0xd8c4a0, 0xb8c8cc, 0xbcc2a2, 0xe2bc9a, 0xc9b79a];
const ROOFS = [0xa9533a, 0x9a4630, 0x4c4c52, 0x6a4a38, 0x6e6e72, 0xb46a42];
const WALLS_APT = [0x8e5040, 0xb8b2a6, 0xc8b48a, 0xa4a89c, 0x9a6a52];
const TRIM = 0xf0ece4;
const GLASS = 0x2e3c46;
const GLASS_LIT = 0x8a9aa0;
const FLOOR_H = 3.2;

type Side = 'n' | 's' | 'e' | 'w';

/** Which side faces the most street/parking — that's the front. */
export function frontOf(map: CityMap, b: BuildingDef): Side {
  const c = b.cells;
  const score = (t: number) => (t === Tile.Parking ? 3 : t === Tile.Road || t === Tile.Sidewalk ? 2 : t === Tile.Building ? -1 : 0.3);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= map.cols || y >= map.rows ? -2 : score(map.tiles[y * map.cols + x]));
  const sides: Record<Side, number> = { n: 0, s: 0, e: 0, w: 0 };
  for (let x = c.x; x < c.x + c.w; x++) {
    for (let k = 1; k <= 3; k++) {
      sides.n += at(x, c.y - k) / k;
      sides.s += at(x, c.y + c.h - 1 + k) / k;
    }
  }
  for (let y = c.y; y < c.y + c.h; y++) {
    for (let k = 1; k <= 3; k++) {
      sides.w += at(c.x - k, y) / k;
      sides.e += at(c.x + c.w - 1 + k, y) / k;
    }
  }
  // normalise by edge length so long walls don't automatically win
  sides.n /= c.w;
  sides.s /= c.w;
  sides.e /= c.h;
  sides.w /= c.h;
  return (Object.entries(sides) as [Side, number][]).sort((a, b) => b[1] - a[1])[0][0];
}

/** Build every building into one batch. */
export function buildCity(map: CityMap, out: Batch): void {
  for (const b of map.buildings) {
    const side = frontOf(map, b);
    const rot = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[side];
    const along = side === 'n' || side === 's';
    const frontage = along ? b.rect.w : b.rect.h;
    const depth = along ? b.rect.h : b.rect.w;
    const rng = new Rng(b.id * 7919 + 17);
    const local = new Batch();
    switch (b.kind) {
      case 'houses':
        houses(local, frontage, depth, b.floors, rng);
        break;
      case 'apartment':
        apartment(local, frontage, depth, b.floors, rng);
        break;
      case 'motel':
        motel(local, frontage, depth, rng, b.id === 1);
        break;
      case 'shop':
        shop(local, frontage, depth, rng);
        break;
      case 'warehouse':
        warehouse(local, frontage, depth, rng);
        break;
    }
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(b.rect.x + b.rect.w / 2, 0, b.rect.y + b.rect.h / 2),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot),
      new THREE.Vector3(1, 1, 1),
    );
    local.transferTo(out, m);
  }
}

// ---------------------------------------------------------------- shared bits

/** Windows along one face of a box (canonical frame). face: which wall; span = wall length. */
function windows(B: Batch, face: 'front' | 'back' | 'left' | 'right', cx: number, cz: number, w: number, d: number, floors: number, rng: Rng, opts: { bay?: number; y0?: number; skipGround?: boolean; ww?: number; wh?: number } = {}): void {
  const bay = opts.bay ?? 3.2;
  const ww = opts.ww ?? 1.2;
  const wh = opts.wh ?? 1.4;
  const len = face === 'front' || face === 'back' ? w : d;
  const n = Math.max(1, Math.floor((len - 1) / bay));
  const start = -((n - 1) * bay) / 2;
  for (let f = opts.skipGround ? 1 : 0; f < floors; f++) {
    const y = (opts.y0 ?? 0) + f * FLOOR_H + 1.7;
    for (let i = 0; i < n; i++) {
      const t = start + i * bay;
      const lit = rng.chance(0.06);
      const broken = rng.chance(0.12);
      const glass = lit ? GLASS_LIT : broken ? 0x141414 : GLASS;
      let x = cx;
      let z = cz;
      let ry = 0;
      if (face === 'front') (x = cx + t), (z = cz + d / 2 + 0.06);
      if (face === 'back') (x = cx + t), (z = cz - d / 2 - 0.06);
      if (face === 'left') (x = cx - w / 2 - 0.06), (z = cz + t), (ry = Math.PI / 2);
      if (face === 'right') (x = cx + w / 2 + 0.06), (z = cz + t), (ry = Math.PI / 2);
      B.box(ww + 0.24, wh + 0.24, 0.1, TRIM, x, y, z, ry); // frame
      B.box(ww, wh, 0.16, glass, x, y, z, ry);
      if (rng.chance(0.25)) B.box(ww + 0.3, 0.12, 0.3, TRIM, x, y - wh / 2 - 0.12, z, ry); // sill
    }
  }
}

function railing(B: Batch, x0: number, x1: number, y: number, z: number, color = TRIM): void {
  const len = x1 - x0;
  B.box(len, 0.08, 0.08, color, (x0 + x1) / 2, y + 1.0, z);
  B.box(len, 0.05, 0.05, color, (x0 + x1) / 2, y + 0.5, z);
  for (let x = x0; x <= x1 + 0.01; x += 1.2) B.box(0.08, 1.0, 0.08, color, x, y + 0.5, z);
}

function fence(B: Batch, x0: number, z0: number, x1: number, z1: number, color: number, picket: boolean): void {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ry = -Math.atan2(z1 - z0, x1 - x0);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  if (picket) {
    B.box(len, 0.08, 0.06, color, cx, 0.75, cz, ry);
    B.box(len, 0.08, 0.06, color, cx, 0.35, cz, ry);
    const n = Math.floor(len / 0.4);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      B.box(0.12, 1.0, 0.04, color, x0 + (x1 - x0) * t, 0.5, z0 + (z1 - z0) * t, ry);
    }
  } else {
    B.box(len, 1.7, 0.08, color, cx, 0.85, cz, ry); // board fence
    const n = Math.floor(len / 2.4);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      B.box(0.14, 1.8, 0.14, new THREE.Color(color).offsetHSL(0, 0, -0.08).getHex(), x0 + (x1 - x0) * t, 0.9, z0 + (z1 - z0) * t);
    }
  }
}

// ---------------------------------------------------------------- houses

function houses(B: Batch, frontage: number, depth: number, floors: number, rng: Rng): void {
  const lots = Math.max(1, Math.min(3, Math.round(frontage / 13)));
  const lw = frontage / lots;
  for (let i = 0; i < lots; i++) {
    const cx = -frontage / 2 + lw * (i + 0.5);
    house(B, cx, lw, depth, Math.max(1, floors - (rng.chance(0.3) ? 1 : 0)), rng);
  }
}

function house(B: Batch, cx: number, lw: number, ld: number, floors: number, rng: Rng): void {
  const wall = rng.pick(WALLS_HOUSE);
  const roof = rng.pick(ROOFS);
  const lawn = new THREE.Color(0x5e7a3a).offsetHSL(rng.range(-0.02, 0.02), 0, rng.range(-0.04, 0.03)).getHex();
  B.box(lw - 0.1, 0.06, ld - 0.1, lawn, cx, 0.03, 0);

  // fence round the back and sides; front left open with a gate gap
  const picket = rng.chance(0.4);
  const fc = picket ? 0xe8e4dc : rng.pick([0x8a6a48, 0x7a5a3c, 0x9a7a58]);
  const x0 = cx - lw / 2 + 0.2;
  const x1 = cx + lw / 2 - 0.2;
  const zb = -ld / 2 + 0.2;
  const zf = ld / 2 - 0.2;
  fence(B, x0, zb, x1, zb, fc, picket);
  fence(B, x0, zb, x0, zf, fc, picket);
  fence(B, x1, zb, x1, zf, fc, picket);
  if (picket) {
    fence(B, x0, zf, cx - 1.2, zf, fc, true);
    fence(B, cx + 2.8, zf, x1, zf, fc, true);
  }

  // house body
  const hw = Math.min(lw - 3.5, 7 + rng.range(0, 3));
  const hd = Math.min(ld - 7, 7 + rng.range(0, 2.5));
  const hx = cx + rng.range(-0.8, 0.8);
  const hz = ld / 2 - 3.2 - hd / 2; // set back from the street
  const H = floors * FLOOR_H;
  B.box(hw, 0.4, hd, 0x9a9488, hx, 0.2, hz); // foundation
  B.box(hw, H, hd, wall, hx, H / 2 + 0.2, hz);
  B.box(hw + 0.1, 0.18, hd + 0.1, TRIM, hx, H + 0.1, hz); // eave trim
  if (floors > 1) B.box(hw + 0.06, 0.12, hd + 0.06, new THREE.Color(wall).offsetHSL(0, 0, -0.08).getHex(), hx, FLOOR_H + 0.2, hz); // floor line
  windows(B, 'front', hx, hz, hw, hd, floors, rng, { y0: 0.2 });
  windows(B, 'back', hx, hz, hw, hd, floors, rng, { y0: 0.2 });
  windows(B, 'left', hx, hz, hw, hd, floors, rng, { y0: 0.2, bay: 3.6 });
  windows(B, 'right', hx, hz, hw, hd, floors, rng, { y0: 0.2, bay: 3.6 });
  // front door
  B.box(1.0, 2.1, 0.14, rng.pick([0x6a3a2a, 0x2a4a5a, 0x3a5a3a, 0xf0ece4]), hx + hw * 0.18, 1.25, hz + hd / 2 + 0.06);

  // pitched roof (ridge along the longer side), occasionally a cross-gable
  const ridgeAlongX = hw >= hd;
  const rise = 1.8 + rng.range(0, 1.2);
  B.add(gableRoof(ridgeAlongX ? hw : hd, ridgeAlongX ? hd : hw, rise, 0.5), roof, B.trs(hx, H + 0.2, hz, ridgeAlongX ? 0 : Math.PI / 2));
  // shingle courses
  const rc = new THREE.Color(roof).offsetHSL(0, 0, -0.06).getHex();
  const half = (ridgeAlongX ? hd : hw) / 2 + 0.5;
  const slope = Math.atan2(rise, half);
  for (let k = 1; k < 4; k++) {
    const t = k / 4;
    for (const sgn of [-1, 1]) {
      const off = sgn * half * (1 - t);
      const y = H + 0.2 + rise * t + 0.03;
      if (ridgeAlongX) B.box(hw + 1, 0.05, 0.12, rc, hx, y, hz + off, 0, -sgn * slope);
      else B.box(0.12, 0.05, hd + 1, rc, hx + off, y, hz, 0, 0, -sgn * slope);
    }
  }

  // porch with its own little roof on posts
  if (rng.chance(0.75)) {
    const pw = hw * rng.range(0.5, 0.8);
    const pz = hz + hd / 2 + 1.1;
    B.box(pw, 0.3, 2.2, 0xb0a898, hx, 0.35, pz);
    for (const px of [hx - pw / 2 + 0.15, hx + pw / 2 - 0.15]) B.box(0.18, 2.6, 0.18, TRIM, px, 1.6, pz + 0.95);
    B.box(pw + 0.4, 0.18, 2.6, roof, hx, 2.95, pz + 0.1, 0, -0.18);
    if (floors > 1 && rng.chance(0.4)) railing(B, hx - pw / 2, hx + pw / 2, 3.05, pz + 1.15); // balcony on the porch roof
  }
  // attached garage + driveway
  if (rng.chance(0.45) && lw - hw > 5.2) {
    const gx = hx + (hw / 2 + 2.3) * (rng.chance(0.5) ? 1 : -1);
    const gz = hz + hd / 2 - 3;
    B.box(4.4, 3, 6, wall, gx, 1.7, gz);
    B.box(3.4, 2.3, 0.1, 0xd8d4c8, gx, 1.35, gz + 3.05);
    for (let y = 0.6; y < 2.4; y += 0.45) B.box(3.4, 0.04, 0.12, 0xb8b4a8, gx, y, gz + 3.06);
    B.add(gableRoof(6, 4.4, 1.2, 0.3), roof, B.trs(gx, 3.2, gz, Math.PI / 2));
    B.box(3.4, 0.05, ld / 2 - gz - 3, 0x9a968c, gx, 0.04, (gz + 3 + ld / 2) / 2);
  } else {
    B.box(1.2, 0.05, ld / 2 - (hz + hd / 2), 0xa8a294, hx + hw * 0.18, 0.04, (hz + hd / 2 + ld / 2) / 2); // front path
  }
  if (rng.chance(0.45)) B.box(0.8, rise + 1.5, 0.8, 0x7a4636, hx - hw * 0.3, H + 0.2 + rise * 0.55, hz - hd * 0.15); // chimney
  if (rng.chance(0.25)) {
    // pool in the backyard
    const pz = -ld / 2 + 3.2;
    B.box(4.6, 0.1, 2.6, 0xd8d4c8, cx + rng.range(-1, 1), 0.06, pz);
    B.box(4.0, 0.12, 2.0, 0x3a8aa8, cx + rng.range(-1, 1), 0.08, pz);
  }
  // a tree in the yard
  const tx = cx + (rng.chance(0.5) ? -1 : 1) * (lw / 2 - 2.2);
  const tz = rng.chance(0.5) ? ld / 2 - 1.8 : -ld / 2 + 2;
  if (rng.chance(0.4)) palmTree(B, tx, tz, rng);
  else if (rng.chance(0.8)) leafyTree(B, tx, tz, rng, 0.8);
  // hedges along the front
  if (rng.chance(0.5)) B.box(hw * 0.4, 0.9, 0.9, 0x3e5a2a, hx - hw * 0.25, 0.45, hz + hd / 2 + 0.8);
}

// ---------------------------------------------------------------- apartments

function apartment(B: Batch, frontage: number, depth: number, floors: number, rng: Rng): void {
  const wall = rng.pick(WALLS_APT);
  const band = new THREE.Color(wall).offsetHSL(0, 0, -0.1).getHex();
  const w = frontage - 2;
  const d = depth - 3;
  const z = -0.5;
  const H = floors * FLOOR_H;
  B.box(frontage, 0.08, depth, 0x8a8a84, 0, 0.04, 0); // forecourt
  B.box(w, H, d, wall, 0, H / 2, z);
  for (let f = 1; f < floors; f++) B.box(w + 0.15, 0.25, d + 0.15, band, 0, f * FLOOR_H, z); // floor bands
  B.box(w + 0.3, 0.6, d + 0.3, band, 0, 0.3, z); // plinth
  windows(B, 'front', 0, z, w, d, floors, rng, { bay: 3.4, ww: 1.5 });
  windows(B, 'back', 0, z, w, d, floors, rng, { bay: 3.4, ww: 1.5 });
  windows(B, 'left', 0, z, w, d, floors, rng, { bay: 3.4 });
  windows(B, 'right', 0, z, w, d, floors, rng, { bay: 3.4 });
  // balconies on the front, every other bay
  const n = Math.floor((w - 1) / 3.4);
  for (let f = 1; f < floors; f++)
    for (let i = 0; i < n; i += 2) {
      const x = -((n - 1) * 3.4) / 2 + i * 3.4;
      const y = f * FLOOR_H;
      B.box(2.6, 0.2, 1.3, 0xb0aca2, x, y, z + d / 2 + 0.65);
      railing(B, x - 1.3, x + 1.3, y + 0.1, z + d / 2 + 1.28, 0x5a5a5a);
    }
  // entrance canopy + door
  B.box(4, 0.25, 2.2, 0x4a4a4a, 0, 3, z + d / 2 + 1.1);
  B.box(2.2, 2.4, 0.15, 0x2a2e32, 0, 1.2, z + d / 2 + 0.08);
  // roof: parapet, AC units, water tank or stair tower, sometimes solar panels
  B.box(w, 0.9, 0.3, band, 0, H + 0.45, z + d / 2 - 0.15);
  B.box(w, 0.9, 0.3, band, 0, H + 0.45, z - d / 2 + 0.15);
  B.box(0.3, 0.9, d, band, -w / 2 + 0.15, H + 0.45, z);
  B.box(0.3, 0.9, d, band, w / 2 - 0.15, H + 0.45, z);
  for (let i = 0; i < 2 + rng.int(0, 2); i++) B.box(1.8, 1.2, 1.4, 0x9a9c98, rng.range(-w / 3, w / 3), H + 0.6, z + rng.range(-d / 4, d / 4));
  if (rng.chance(0.5)) {
    B.cyl(1.2, 1.2, 2.4, 10, 0x7a7466, w / 4, H + 2.6, z - d / 4);
    for (const [ox, oz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) B.box(0.15, 1.4, 0.15, 0x4a4a4a, w / 4 + ox, H + 0.7, z - d / 4 + oz);
  } else B.box(3.2, 3, 3.6, wall, -w / 4, H + 1.5, z - d / 5);
  if (rng.chance(0.5)) for (let i = 0; i < 4; i++) B.box(2.2, 0.08, 1.2, 0x23314a, -w / 4 + (i % 2) * 2.5, H + 0.6, z + d / 5 + Math.floor(i / 2) * 1.5, 0, -0.35);
  // planters along the forecourt
  for (const x of [-w / 2 + 1.5, w / 2 - 1.5]) {
    B.box(2.4, 0.6, 1.0, 0x8a8478, x, 0.3, depth / 2 - 0.8);
    B.box(2.2, 0.5, 0.8, 0x3e5a2a, x, 0.75, depth / 2 - 0.8);
  }
}

// ---------------------------------------------------------------- motel

function motel(B: Batch, frontage: number, depth: number, rng: Rng, withSign: boolean): void {
  const wall = 0xe4d4b0;
  const trim = 0x8a5a3a;
  const w = frontage - 1;
  const d = Math.min(depth - 4, 10);
  const z = -depth / 2 + d / 2 + 0.5;
  const H = 2 * FLOOR_H;
  B.box(w, H, d, wall, 0, H / 2, z);
  B.box(w + 0.1, 0.3, d + 0.1, trim, 0, FLOOR_H, z);
  // room doors + windows facing the walkway
  const room = 4;
  const n = Math.floor(w / room);
  const doorCols = [0x2f6a6a, 0x8a3a2a, 0x2f6a6a, 0x3a5a7a];
  for (let f = 0; f < 2; f++)
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + room * (i + 0.5);
      const y = f * FLOOR_H;
      B.box(0.95, 2.1, 0.12, doorCols[(i + f) % doorCols.length], x - 0.9, y + 1.05, z + d / 2 + 0.06);
      B.box(1.6, 1.1, 0.14, rng.chance(0.15) ? 0x141414 : GLASS, x + 0.7, y + 1.6, z + d / 2 + 0.06);
      if (rng.chance(0.4)) B.box(0.7, 0.9, 0.5, 0xb8b0a0, x + 0.7, y + 0.45, z + d / 2 + 0.5); // ice machine / AC box
    }
  // upper walkway with railing, columns down to the ground, stairs at both ends
  const wz = z + d / 2 + 1.1;
  B.box(w, 0.25, 2.2, 0xb0a894, 0, FLOOR_H, wz);
  railing(B, -w / 2, w / 2, FLOOR_H + 0.12, wz + 1.05, 0xf0ece4);
  for (let x = -w / 2 + 0.3; x <= w / 2; x += room) B.box(0.3, FLOOR_H, 0.3, TRIM, x, FLOOR_H / 2, wz + 0.95);
  for (const sx of [-w / 2 - 1.2, w / 2 + 1.2]) {
    for (let k = 0; k < 10; k++) B.box(1.2, 0.18, 0.4, 0xa8a090, sx, 0.2 + k * (FLOOR_H / 10), wz + 1 - k * 0.32);
  }
  // mansard-ish roof
  B.add(gableRoof(w, d, 1.6, 0.6), 0x6a4a38, B.trs(0, H, z));
  if (withSign) {
    const sx = w / 2 + 2.5;
    const sz = depth / 2 - 1;
    B.box(0.4, 7, 0.4, 0x5a5a5a, sx, 3.5, sz);
    B.box(4.6, 1.6, 0.4, 0xb0302a, sx, 7.2, sz);
    B.box(4.2, 1.2, 0.42, 0xe8d8a0, sx, 7.2, sz);
    B.box(3.4, 0.8, 0.3, 0x2a6a6a, sx, 5.8, sz);
  }
}

// ---------------------------------------------------------------- shop

function shop(B: Batch, frontage: number, depth: number, rng: Rng): void {
  const wall = rng.pick([0xd8c8a8, 0xc8bca4, 0xe0d6c0, 0xa8b0a0]);
  const w = frontage - 1;
  const d = Math.max(4, depth - 2);
  const z = -depth / 2 + d / 2;
  const H = 4.6;
  B.box(w, H, d, wall, 0, H / 2, z);
  B.box(w, 1.2, 0.4, new THREE.Color(wall).offsetHSL(0, 0, -0.08).getHex(), 0, H + 0.6, z + d / 2 - 0.2); // parapet
  B.box(Math.min(w - 2, 9), 0.9, 0.12, rng.pick([0xb0302a, 0x2a5a8a, 0x3a7a3a, 0xc89a2a]), 0, H + 0.5, z + d / 2 + 0.05); // sign board
  // storefront glass with mullions, a door in the middle
  B.box(w - 1.5, 2.4, 0.12, GLASS, 0, 1.6, z + d / 2 + 0.05);
  for (let x = -w / 2 + 1; x < w / 2; x += 2.2) B.box(0.12, 2.6, 0.18, 0x3a3a3a, x, 1.6, z + d / 2 + 0.07);
  B.box(1.8, 2.3, 0.18, 0x5a6670, 0, 1.15, z + d / 2 + 0.08);
  // striped awning
  const stripes = Math.floor(w / 0.8);
  const ac = rng.pick([[0xb0302a, 0xe8e0d0], [0x2a6a5a, 0xe8e0d0], [0x2a4a7a, 0xd8d0c0]]);
  for (let i = 0; i < stripes; i++) B.box(0.8, 0.08, 1.8, ac[i % 2], -w / 2 + 0.4 + i * 0.8, 3.3, z + d / 2 + 0.85, 0, -0.32);
  for (let i = 0; i < 2; i++) B.box(1.6, 1.0, 1.2, 0x9a9c98, rng.range(-w / 3, w / 3), H + 0.5, z - d / 4);
  // a dumpster round the back
  B.box(2, 1.3, 1.2, 0x2f5a3a, w / 2 - 2, 0.65, z - d / 2 - 0.8);
}

// ---------------------------------------------------------------- warehouse

function warehouse(B: Batch, frontage: number, depth: number, rng: Rng): void {
  const wall = rng.pick([0x8a8e88, 0x9a8e78, 0x7a8288]);
  const rib = new THREE.Color(wall).offsetHSL(0, 0, -0.07).getHex();
  const w = frontage - 1;
  const d = depth - 3;
  const z = -1;
  const H = 7;
  B.box(w, H, d, wall, 0, H / 2, z);
  for (let x = -w / 2; x <= w / 2; x += 0.7) {
    B.box(0.18, H, 0.06, rib, x, H / 2, z + d / 2 + 0.03);
    B.box(0.18, H, 0.06, rib, x, H / 2, z - d / 2 - 0.03);
  }
  for (let t = -d / 2; t <= d / 2; t += 0.7) {
    B.box(0.06, H, 0.18, rib, -w / 2 - 0.03, H / 2, z + t);
    B.box(0.06, H, 0.18, rib, w / 2 + 0.03, H / 2, z + t);
  }
  // roll-up doors + loading dock
  const doors = Math.max(1, Math.floor(w / 8));
  for (let i = 0; i < doors; i++) {
    const x = -w / 2 + (w / doors) * (i + 0.5);
    B.box(4.2, 4.6, 0.12, 0x5a5e60, x, 2.3, z + d / 2 + 0.1);
    for (let y = 0.5; y < 4.6; y += 0.4) B.box(4.0, 0.05, 0.14, 0x6a6e70, x, y, z + d / 2 + 0.12);
    B.box(4.8, 0.3, 0.3, 0xc8a83a, x, 4.75, z + d / 2 + 0.15);
  }
  B.box(w, 1.1, 2.4, 0x8a8a84, 0, 0.55, z + d / 2 + 1.2);
  B.add(gableRoof(w, d, 1.4, 0.4), 0x7a7e80, B.trs(0, H, z));
  for (let i = 0; i < 3; i++) B.box(2, 0.3, 1.2, 0xb8c4c8, -w / 3 + i * (w / 3), H + 0.6, z + d / 5, 0, 0.18); // skylights
}
