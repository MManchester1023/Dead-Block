import type { Rect, Vec2 } from '../core/math';
import { Rng } from '../core/rng';
import { CELL } from '../config/world';

export enum Tile {
  Dirt = 0,
  Road = 1,
  Sidewalk = 2,
  BaseConcrete = 3,
  Parking = 4,
  Building = 5,
  Grass = 6,
}

export interface BuildingDef {
  id: number;
  /** metres */
  rect: Rect;
  /** nav cells covered */
  cells: Rect;
  /** metres */
  height: number;
  color: number;
  /** Future: hp for collapse (doc §6a), rooftop slots (doc §5). */
  hp: number;
  roofCapacity: number;
}

export interface PropDef {
  id: number;
  kind: 'car';
  pos: Vec2; // centre, metres
  w: number; // metres (real car footprint, ~4.6 × 1.9)
  h: number;
  cells: Rect; // nav cells blocked
  color: number;
  cover: number;
  /** Tanks crush these (doc §6a, Tier 2). */
  crushable: boolean;
}

export interface DistrictDef {
  id: string;
  name: string;
  rect: Rect;
  starter: boolean;
  /** Spawn site for the district's hive, if any. */
  hiveSites: Vec2[];
  initialInfestation: number;
  /** Starting zombies per infestation point, and the mix (doc §2 table: who lives where). */
  density: number;
  mix: Record<string, number>;
}

/** Everything in metres except `tiles` / `cols` / `rows` / `*Cells`, which are nav-grid cells. */
export interface CityMap {
  width: number;
  height: number;
  cols: number;
  rows: number;
  cell: number;
  tiles: Uint8Array;
  baseCells: Rect;
  buildings: BuildingDef[];
  props: PropDef[];
  districts: DistrictDef[];
  baseRect: Rect;
  baseGate: Rect;
  rally: Vec2;
}

/**
 * MVP slice of the city: the main base plus one starter zone (Roadside Motel), doc §15.
 * Authored on the nav grid (64 × 64 cells = 192 × 192 m at 3 m cells), then converted to metres.
 * The map is one continuous grid; later districts get appended to the east/north as the city grows.
 */
export function buildStarterMap(seed = 7): CityMap {
  const rng = new Rng(seed);
  const width = 104;
  const height = 72;
  const tiles = new Uint8Array(width * height).fill(Tile.Dirt);
  const set = (x: number, y: number, t: Tile) => {
    if (x >= 0 && y >= 0 && x < width && y < height) tiles[y * width + x] = t;
  };
  const fill = (r: Rect, t: Tile) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) set(x, y, t);
  };

  // scrubby grass in clumps rather than salt-and-pepper noise
  for (let c = 0; c < 70; c++) {
    const cx = rng.int(0, width - 1);
    const cy = rng.int(0, height - 1);
    const r = rng.range(1.5, 4.5);
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && rng.chance(0.8)) set(x, y, Tile.Grass);
  }

  const baseRect: Rect = { x: 2, y: 16, w: 28, h: 40 };
  fill(baseRect, Tile.BaseConcrete);

  // main east-west road + sidewalks
  fill({ x: 0, y: 33, w: width, h: 1 }, Tile.Sidewalk);
  fill({ x: 0, y: 34, w: width, h: 4 }, Tile.Road);
  fill({ x: 0, y: 38, w: width, h: 1 }, Tile.Sidewalk);
  fill({ x: 2, y: 34, w: 28, h: 4 }, Tile.BaseConcrete);
  // north-south roads in the zone
  for (const rx of [56, 86]) {
    fill({ x: rx - 1, y: 4, w: 1, h: 64 }, Tile.Sidewalk);
    fill({ x: rx, y: 4, w: 4, h: 64 }, Tile.Road);
    fill({ x: rx + 4, y: 4, w: 1, h: 64 }, Tile.Sidewalk);
  }
  // motel parking + other lots
  const lots: Rect[] = [
    { x: 62, y: 14, w: 16, h: 16 },
    { x: 40, y: 40, w: 14, h: 6 },
    { x: 91, y: 50, w: 11, h: 14 },
    { x: 66, y: 40, w: 16, h: 4 },
  ];
  lots.forEach((r) => fill(r, Tile.Parking));

  const buildings: BuildingDef[] = [];
  const palette = [0x6f6a60, 0x7a7266, 0x5f6466, 0x8a7f6c, 0x6a5e55, 0x73786f];
  const addB = (rect: Rect, height: number) => {
    buildings.push({ id: buildings.length + 1, rect, cells: { ...rect }, height, color: rng.pick(palette), hp: 800 * height, roofCapacity: Math.max(1, Math.floor((rect.w * rect.h) / 12)) });
    fill(rect, Tile.Building);
  };
  // Roadside Motel: north wing + east wing around the parking lot
  addB({ x: 62, y: 9, w: 20, h: 5 }, 3);
  addB({ x: 78, y: 14, w: 5, h: 15 }, 3);
  addB({ x: 62, y: 30, w: 8, h: 2 }, 1.5); // motel office
  // scattered roadside buildings
  addB({ x: 42, y: 8, w: 9, h: 8 }, 2.5);
  addB({ x: 42, y: 20, w: 7, h: 9 }, 2);
  addB({ x: 42, y: 47, w: 10, h: 8 }, 3.5);
  addB({ x: 42, y: 59, w: 7, h: 7 }, 2);
  addB({ x: 63, y: 46, w: 9, h: 7 }, 2.5);
  addB({ x: 74, y: 47, w: 8, h: 10 }, 4);
  addB({ x: 64, y: 57, w: 6, h: 8 }, 2);
  addB({ x: 92, y: 8, w: 9, h: 10 }, 5);
  addB({ x: 92, y: 22, w: 8, h: 8 }, 3);
  addB({ x: 92, y: 41, w: 9, h: 6 }, 2.5);

  // abandoned cars: in lots and stalled on roads (cover, doc §5)
  const props: PropDef[] = [];
  const carColors = [0x8b3a2f, 0x3f5a6b, 0xb0a890, 0x2f2f2f, 0x5b6b3a, 0x9a8a5a, 0x6b4a6b];
  const blockedByProp = new Set<number>();
  const addCar = (cx: number, cy: number, horizontal: boolean) => {
    const w = horizontal ? 2 : 1;
    const h = horizontal ? 1 : 2;
    const x0 = Math.floor(cx - w / 2);
    const y0 = Math.floor(cy - h / 2);
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        if (tiles[y * width + x] === Tile.Building || blockedByProp.has(y * width + x)) return;
      }
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) blockedByProp.add(y * width + x);
    props.push({ id: 10000 + props.length, kind: 'car', pos: { x: x0 + w / 2, y: y0 + h / 2 }, w, h, cells: { x: x0, y: y0, w, h }, color: rng.pick(carColors), cover: 0.4, crushable: true });
  };
  for (let x = 64; x < 77; x += 3) {
    if (rng.chance(0.75)) addCar(x + 1, 16, false);
    if (rng.chance(0.6)) addCar(x + 1, 27, false);
  }
  for (let i = 0; i < 4; i++) addCar(rng.int(41, 52), rng.int(41, 44), true);
  for (let i = 0; i < 5; i++) addCar(rng.int(92, 100), rng.int(51, 62), rng.chance(0.5));
  // stalled traffic on the main road — the first cover the player meets
  for (const x of [36, 41, 47, 52, 63, 70, 79, 92, 99]) addCar(x, rng.chance(0.5) ? 35 : 37, true);
  for (const y of [12, 22, 45, 58]) addCar(rng.chance(0.5) ? 57 : 59, y, false);
  for (const y of [15, 28, 55]) addCar(rng.chance(0.5) ? 87 : 89, y, false);

  const districts: DistrictDef[] = [
    { id: 'base', name: 'Main Base', rect: baseRect, starter: true, hiveSites: [], initialInfestation: 0, density: 0, mix: {} },
    { id: 'motel', name: 'Roadside Motel', rect: { x: 38, y: 4, w: 64, h: 64 }, starter: true, hiveSites: [{ x: 96, y: 58 }], initialInfestation: 65,
      // doc §2: "Starter district; Walkers" — a few early Runners and one or two Bloaters as a taste
      density: 0.7, mix: { walker: 0.88, runner: 0.09, bloater: 0.03 } },
  ];

  // ---- cells → metres ----
  const m = (r: Rect): Rect => ({ x: r.x * CELL, y: r.y * CELL, w: r.w * CELL, h: r.h * CELL });
  const mv = (p: Vec2): Vec2 => ({ x: p.x * CELL, y: p.y * CELL });
  for (const b of buildings) {
    b.rect = m(b.cells);
    b.height *= CELL;
  }
  for (const p of props) {
    const horizontal = p.w > p.h;
    p.pos = mv(p.pos);
    p.w = horizontal ? 4.6 : 1.9;
    p.h = horizontal ? 1.9 : 4.6;
  }
  for (const d of districts) {
    d.rect = m(d.rect);
    d.hiveSites = d.hiveSites.map(mv);
  }

  return {
    width: width * CELL,
    height: height * CELL,
    cols: width,
    rows: height,
    cell: CELL,
    tiles,
    buildings,
    props,
    districts,
    baseCells: baseRect,
    baseRect: m(baseRect),
    baseGate: m({ x: 29, y: 33, w: 1, h: 6 }),
    rally: mv({ x: 25, y: 36 }),
  };
}
