import { STRUCTURES, UNITS, ZOMBIES } from '../config/units';
import { Hive, Squad, Zombie, newId, resetIds } from './entities';
import { World } from './World';

/**
 * Save / load (STATUS #16). The whole simulation state as plain JSON: rebuilt into a fresh World, with
 * every entity keeping its id (orders, targets, outposts and hive broods all refer to each other by id).
 * Derived things (nav-grid blocking, spatial hashes, flow fields, hazards) are rebuilt, not stored.
 *
 * Bump SAVE_VERSION when the format changes in a way old saves can't be read; `load` refuses those.
 */
export const SAVE_VERSION = 1;

type Plain = Record<string, unknown>;

export interface SaveData {
  v: number;
  /** Wall-clock time of the save (ms). */
  savedAt: number;
  /** For the slot list: in-game day, current region, money. */
  summary: { day: number; region: string; money: number; time: number };
  rng: number;
  nextId: number;
  world: Plain;
  /** Things outside the simulation: camera, game speed. */
  view?: { x: number; z: number; zoom: number; yaw: number; speed: number };
}

/** Everything an instance holds, minus its def (stored as an id) and the fields listed. */
function fields(o: object, skip: string[] = []): Plain {
  const out: Plain = {};
  for (const [k, v] of Object.entries(o)) if (k !== 'def' && !skip.includes(k)) out[k] = v;
  return out;
}

export function saveWorld(w: World, view?: SaveData['view']): SaveData {
  const regions = [...w.districts.values()].filter((d) => d.def.id !== 'base');
  const cur = regions.find((d) => !d.locked && !d.secured) ?? regions[regions.length - 1];
  const world: Plain = {
    time: w.time,
    day: w.day,
    dayTimer: w.dayTimer,
    money: w.money,
    supplies: w.supplies,
    commandCap: w.commandCap,
    over: w.over,
    nestTimer: w.nestTimer,
    counters: w.counters(),
    unlocked: [...w.unlocked],
    buildingState: [...w.buildingState],
    supportReadyAt: [...w.supportReadyAt],
    impacts: w.impacts,
    crates: w.crates,
    charges: w.charges,
    clouds: w.clouds,
    noiseEvents: w.noiseEvents,
    rally: { ...w.map.rally },
    districts: [...w.districts.values()].map((d) => ({ ...d, def: d.def.id })),
    hives: w.hives.filter((h) => h.alive).map((h) => ({ ...fields(h), spawned: [...h.spawned] })),
    structures: w.structures.filter((s) => s.alive).map((s) => ({ ...fields(s), def: s.def.id, rotated: s.size.w !== s.def.size.w })),
    // (routes and per-zombie think/stuck timers included: a loaded game plays on exactly as the saved one would)
    squads: w.squads.filter((s) => s.alive).map((s) => ({ ...fields(s, ['selected']), def: s.def.id })),
    zombies: w.zombies.filter((z) => z.alive).map((z) => ({ ...fields(z), def: z.def.id })),
    nav: w.navState(),
  };
  const data: SaveData = {
    v: SAVE_VERSION,
    savedAt: Date.now(),
    summary: { day: w.day, region: cur.def.name, money: Math.floor(w.money), time: w.time },
    rng: w.rng.state,
    nextId: peekNextId(),
    world,
    view,
  };
  return JSON.parse(JSON.stringify(data)) as SaveData;
}

/** The id the next entity would get (without using it up). */
function peekNextId(): number {
  const n = newId();
  resetIds(n);
  return n;
}

/** A World rebuilt from a save. Throws on a save from an incompatible version. */
export function loadWorld(data: SaveData, seed = 1337): World {
  if (data.v !== SAVE_VERSION) throw new Error(`This save is from an older version of the game (format ${data.v}, now ${SAVE_VERSION}).`);
  const s = data.world as Record<string, any>;
  const w = new World({ seed, populate: false });
  w.rng.state = data.rng;

  w.time = s.time;
  w.day = s.day;
  w.dayTimer = s.dayTimer;
  w.money = s.money;
  w.supplies = s.supplies;
  w.commandCap = s.commandCap;
  w.over = s.over;
  w.nestTimer = s.nestTimer;
  w.setCounters(s.counters);
  w.unlocked = new Set(s.unlocked);
  for (const [id, st] of s.buildingState) w.buildingState.set(id, st); // round 12 #141: new houses keep their fresh state
  w.supportReadyAt = new Map(s.supportReadyAt);
  w.impacts = s.impacts;
  w.crates = s.crates;
  w.charges = s.charges;
  w.clouds = s.clouds;
  w.noiseEvents = s.noiseEvents;
  if (s.rally) Object.assign(w.map.rally, s.rally);

  // districts: state over the defs; regions opened since the start lose their fences
  for (const d of s.districts) {
    const st = w.districts.get(d.def);
    if (!st) continue;
    const wasLocked = st.locked;
    Object.assign(st, { ...d, def: st.def });
    if (wasLocked && !st.locked && st.def.borders) w.setBorder(st.def, false);
  }

  // entities, each created under its saved id (resetIds just before its constructor runs)
  for (const h of s.hives) {
    resetIds(h.id);
    const hive = new Hive(h.pos, h.districtId, h.hp, h.pulseTimer);
    Object.assign(hive, { ...h, spawned: new Set(h.spawned) });
    w.hives.push(hive);
    w.registerHive(hive);
  }
  for (const st of s.structures) {
    resetIds(st.id);
    const x = w.addStructure(st.def, st.tile, st.built, st.rotated, st.aim);
    const { def: _d, rotated: _r, tile: _t, size: _s, ...rest } = st;
    Object.assign(x, rest);
    if (!STRUCTURES[st.def]) throw new Error(`Unknown structure ${st.def}`);
  }
  for (const q of s.squads) {
    resetIds(q.id);
    const def = UNITS[q.def];
    if (!def) throw new Error(`Unknown unit ${q.def}`);
    const sq = new Squad(def, q.name, q.pos);
    const { def: _d, ...rest } = q;
    Object.assign(sq, rest);
    w.adoptSquad(sq);
  }
  for (const z of s.zombies) {
    resetIds(z.id);
    const def = ZOMBIES[z.def];
    if (!def) throw new Error(`Unknown zombie ${z.def}`);
    const zz = new Zombie(def, z.pos);
    const { def: _d, ...rest } = z;
    Object.assign(zz, rest);
    w.adoptZombie(zz);
  }
  w.restoreNav(s.nav);
  resetIds(data.nextId);
  // STATUS #50: saves from before the run-down Med Bay (it used to be built) get one in the base
  if (!w.structures.some((x) => x.alive && x.def.id === 'medBay')) {
    const b = w.map.baseCells;
    const tile = { x: b.x + 12, y: b.y + 26 };
    if (!w.canPlace('medBay', tile)) w.addStructure('medBay', tile, false).hp = STRUCTURES.medBay.hp * 0.4;
  }
  return w;
}

// ---------------------------------------------------------------- slots (browser storage)

export type SlotId = 'auto' | '1' | '2' | '3';
export const SLOTS: SlotId[] = ['auto', '1', '2', '3'];
const key = (slot: SlotId) => `dbc.save.${slot}`;
/** Each slot's summary is stored on its own, so the slot list doesn't unpack every save. */
export type SlotMeta = Pick<SaveData, 'v' | 'savedAt' | 'summary'>;

/** gzip + base64 where the browser can (a busy save is ~0.5 MB of JSON, ~10x less packed). */
async function pack(text: string): Promise<string> {
  if (typeof CompressionStream === 'undefined') return text;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return 'gz:' + btoa(bin);
}

async function unpack(stored: string): Promise<string> {
  if (!stored.startsWith('gz:')) return stored;
  const bin = atob(stored.slice(3));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

/** Store a save; resolves to an error message (e.g. storage full) or null. */
export async function writeSlot(slot: SlotId, data: SaveData): Promise<string | null> {
  try {
    const packed = await pack(JSON.stringify(data));
    const meta: SlotMeta = { v: data.v, savedAt: data.savedAt, summary: data.summary };
    localStorage.setItem(key(slot), packed);
    localStorage.setItem(key(slot) + '.meta', JSON.stringify(meta));
    return null;
  } catch (e) {
    return e instanceof DOMException && /quota/i.test(e.name + e.message) ? 'Not enough browser storage for this save.' : 'Could not save in this browser.';
  }
}

export async function readSlot(slot: SlotId): Promise<SaveData | null> {
  try {
    const raw = localStorage.getItem(key(slot));
    return raw ? (JSON.parse(await unpack(raw)) as SaveData) : null;
  } catch {
    return null;
  }
}

export function slotMeta(slot: SlotId): SlotMeta | null {
  try {
    const raw = localStorage.getItem(key(slot) + '.meta');
    return raw ? (JSON.parse(raw) as SlotMeta) : null;
  } catch {
    return null;
  }
}

export function deleteSlot(slot: SlotId): void {
  try {
    localStorage.removeItem(key(slot));
    localStorage.removeItem(key(slot) + '.meta');
  } catch {
    /* nothing to do */
  }
}

/** The most recent loadable save, for "Continue". */
export function latestSlot(): SlotId | null {
  let best: SlotId | null = null;
  let t = -1;
  for (const s of SLOTS) {
    const m = slotMeta(s);
    if (m && m.v === SAVE_VERSION && m.savedAt > t) {
      t = m.savedAt;
      best = s;
    }
  }
  return best;
}

/** Loading rebuilds the whole scene: the page reloads and picks the slot up from this session flag. */
export const PENDING_LOAD = 'dbc.pendingLoad';

export function requestLoad(slot: SlotId): void {
  try {
    sessionStorage.setItem(PENDING_LOAD, slot);
  } catch {
    /* without session storage there's no loading */
  }
  location.reload();
}

/** On start-up: the save the player asked to load, if any (and clears the request). */
export async function takePendingLoad(): Promise<{ slot: SlotId; data: SaveData | null } | null> {
  let slot: string | null = null;
  try {
    slot = sessionStorage.getItem(PENDING_LOAD);
    sessionStorage.removeItem(PENDING_LOAD);
  } catch {
    return null;
  }
  if (!slot || !SLOTS.includes(slot as SlotId)) return null;
  return { slot: slot as SlotId, data: await readSlot(slot as SlotId) };
}
