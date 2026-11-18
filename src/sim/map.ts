import type { Rect, Vec2 } from '../core/math';
import { Rng } from '../core/rng';
import { CELL } from '../config/world';
import starterData from '../data/maps/starter.json';

export enum Tile {
  Dirt = 0,
  Road = 1,
  Sidewalk = 2,
  BaseConcrete = 3,
  Parking = 4,
  Building = 5,
  Grass = 6,
  /** Railway ballast with tracks (v4.17, Rail Siding). */
  Rail = 7,
}

/** What the renderer should generate on a footprint (doc §14 target look). */
export type BuildingKind = 'houses' | 'apartment' | 'motel' | 'shop' | 'warehouse' | 'boxcar';

export interface BuildingDef {
  id: number;
  kind: BuildingKind;
  floors: number;
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
  /** Side facing the street (round 12 #141: set for houses, which are split into one building per house). */
  front?: Side;
}

export type Side = 'n' | 's' | 'e' | 'w';

/** Which side faces the most street/parking: that's the front. (Was in render/procgen; the sim needs it to split house rows.) */
export function frontOf(map: Pick<CityMap, 'cols' | 'rows' | 'tiles'>, b: Pick<BuildingDef, 'cells'>): Side {
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

/** Houses per row: one per ~13 m of street frontage, 1–3 (the renderer used to draw this many in one building). */
export const housesInRow = (frontageM: number) => Math.max(1, Math.min(3, Math.round(frontageM / 13)));

export interface PropDef {
  id: number;
  /** 'pump' = a gas-pump island (v4.10): low cover, not crushable. */
  kind: 'car' | 'pump';
  pos: Vec2; // centre, metres
  w: number; // metres (real car footprint, ~4.6 × 1.9)
  h: number;
  cells: Rect; // nav cells blocked
  color: number;
  cover: number;
  /** Tanks crush these (doc §6a, Tier 2). */
  crushable: boolean;
}

/** A road strip, metres. `axis` is the direction traffic runs. */
export interface RoadDef {
  rect: Rect;
  axis: 'h' | 'v';
}

export interface DistrictDef {
  id: string;
  name: string;
  rect: Rect;
  starter: boolean;
  /** Spawn site for the district's hive, if any. */
  hiveSites: Vec2[];
  initialInfestation: number;
  /** Index into DIFFICULTY (config/balance.ts). Tutorial regions ramp 0 → 1 → 2. */
  difficulty: number;
  /** Starting zombies per infestation point, and the normal-class mix (doc §2 table: who lives where).
   *  Medium zombies (Bloaters etc.) come from the difficulty tier's medium share (v4.13). */
  density: number;
  mix: Record<string, number>;
  /** Packs placed at the start (v4.13, region 2: Runner packs). */
  packs?: { kind: string; count: number; size: number }[];
  /** Hive stage at the start (default 1): one number for all hives, or one per hive site. */
  hiveStage?: number | number[];
  /** Campaign unlocks granted when this region opens (v4.13: region 2 → guard towers). */
  unlocksOnOpen?: string[];
  /**
   * Tutorial regions (§17, v4.10): closed off by a fence line (`border`, metres) until the district
   * `unlockAfter` is secured. Locked districts have no zombies, hive or noise until then.
   */
  locked?: boolean;
  unlockAfter?: string;
  /** Fence segments (metres) closing the region off while locked. */
  borders?: Rect[];
  /** Power stations (nav cells, top-left) placed when the region opens (v4.17). */
  powerStations?: { x: number; y: number }[];
  /** Survivors hide in this district's houses: searches can find civilians (STATUS #10, region 3 on). */
  civilians?: boolean;
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
  roads: RoadDef[];
  buildings: BuildingDef[];
  props: PropDef[];
  districts: DistrictDef[];
  baseRect: Rect;
  baseGate: Rect;
  /** Gas-station canopies (metres): roofs on posts, purely visual, walkable underneath. */
  canopies: Rect[];
  /** Railway lines (metres, 2 cells high), drawn over roads at level crossings. */
  rails: Rect[];
  rally: Vec2;
}

/** Ground a paint op can lay down (map data files name tiles by these words). */
export type GroundTile = 'dirt' | 'road' | 'sidewalk' | 'baseConcrete' | 'parking' | 'building' | 'grass' | 'rail';
const TILE_BY_NAME: Record<GroundTile, Tile> = {
  dirt: Tile.Dirt,
  road: Tile.Road,
  sidewalk: Tile.Sidewalk,
  baseConcrete: Tile.BaseConcrete,
  parking: Tile.Parking,
  building: Tile.Building,
  grass: Tile.Grass,
  rail: Tile.Rail,
};

/**
 * A map as data (STATUS "map data format", v4.45): everything in nav cells (3 m), drawn in order.
 * `ground` is painted first to last, so later entries cover earlier ones (a road laid after another
 * crosses over it). Edit it in dev-map.html; the game loads src/data/maps/starter.json.
 */
export interface MapData {
  name: string;
  version: 1;
  cols: number;
  rows: number;
  /** Scrubby grass in random clumps (cosmetic): how many, from which seed. */
  grass: { seed: number; clumps: number };
  base: { rect: Rect; gate: Rect; rally: Vec2 };
  ground: (
    | { paint: GroundTile; rect: Rect }
    /** A road strip; with `sidewalks`, a one-cell sidewalk on each side along its length. */
    | { road: Rect; axis: 'h' | 'v'; sidewalks?: boolean }
    /** A rail line: rail tiles, except where it crosses a road (rails are drawn over the road there). */
    | { rail: Rect }
  )[];
  buildings: { rect: Rect; kind: BuildingKind; floors: number; color: string }[];
  /** Gas-station canopies: roofs on posts, walkable underneath. */
  canopies: Rect[];
  /** Cars (top-left cell; 2×1 cells horizontal, 1×2 vertical) and pump islands (2×1), in this order (their ids). */
  props: ({ car: Vec2; horizontal: boolean; color: string } | { pump: Vec2 })[];
  districts: DistrictDef[];
}

const hex = (c: string) => parseInt(c.replace('#', ''), 16);

/** Build the city from map data (cells → metres, house rows split into houses, etc.). */
export function buildMap(data: MapData): CityMap {
  const width = data.cols;
  const height = data.rows;
  const rng = new Rng(data.grass.seed);
  const tiles = new Uint8Array(width * height).fill(Tile.Dirt);
  const set = (x: number, y: number, t: Tile) => {
    if (x >= 0 && y >= 0 && x < width && y < height) tiles[y * width + x] = t;
  };
  const fill = (r: Rect, t: Tile) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) set(x, y, t);
  };

  // scrubby grass in clumps rather than salt-and-pepper noise
  for (let c = 0; c < data.grass.clumps; c++) {
    const cx = rng.int(0, width - 1);
    const cy = rng.int(0, height - 1);
    const r = rng.range(1.5, 4.5);
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && rng.chance(0.8)) set(x, y, Tile.Grass);
  }

  const roadCells: { rect: Rect; axis: 'h' | 'v' }[] = [];
  const railCells: Rect[] = [];
  for (const g of data.ground) {
    if ('paint' in g) fill(g.rect, TILE_BY_NAME[g.paint]);
    else if ('road' in g) {
      const r = g.road;
      if (g.sidewalks) {
        if (g.axis === 'h') fill({ x: r.x, y: r.y - 1, w: r.w, h: 1 }, Tile.Sidewalk);
        else fill({ x: r.x - 1, y: r.y, w: 1, h: r.h }, Tile.Sidewalk);
      }
      fill(r, Tile.Road);
      if (g.sidewalks) {
        if (g.axis === 'h') fill({ x: r.x, y: r.y + r.h, w: r.w, h: 1 }, Tile.Sidewalk);
        else fill({ x: r.x + r.w, y: r.y, w: 1, h: r.h }, Tile.Sidewalk);
      }
      roadCells.push({ rect: r, axis: g.axis });
    } else {
      // level crossings keep road tiles (drivable) and get rails painted over them (#117)
      const r = g.rail;
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (tiles[y * width + x] !== Tile.Road) set(x, y, Tile.Rail);
      railCells.push(r);
    }
  }

  const buildings: BuildingDef[] = [];
  const FLOOR = 3.2; // metres per storey
  for (const b of data.buildings) {
    // `height` is set in cells here and converted with everything else below
    const h = (b.floors * FLOOR + (b.kind === 'houses' ? 2.5 : 0.8)) / CELL;
    buildings.push({ id: buildings.length + 1, kind: b.kind, floors: b.floors, rect: { ...b.rect }, cells: { ...b.rect }, height: h, color: hex(b.color), hp: 800 * b.floors, roofCapacity: Math.max(1, Math.floor((b.rect.w * b.rect.h) / 12)) });
    fill(b.rect, Tile.Building);
  }

  // abandoned cars and pump islands (cover, doc §5); a car on a building or another car is skipped
  const props: PropDef[] = [];
  const blockedByProp = new Set<number>();
  for (const p of data.props) {
    if ('pump' in p) {
      const { x: cx, y: cy } = p.pump;
      for (const x of [cx, cx + 1]) blockedByProp.add(cy * width + x);
      props.push({ id: 10000 + props.length, kind: 'pump', pos: { x: cx + 1, y: cy + 0.5 }, w: 2, h: 1, cells: { x: cx, y: cy, w: 2, h: 1 }, color: 0xb83a2a, cover: 0.3, crushable: false });
      continue;
    }
    const w = p.horizontal ? 2 : 1;
    const h = p.horizontal ? 1 : 2;
    const { x: x0, y: y0 } = p.car;
    let free = true;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (tiles[y * width + x] === Tile.Building || blockedByProp.has(y * width + x)) free = false;
    if (!free) continue;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) blockedByProp.add(y * width + x);
    props.push({ id: 10000 + props.length, kind: 'car', pos: { x: x0 + w / 2, y: y0 + h / 2 }, w, h, cells: { x: x0, y: y0, w, h }, color: hex(p.color), cover: 0.4, crushable: true });
  }

  const districts: DistrictDef[] = data.districts.map((d) => ({
    ...d,
    rect: { ...d.rect },
    hiveSites: d.hiveSites.map((p) => ({ ...p })),
    ...(d.borders ? { borders: d.borders.map((r) => ({ ...r })) } : {}),
    ...(d.powerStations ? { powerStations: d.powerStations.map((p) => ({ ...p })) } : {}),
  }));
  const baseRect = { ...data.base.rect };

  // ---- cells → metres ----
  const m = (r: Rect): Rect => ({ x: r.x * CELL, y: r.y * CELL, w: r.w * CELL, h: r.h * CELL });
  const mv = (p: Vec2): Vec2 => ({ x: p.x * CELL, y: p.y * CELL });
  for (const b of buildings) {
    b.rect = m(b.cells);
    b.height *= CELL;
  }
  // round 12 #141: a row of houses is drawn as 1–3 houses, so it becomes one building per house (each its
  // own search). The first house keeps the row's id (old saves still line up); the others get new ids.
  for (const b of [...buildings]) {
    if (b.kind !== 'houses') continue;
    const side = frontOf({ cols: width, rows: height, tiles }, b);
    b.front = side;
    const along = side === 'n' || side === 's';
    const n = housesInRow(along ? b.rect.w : b.rect.h);
    if (n < 2) continue;
    const row = { ...b.rect };
    const cells = { ...b.cells };
    for (let i = 0; i < n; i++) {
      const lot = i === 0 ? b : { ...b, id: buildings.length + 1, color: b.color };
      lot.rect = along ? { x: row.x + (row.w / n) * i, y: row.y, w: row.w / n, h: row.h } : { x: row.x, y: row.y + (row.h / n) * i, w: row.w, h: row.h / n };
      // whole nav cells (for lawns and footprints): split the row's cells as evenly as they go
      const c0 = Math.round(((along ? cells.w : cells.h) * i) / n);
      const c1 = Math.round(((along ? cells.w : cells.h) * (i + 1)) / n);
      lot.cells = along ? { x: cells.x + c0, y: cells.y, w: c1 - c0, h: cells.h } : { x: cells.x, y: cells.y + c0, w: cells.w, h: c1 - c0 };
      lot.roofCapacity = Math.max(1, Math.floor((lot.cells.w * lot.cells.h) / 12));
      if (i > 0) buildings.push(lot);
    }
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
    if (d.borders) d.borders = d.borders.map(m);
  }

  const roads: RoadDef[] = roadCells.map((r) => ({ rect: m(r.rect), axis: r.axis }));

  return {
    roads,
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
    baseGate: m(data.base.gate),
    canopies: data.canopies.map(m),
    rails: railCells.map(m),
    rally: mv(data.base.rally),
  };
}

let mapOverride: MapData | null = null;
/** Play a different map (the map editor's "Play" button, via main.ts); null goes back to the file. */
export function useMapData(d: MapData | null): void {
  mapOverride = d;
}

/** The opening of the city: the main base and tutorial regions 1–3 (doc §15, §17), from src/data/maps/starter.json. */
export function buildStarterMap(): CityMap {
  return buildMap(mapOverride ?? (starterData as unknown as MapData));
}
