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
}

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

/**
 * The opening of the city: the main base, tutorial region 1 (Roadside Motel) and tutorial region 2
 * (Gas Station Strip, east of the motel, fenced off until the motel is secured), doc §15, §17.
 * Authored on the nav grid (each region 64 × 64 cells = 192 × 192 m at 3 m cells), then converted to
 * metres. Hand-placed and identical every run (doc §2); the RNG only varies cosmetics (colours, which
 * of two lanes a stalled car sits in), always from the same seed.
 */
export function buildStarterMap(seed = 7): CityMap {
  const rng = new Rng(seed);
  const width = 170; // v4.10: was 104 (motel only); region 2 occupies x 104–167
  const height = 152; // v4.17: was 72; region 3 (Rail Siding) occupies y 72–151
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

  // main east-west road + sidewalks. v4.9 (#41): the road starts at the base gate instead of running
  // under the base; the gate opening itself is base concrete.
  const ROAD_X = baseRect.x + baseRect.w + 1;
  fill({ x: ROAD_X, y: 33, w: width - ROAD_X, h: 1 }, Tile.Sidewalk);
  fill({ x: ROAD_X, y: 34, w: width - ROAD_X, h: 4 }, Tile.Road);
  fill({ x: ROAD_X, y: 38, w: width - ROAD_X, h: 1 }, Tile.Sidewalk);
  fill({ x: baseRect.x + baseRect.w, y: 33, w: 1, h: 6 }, Tile.BaseConcrete);
  // north-south roads in the zone
  // north-south avenues run the full height of the map (off both edges) so the city reads as continuing
  for (const rx of [56, 86, 132]) {
    fill({ x: rx - 1, y: 0, w: 1, h: height }, Tile.Sidewalk);
    fill({ x: rx, y: 0, w: 4, h: height }, Tile.Road);
    fill({ x: rx + 4, y: 0, w: 1, h: height }, Tile.Sidewalk);
  }
  // ---- tutorial region 3: Rail Siding (doc §2: boxcars and a small depot; Walkers and Runners) ----
  // its own main road, a rail line across the whole region, level crossings on the avenues
  // round 10 #116: both run from the west map edge to the east one (through the region's fence line)
  fill({ x: 0, y: 95, w: width, h: 1 }, Tile.Sidewalk);
  fill({ x: 0, y: 96, w: width, h: 4 }, Tile.Road);
  fill({ x: 0, y: 100, w: width, h: 1 }, Tile.Sidewalk);
  // the rail bed; level crossings keep road tiles (drivable) and get rails painted over them (#117)
  for (let x = 0; x < width; x++) for (const y of [120, 121]) if (tiles[y * width + x] !== Tile.Road) set(x, y, Tile.Rail);
  const railCells: Rect[] = [{ x: 0, y: 120, w: width, h: 2 }];

  // motel parking + other lots
  const lots: Rect[] = [
    { x: 62, y: 14, w: 16, h: 16 },
    { x: 40, y: 40, w: 14, h: 6 },
    { x: 91, y: 50, w: 11, h: 14 },
    { x: 66, y: 40, w: 16, h: 4 },
    // region 2: gas station forecourts, strip-mall lot, diner lot
    { x: 106, y: 20, w: 22, h: 13 },
    { x: 140, y: 39, w: 24, h: 12 },
    { x: 138, y: 19, w: 27, h: 13 },
    { x: 107, y: 47, w: 12, h: 6 },
    // region 3: lots, the power station yard, the depot apron
    { x: 40, y: 102, w: 14, h: 10 },
    { x: 138, y: 102, w: 26, h: 15 },
    { x: 92, y: 124, w: 30, h: 4 },
  ];
  lots.forEach((r) => fill(r, Tile.Parking));

  const buildings: BuildingDef[] = [];
  const palette = [0x6f6a60, 0x7a7266, 0x5f6466, 0x8a7f6c, 0x6a5e55, 0x73786f];
  const FLOOR = 3.2; // metres per storey
  const addB = (rect: Rect, kind: BuildingKind, floors: number) => {
    // `height` is set in cells here and converted with everything else below
    const height = (floors * FLOOR + (kind === 'houses' ? 2.5 : 0.8)) / CELL;
    buildings.push({ id: buildings.length + 1, kind, floors, rect, cells: { ...rect }, height, color: rng.pick(palette), hp: 800 * floors, roofCapacity: Math.max(1, Math.floor((rect.w * rect.h) / 12)) });
    fill(rect, Tile.Building);
  };
  // Roadside Motel: north wing + east wing around the parking lot, office by the road
  addB({ x: 62, y: 9, w: 20, h: 5 }, 'motel', 2);
  addB({ x: 78, y: 14, w: 5, h: 15 }, 'motel', 2);
  addB({ x: 62, y: 30, w: 8, h: 2 }, 'shop', 1); // motel office
  // the neighbourhood: suburban lots, a couple of apartment blocks, shops and a warehouse
  addB({ x: 42, y: 8, w: 9, h: 8 }, 'houses', 2);
  addB({ x: 42, y: 20, w: 7, h: 9 }, 'houses', 2);
  addB({ x: 42, y: 47, w: 10, h: 8 }, 'apartment', 4);
  addB({ x: 42, y: 59, w: 7, h: 7 }, 'houses', 1);
  addB({ x: 63, y: 46, w: 9, h: 7 }, 'shop', 1);
  addB({ x: 74, y: 47, w: 8, h: 10 }, 'apartment', 5);
  addB({ x: 64, y: 57, w: 6, h: 8 }, 'houses', 2);
  addB({ x: 92, y: 8, w: 9, h: 10 }, 'apartment', 6);
  addB({ x: 92, y: 22, w: 8, h: 8 }, 'houses', 2);
  addB({ x: 92, y: 41, w: 9, h: 6 }, 'warehouse', 2);

  // ---- tutorial region 2: Gas Station Strip (doc §2: pumps and convenience stores; Walkers) ----
  addB({ x: 107, y: 7, w: 8, h: 7 }, 'houses', 1);
  addB({ x: 118, y: 7, w: 8, h: 8 }, 'houses', 2);
  addB({ x: 107, y: 21, w: 8, h: 5 }, 'shop', 1); // gas station A: convenience store
  addB({ x: 138, y: 9, w: 26, h: 8 }, 'shop', 1); // strip mall, facing its lot
  addB({ x: 108, y: 41, w: 9, h: 6 }, 'shop', 1); // truck-stop diner
  addB({ x: 121, y: 42, w: 8, h: 7 }, 'warehouse', 1); // car wash
  addB({ x: 141, y: 44, w: 8, h: 5 }, 'shop', 1); // gas station B: convenience store
  addB({ x: 107, y: 57, w: 8, h: 8 }, 'houses', 1);
  addB({ x: 119, y: 57, w: 8, h: 8 }, 'houses', 2);
  addB({ x: 140, y: 56, w: 9, h: 9 }, 'apartment', 3);

  // ---- region 3: Rail Siding ----
  // north of the road: workers' houses, a corner shop, a yard office, small warehouses
  addB({ x: 40, y: 76, w: 8, h: 7 }, 'houses', 1);
  addB({ x: 40, y: 86, w: 8, h: 7 }, 'houses', 2);
  addB({ x: 62, y: 76, w: 10, h: 6 }, 'shop', 1);
  addB({ x: 62, y: 85, w: 9, h: 8 }, 'apartment', 3);
  addB({ x: 92, y: 76, w: 14, h: 9 }, 'warehouse', 2);
  addB({ x: 110, y: 76, w: 8, h: 7 }, 'houses', 1);
  addB({ x: 120, y: 76, w: 8, h: 7 }, 'houses', 2);
  addB({ x: 138, y: 76, w: 12, h: 6 }, 'shop', 1);
  addB({ x: 152, y: 76, w: 8, h: 8 }, 'houses', 2);
  // between the road and the rails: sheds and the goods warehouse
  addB({ x: 62, y: 103, w: 16, h: 10 }, 'warehouse', 2);
  addB({ x: 92, y: 104, w: 10, h: 8 }, 'warehouse', 1);
  addB({ x: 110, y: 104, w: 8, h: 6 }, 'shop', 1);
  // boxcars standing on the siding (cover and choke points; gaps at the level crossings)
  for (const x of [40, 46, 62, 68, 76, 92, 98, 112, 118, 140, 148, 156]) addB({ x, y: 120, w: 6, h: 2 }, 'boxcar', 1);
  // south of the rails: the depot, sheds, a few houses; the two hives sit out here
  addB({ x: 60, y: 125, w: 14, h: 8 }, 'warehouse', 2);
  addB({ x: 100, y: 129, w: 16, h: 9 }, 'warehouse', 2);
  addB({ x: 40, y: 132, w: 8, h: 7 }, 'houses', 1);
  addB({ x: 40, y: 142, w: 8, h: 7 }, 'houses', 1);
  addB({ x: 120, y: 140, w: 9, h: 8 }, 'apartment', 3);
  addB({ x: 138, y: 126, w: 10, h: 7 }, 'warehouse', 1);

  const canopyCells: Rect[] = [
    { x: 116, y: 26, w: 11, h: 5 },
    { x: 150, y: 41, w: 11, h: 5 },
  ];

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
  // gas-pump islands under the canopies: 2 cells long, low cover
  const addPump = (cx: number, cy: number) => {
    for (const x of [cx, cx + 1]) blockedByProp.add(cy * width + x);
    props.push({ id: 10000 + props.length, kind: 'pump', pos: { x: cx + 1, y: cy + 0.5 }, w: 2, h: 1, cells: { x: cx, y: cy, w: 2, h: 1 }, color: 0xb83a2a, cover: 0.3, crushable: false });
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
  // region 2: pumps, stalled traffic, abandoned cars at the pumps and in the lots
  for (const [x, y] of [[118, 28], [122, 28], [152, 43], [156, 43]]) addPump(x, y);
  for (const x of [108, 114, 121, 127, 139, 146, 153, 161, 166]) addCar(x, rng.chance(0.5) ? 35 : 37, true);
  for (const y of [10, 22, 46, 60]) addCar(rng.chance(0.5) ? 133 : 135, y, false);
  for (const [x, y] of [[119, 30], [124, 26], [153, 45], [110, 31], [145, 41]]) addCar(x, y, true);
  for (let x = 140; x < 163; x += 3) {
    if (rng.chance(0.6)) addCar(x + 1, 21, false);
    if (rng.chance(0.45)) addCar(x + 1, 29, false);
  }
  for (let i = 0; i < 3; i++) addCar(rng.int(109, 117), rng.int(48, 51), true);
  // region 3: stalled traffic, lots, the power station yard
  for (const x of [44, 52, 64, 72, 80, 96, 104, 116, 126, 142, 152, 160]) addCar(x, rng.chance(0.5) ? 97 : 99, true);
  for (const y of [80, 90, 110, 130, 145]) {
    addCar(rng.chance(0.5) ? 57 : 59, y, false);
    addCar(rng.chance(0.5) ? 87 : 89, y, false);
    addCar(rng.chance(0.5) ? 133 : 135, y, false);
  }
  for (let i = 0; i < 4; i++) addCar(rng.int(41, 52), rng.int(103, 110), true);
  for (const [x, y] of [[140, 104], [140, 113], [160, 104], [160, 113], [144, 114]]) addCar(x, y, true);

  const districts: DistrictDef[] = [
    { id: 'base', name: 'Main Base', rect: baseRect, starter: true, hiveSites: [], initialInfestation: 0, difficulty: 0, density: 0, mix: {} },
    { id: 'motel', name: 'Roadside Motel', rect: { x: 38, y: 4, w: 64, h: 64 }, starter: true, hiveSites: [{ x: 96, y: 58 }], initialInfestation: 65, difficulty: 0,
      // doc §2: "Starter district; Walkers" — a few early Runners and one or two Bloaters as a taste
      density: 0.7, mix: { walker: 0.9, runner: 0.1 } },
    // tutorial region 2 (doc §17): a little harder (Easy tier), opens when the motel is secured
    { id: 'gasStrip', name: 'Gas Station Strip', rect: { x: 104, y: 4, w: 64, h: 64 }, starter: true, hiveSites: [{ x: 159, y: 61 }], initialInfestation: 70, difficulty: 1,
      // v4.13 (#74): a real step up: bigger crowd (tier density), Runner packs, hive already at stage 2
      density: 0.75, mix: { walker: 0.82, runner: 0.18 }, packs: [{ kind: 'runner', count: 3, size: 4 }], hiveStage: 2, unlocksOnOpen: ['guardTower'], locked: true, unlockAfter: 'motel', borders: [{ x: 103, y: 0, w: 1, h: 71 }] },
    // tutorial region 3 (doc §17, v4.17): the big final exam. Two hives, standard difficulty, and the
    // region's power station: restoring it brings the power system online and unlocks the Med Bay
    { id: 'railSiding', name: 'Rail Siding', rect: { x: 38, y: 72, w: 130, h: 80 }, starter: true, hiveSites: [{ x: 70, y: 143 }, { x: 155, y: 140 }], initialInfestation: 75, difficulty: 2,
      density: 1.5, mix: { walker: 0.78, runner: 0.22 }, packs: [{ kind: 'runner', count: 6, size: 4 }], locked: true, unlockAfter: 'gasStrip',
      borders: [{ x: 37, y: 71, w: 133, h: 1 }, { x: 37, y: 72, w: 1, h: 80 }], powerStations: [{ x: 147, y: 106 }], civilians: true },
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
    if (d.borders) d.borders = d.borders.map(m);
  }

  const roads: RoadDef[] = [
    { rect: m({ x: ROAD_X, y: 34, w: width - ROAD_X, h: 4 }), axis: 'h' },
    { rect: m({ x: 56, y: 0, w: 4, h: height }), axis: 'v' },
    { rect: m({ x: 86, y: 0, w: 4, h: height }), axis: 'v' },
    { rect: m({ x: 132, y: 0, w: 4, h: height }), axis: 'v' },
    { rect: m({ x: 0, y: 96, w: width, h: 4 }), axis: 'h' },
  ];

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
    baseGate: m({ x: 29, y: 33, w: 1, h: 6 }),
    canopies: canopyCells.map(m),
    rails: railCells.map(m),
    rally: mv({ x: 25, y: 36 }),
  };
}
