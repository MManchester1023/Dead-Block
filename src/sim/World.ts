import { EventBus } from '../core/events';
import { Rng } from '../core/rng';
import { inRect, type Vec2 } from '../core/math';
import { BALANCE, DIFFICULTY, type DifficultyTier } from '../config/balance';
import { STRUCTURES, UNITS, ZOMBIES } from '../config/units';
import { buildStarterMap, type BuildingDef, type CityMap, type DistrictDef } from './map';
import { NavGrid } from './grid';
import { FlowFields } from './flowfield';
import { SpatialHash } from './spatial';
import { Hive, Squad, Structure, Zombie, type DemoCharge, type ToxicCloud } from './entities';
import type { DamageType, Order, Targetable } from './types';
import * as Campaign from './rules/campaign';
import * as Commands from './rules/commands';
import * as Damage from './rules/damage';
import * as Buildings from './rules/buildings';
import { updateOrders } from './systems/orders';
import { updateCombat } from './systems/combat';
import { updateZombies } from './systems/zombies';
import { updateHives } from './systems/hives';
import { updateEconomy, updateMedical } from './systems/economy';
import { updateDistricts } from './systems/districts';
import { updateNoise } from './systems/noise';
import { updateRoaming } from './systems/roaming';
import { updateCivilians } from './systems/civilians';
import { updateSupport, type PendingImpact, type SupplyCrate } from './systems/support';

export interface DistrictState {
  def: DistrictDef;
  infestation: number;
  /** Seconds the noise meter holds before it starts draining (v4.9). */
  noiseHold: number;
  noise: number;
  secured: boolean;
  outpostId: number | null;
  cleared: boolean;
  /** Tutorial region not opened yet (v4.10): fenced off, empty, ignored by the systems. */
  locked: boolean;
  /** Until this sim time a just-opened region's dead ignore distant noise (v4.15 #77). */
  quietUntil: number;
  /** Seconds until the next roaming pack leaves (STATUS #11). */
  roamTimer: number;
  /** Dead loose inside while secured (STATUS #11): set while it's contested, for the one-off warning. */
  contested: boolean;
  /** Round 12 #149: until this sim time the noise meter stays empty (after a noise pulse). */
  noiseLockUntil: number;
}

export interface NoiseEvent {
  pos: Vec2;
  loudness: number;
  age: number;
}

const SQUAD_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa'];

/**
 * The simulation (STATUS #12: rules split out). This class holds the state, the entity registry and the
 * fixed-step loop; the rules live in sim/rules/ (campaign setup and regions, player commands, damage,
 * buildings) and sim/systems/ (what runs every tick). Its methods below are the public API that input,
 * UI, systems and tests call; most just hand over to a rule module.
 */
export class World {
  readonly events = new EventBus();
  readonly rng: Rng;
  readonly map: CityMap;
  readonly grid: NavGrid;
  /** Shared crowd navigation (flow fields per destination). */
  readonly flow: FlowFields;

  time = 0;
  day = 1;
  dayTimer = 0;
  money: number = BALANCE.economy.startMoney;
  supplies: number = BALANCE.economy.startSupplies;
  commandCap: number = BALANCE.economy.commandCap;
  over: 'victory' | 'defeat' | null = null;

  squads: Squad[] = [];
  zombies: Zombie[] = [];
  hives: Hive[] = [];
  structures: Structure[] = [];
  charges: DemoCharge[] = [];
  clouds: ToxicCloud[] = [];
  /** Cells under a live toxic cloud (v4.15 #83); squads path around them. Rebuilt when clouds change. */
  hazard!: Uint8Array;
  hazardVersion = 0;
  private hazardKey = '';
  noiseEvents: NoiseEvent[] = [];
  /** Command Post support (v4.4): cooldowns, incoming shells, parachuted crates. */
  supportReadyAt = new Map<string, number>();
  impacts: PendingImpact[] = [];
  crates: SupplyCrate[] = [];
  districts = new Map<string, DistrictState>();

  readonly zombieHash = new SpatialHash<Zombie>(8);
  readonly squadHash = new SpatialHash<Squad>(12);
  private byId = new Map<number, Targetable>();
  private nameCounter = 0;

  constructor(opts: { seed?: number; map?: CityMap; populate?: boolean } = {}) {
    this.rng = new Rng(opts.seed ?? 1337);
    this.map = opts.map ?? buildStarterMap();
    this.grid = new NavGrid(this.map.cols, this.map.rows, this.map.cell);
    this.flow = new FlowFields(this.grid);
    this.hazard = new Uint8Array(this.map.cols * this.map.rows);
    for (const b of this.map.buildings) {
      const c = b.cells;
      this.grid.setRect(c.x, c.y, c.w, c.h, true);
      for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) this.grid.opaque[this.grid.idx(x, y)] = 1;
    }
    for (const p of this.map.props) this.grid.setRect(p.cells.x, p.cells.y, p.cells.w, p.cells.h, true, p.id);
    for (const d of this.map.districts)
      this.districts.set(d.id, { def: d, infestation: d.initialInfestation, noise: 0, noiseHold: 0, secured: d.id === 'base', outpostId: null, cleared: d.initialInfestation === 0, locked: !!d.locked, quietUntil: 0, roamTimer: 0, contested: false, noiseLockUntil: 0 });
    // locked tutorial regions are fenced off until they open
    for (const d of this.map.districts) if (d.locked && d.borders) Campaign.setBorder(this, d, true);

    if (opts.populate !== false) Campaign.populate(this);
  }

  // ---------- setup ----------

  /** Per-building state for searching and nests (v4.9 #46, #65). */
  buildingState = new Map<number, { searched: boolean; nest: number }>();
  /** Campaign unlocks earned so far (v4.13): structure `unlock` keys etc. */
  unlocked = new Set<string>();
  nestTimer = 0;

  /** The first pack leaves a full interval after a district opens (none in the opening minutes). */
  firstRoam(d: DistrictState): void {
    Campaign.firstRoam(this, d);
  }

  setBorder(d: DistrictDef, closed: boolean): void {
    Campaign.setBorder(this, d, closed);
  }

  /** Open a tutorial region (doc §17): cut the fence, seed it, wake its hive. */
  unlockDistrict(id: string): void {
    Campaign.unlockDistrict(this, id);
  }

  // ---------- entity management ----------

  private survivorGroups = 0;

  nextSquadName(defId: string): string {
    if (defId === 'civilians') return `Survivors ${++this.survivorGroups}`;
    const n = SQUAD_NAMES[this.nameCounter++ % SQUAD_NAMES.length];
    return defId === 'engineer' ? `Sapper ${n}` : n;
  }

  /** Name counters, for save/load. */
  counters(): { names: number; survivors: number } {
    return { names: this.nameCounter, survivors: this.survivorGroups };
  }
  setCounters(c: { names: number; survivors: number }): void {
    this.nameCounter = c.names;
    this.survivorGroups = c.survivors;
  }

  /** Put an already-made squad / zombie into the world (save/load). */
  adoptSquad(sq: Squad): void {
    this.squads.push(sq);
    this.byId.set(sq.id, sq);
  }
  adoptZombie(z: Zombie): void {
    this.zombies.push(z);
    this.byId.set(z.id, z);
  }

  spawnSquad(defId: string, pos: Vec2, name?: string, members?: number): Squad {
    const def = members ? { ...UNITS[defId], members } : UNITS[defId];
    const sq = new Squad(def, name ?? this.nextSquadName(defId), this.grid.nearestFree(pos));
    this.squads.push(sq);
    this.byId.set(sq.id, sq);
    return sq;
  }

  spawnZombie(defId: string, pos: Vec2, hiveId: number | null = null): Zombie | null {
    if (this.zombies.length >= BALANCE.hive.globalZombieCap) return null;
    const z = new Zombie(ZOMBIES[defId], { ...this.grid.nearestFree(pos) });
    // easier districts field weaker dead (v4.9, playtest #59)
    const d = this.districtAt(z.pos);
    if (d) z.hp = z.maxHp = z.maxHp * this.tier(d.def.id).zombieHp;
    z.homeHiveId = hiveId;
    this.zombies.push(z);
    this.byId.set(z.id, z);
    return z;
  }

  addStructure(defId: string, tile: { x: number; y: number }, built: boolean, rotated = false, aim = 0): Structure {
    const def = STRUCTURES[defId];
    const s = new Structure(def, { ...tile }, built, rotated);
    s.aim = aim;
    s.facing = aim;
    s.districtId = this.districtAt(s.pos)?.def.id ?? null;
    this.structures.push(s);
    this.byId.set(s.id, s);
    if (def.blocksMovement) {
      this.grid.setRect(tile.x, tile.y, s.size.w, s.size.h, true, s.id);
      // round 12 #147: anyone standing on the new footprint steps off it (engineers used to get walled in)
      for (const q of this.squads) {
        if (!q.alive) continue;
        if (this.grid.isBlockedXY(q.pos.x, q.pos.y)) {
          const f = this.grid.nearestFree(q.pos);
          q.pos.x = f.x;
          q.pos.y = f.y;
          q.path = [];
        }
        for (const m of q.members)
          if (m.alive && this.grid.isBlockedXY(m.pos.x, m.pos.y)) {
            const f = this.grid.nearestFree(m.pos);
            m.pos.x = f.x;
            m.pos.y = f.y;
          }
      }
    }
    if (built && def.slow) this.grid.setSlow(tile.x, tile.y, s.size.w, s.size.h, def.slow, s.id);
    return s;
  }

  private targetCache: { src: Structure[]; len: number; list: Structure[] } | null = null;
  /**
   * Structures the dead can go for: everything but the perimeter wall (~130 segments that zombies never
   * target), in the same order as `structures`. Rebuilt only when structures are added or compacted.
   */
  get zombieTargets(): Structure[] {
    const c = this.targetCache;
    if (c && c.src === this.structures && c.len === this.structures.length) return c.list;
    const list = this.structures.filter((s) => s.def.id !== 'baseWall');
    this.targetCache = { src: this.structures, len: this.structures.length, list };
    return list;
  }

  /** Drop a dead / departed entity from the id registry. */
  forget(id: number): void {
    this.byId.delete(id);
  }

  registerHive(h: Hive): void {
    this.byId.set(h.id, h);
    this.grid.setRect(this.grid.c(h.pos.x) - 1, this.grid.c(h.pos.y) - 1, 2, 2, true, h.id);
  }

  get(id: number | null): Targetable | undefined {
    return id == null ? undefined : this.byId.get(id);
  }

  /** Difficulty tier of a district (config/balance.ts DIFFICULTY). */
  tier(districtId: string | null | undefined): DifficultyTier {
    const d = districtId ? this.districts.get(districtId) : undefined;
    return DIFFICULTY[Math.min(DIFFICULTY.length - 1, d?.def.difficulty ?? 2)];
  }

  districtAt(p: Vec2): DistrictState | undefined {
    for (const d of this.districts.values()) if (inRect(p, d.def.rect)) return d;
    return undefined;
  }

  /** Round 12 #143: the command cap only applies until Rail Siding (region 3) opens; no cap from then on. */
  get hasCommandCap(): boolean {
    const rail = this.districts.get('railSiding');
    return !!rail && rail.locked;
  }

  get commandUsed(): number {
    let n = 0;
    for (const s of this.squads) if (s.alive) n += s.def.command;
    for (const b of this.structures) for (const q of b.queue) n += UNITS[q.defId].command;
    return n;
  }

  canAfford(cost: { money: number; supplies: number }): boolean {
    return this.money >= cost.money && this.supplies >= cost.supplies;
  }

  spend(cost: { money: number; supplies: number }): boolean {
    if (!this.canAfford(cost)) return false;
    this.money -= cost.money;
    this.supplies -= cost.supplies;
    return true;
  }

  /**
   * The structure under a point (round 12 #148): the one whose footprint holds `p`, or else the nearest
   * footprint within `slack` metres. (Picking by a circle round the centre chose neighbours of long
   * sandbag and wire runs.)
   */
  structureAt(p: Vec2, filter: (s: Structure) => boolean = () => true, slack = 1): Structure | undefined {
    const c = this.grid.cell;
    let best: Structure | undefined;
    let bestD = slack;
    for (const s of this.structures) {
      if (!s.alive || !filter(s)) continue;
      const x0 = s.tile.x * c, y0 = s.tile.y * c;
      const dx = Math.max(x0 - p.x, 0, p.x - (x0 + s.size.w * c));
      const dy = Math.max(y0 - p.y, 0, p.y - (y0 + s.size.h * c));
      const d = Math.hypot(dx, dy);
      if (d < bestD || (d === 0 && bestD === 0 && best && Math.hypot(s.pos.x - p.x, s.pos.y - p.y) < Math.hypot(best.pos.x - p.x, best.pos.y - p.y))) {
        best = s;
        bestD = d;
      }
    }
    return best;
  }

  /** Dead walking around inside a district (not those still hidden in buildings). Round 11 #120. */
  deadIn(districtId: string): number {
    const r = this.districts.get(districtId)?.def.rect;
    if (!r) return 0;
    let n = 0;
    for (const z of this.zombies) if (z.alive && z.pos.x >= r.x && z.pos.y >= r.y && z.pos.x < r.x + r.w && z.pos.y < r.y + r.h) n++;
    return n;
  }

  addSupplies(n: number): void {
    this.supplies += n; // round 11 #136: no cap (was 150)
  }

  // ---------- commands (called by input/UI) ----------

  issueOrder(squads: Squad[], order: Order, queue = false): void {
    Commands.issueOrder(this, squads, order, queue);
  }
  stop(squads: Squad[]): void {
    Commands.stop(squads);
  }
  queueProduction(defId: string): string | null {
    return Commands.queueProduction(this, defId);
  }
  footprint(defId: string, rotated = false): { w: number; h: number } {
    return Commands.footprint(defId, rotated);
  }
  canPlace(defId: string, tile: { x: number; y: number }, rotated = false): string | null {
    return Commands.canPlace(this, defId, tile, rotated);
  }
  orderBuild(engineers: Squad[], defId: string, tile: { x: number; y: number }, queue = false, rotated = false, aim = 0): string | null {
    return Commands.orderBuild(this, engineers, defId, tile, queue, rotated, aim);
  }
  orderCharge(engineers: Squad[], hive: Hive, queue = false): string | null {
    return Commands.orderCharge(this, engineers, hive, queue);
  }
  upgradeStructure(st: Structure): string | null {
    return Commands.upgradeStructure(this, st);
  }

  toggleCrouch(squads: Squad[]): boolean {
    return Commands.toggleCrouch(squads);
  }

  orderUpgrade(squads: Squad[], st: Structure, queue = false): string | null {
    return Commands.orderUpgrade(this, squads, st, queue);
  }

  upgradeBlocked(st: Structure): string | null {
    return Commands.upgradeBlocked(this, st);
  }

  orderSearch(squads: Squad[], b: BuildingDef, queue = false): string | null {
    return Commands.orderSearch(this, squads, b, queue);
  }
  orderGarrison(squads: Squad[], tower: Structure, queue = false): string | null {
    return Commands.orderGarrison(this, squads, tower, queue);
  }
  leaveTower(s: Squad): void {
    Commands.leaveTower(this, s);
  }
  orderDisband(squads: Squad[]): string | null {
    return Commands.orderDisband(this, squads);
  }
  standDown(s: Squad): void {
    Commands.standDown(this, s);
  }
  orderDeconstruct(engineers: Squad[], s: Structure, queue = false): string | null {
    return Commands.orderDeconstruct(this, engineers, s, queue);
  }
  orderResume(engineers: Squad[], site: Structure, queue = false): string | null {
    return Commands.orderResume(this, engineers, site, queue);
  }
  orderRepair(engineers: Squad[], st: Structure, queue = false): string | null {
    return Commands.orderRepair(this, engineers, st, queue);
  }
  repairCost(st: Structure, hp: number): number {
    return Commands.repairCost(st, hp);
  }
  orderAttack(squads: Squad[], target: Targetable, queue = false): void {
    Commands.orderAttack(this, squads, target, queue);
  }

  // ---------- damage, noise, explosions ----------

  makeNoise(pos: Vec2, loudness: number): void {
    Damage.makeNoise(this, pos, loudness);
  }
  damage(target: Targetable, amount: number, type: DamageType, source?: Vec2, attacker?: Targetable): void {
    Damage.damage(this, target, amount, type, source, attacker);
  }
  damageSquad(sq: Squad, amount: number, type: DamageType, source?: Vec2): void {
    Damage.damageSquad(this, sq, amount, type, source);
  }
  damageZombie(z: Zombie, amount: number, type: DamageType, attacker?: Targetable): void {
    Damage.damageZombie(this, z, amount, type, attacker);
  }
  damageHive(h: Hive, amount: number, type: DamageType): void {
    Damage.damageHive(this, h, amount, type);
  }
  damageStructure(s: Structure, amount: number): void {
    Damage.damageStructure(this, s, amount);
  }
  canDeconstruct(s: Structure): string | null {
    return Damage.canDeconstruct(s);
  }
  dismantle(s: Structure): void {
    Damage.dismantle(this, s);
  }
  /** Area damage with knockback by distance (doc §5 v4: friend and foe both get thrown). */
  explode(pos: Vec2, radius: number, damage: number, type: DamageType, knockback = 1.5): void {
    Damage.explode(this, pos, radius, damage, type, knockback);
  }

  /** Is any power station working? (v4.17 power system) */
  get powerOnline(): boolean {
    return this.structures.some((s) => s.alive && s.built && !!s.def.restore);
  }

  // ---------- routing ----------

  /** Mark the cells under toxic clouds; bump `hazardVersion` so squads re-plan their routes. */
  private refreshHazards(): void {
    const key = this.clouds.map((c) => c.id).join(',');
    if (key === this.hazardKey) return;
    this.hazardKey = key;
    this.hazard.fill(0);
    const g = this.grid;
    for (const c of this.clouds) {
      const r = c.radius + 1;
      for (let y = g.c(c.pos.y - r); y <= g.c(c.pos.y + r); y++)
        for (let x = g.c(c.pos.x - r); x <= g.c(c.pos.x + r); x++) {
          if (x < 0 || y < 0 || x >= this.map.cols || y >= this.map.rows) continue;
          if (Math.hypot(g.center(x) - c.pos.x, g.center(y) - c.pos.y) <= r) this.hazard[y * this.map.cols + x] = 1;
        }
    }
    this.hazardVersion++;
  }

  /** Nav bookkeeping for save/load: a loaded game keeps its squads' planned routes valid. */
  navState(): { grid: number; hazard: number; key: string } {
    return { grid: this.grid.version, hazard: this.hazardVersion, key: this.hazardKey };
  }
  restoreNav(n: { grid: number; hazard: number; key: string }): void {
    this.refreshHazards(); // rebuild the hazard cells from the loaded clouds
    this.grid.version = n.grid;
    this.hazardVersion = n.hazard;
    this.hazardKey = n.key;
  }

  /** Changes whenever routes may need re-planning: walls built/removed, or gas clouds appearing/clearing. */
  get navVersion(): number {
    return this.grid.version * 4096 + this.hazardVersion;
  }

  // ---------- buildings ----------

  buildingAt(p: Vec2): BuildingDef | undefined {
    return Buildings.buildingAt(this, p);
  }
  finishSearch(s: Squad, b: BuildingDef): void {
    Buildings.finishSearch(this, s, b);
  }
  findCivilians(s: Squad, b: BuildingDef, door: Vec2): Squad {
    return Buildings.findCivilians(this, s, b, door);
  }
  evacuate(c: Squad): void {
    Buildings.evacuate(this, c);
  }
  releaseNest(b: BuildingDef, near: Vec2): void {
    Buildings.releaseNest(this, b, near);
  }

  // ---------- main loop ----------

  step(dt: number): void {
    if (this.over) return;
    this.time += dt;
    this.zombieHash.clear();
    for (const z of this.zombies) if (z.alive) this.zombieHash.insert(z);
    this.squadHash.clear();
    for (const s of this.squads) if (s.alive) this.squadHash.insert(s);

    updateOrders(this, dt);
    updateCombat(this, dt);
    updateZombies(this, dt);
    updateHives(this, dt);
    updateNoise(this, dt);
    updateDistricts(this, dt);
    updateEconomy(this, dt);
    updateMedical(this, dt);
    updateSupport(this);
    updateCivilians(this);
    updateRoaming(this, dt);

    this.refreshHazards();

    // compaction
    if (this.zombies.some((z) => !z.alive)) this.zombies = this.zombies.filter((z) => z.alive);
    this.squads = this.squads.filter((s) => s.alive);
    this.structures = this.structures.filter((s) => s.alive);

    if (!this.squads.some((s) => s.def.category !== 'civilian') && this.commandUsed === 0 && !this.canAfford(UNITS.rifle.cost))
      this.finish('defeat', 'Every squad is gone and the treasury is empty.');
  }

  finish(kind: 'victory' | 'defeat', reason: string): void {
    if (this.over) return;
    this.over = kind;
    this.events.emit(kind, { reason });
  }
}
