import { EventBus } from '../core/events';
import { Rng } from '../core/rng';
import { dist, inRect, norm, sub, type Vec2 } from '../core/math';
import { BALANCE, DIFFICULTY, type DifficultyTier } from '../config/balance';
import { isEnabled } from '../config/features';
import { STRUCTURES, UNITS, ZOMBIES } from '../config/units';
import { buildStarterMap, type BuildingDef, type CityMap, type DistrictDef } from './map';
import { NavGrid } from './grid';
import { FlowFields } from './flowfield';
import { SpatialHash } from './spatial';
import { Hive, Squad, Structure, Zombie, newId, type DemoCharge, type ToxicCloud } from './entities';
import type { DamageType, Order, Targetable } from './types';
import { updateOrders } from './systems/orders';
import { updateCombat } from './systems/combat';
import { updateZombies } from './systems/zombies';
import { updateHives } from './systems/hives';
import { updateEconomy } from './systems/economy';
import { updateDistricts } from './systems/districts';
import { updateNoise } from './systems/noise';
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
}

export interface NoiseEvent {
  pos: Vec2;
  loudness: number;
  age: number;
}

const SQUAD_NAMES = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November', 'Oscar', 'Papa'];

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
  supplyCap: number = BALANCE.economy.supplyCap;
  commandCap: number = BALANCE.economy.commandCap;
  over: 'victory' | 'defeat' | null = null;

  squads: Squad[] = [];
  zombies: Zombie[] = [];
  hives: Hive[] = [];
  structures: Structure[] = [];
  charges: DemoCharge[] = [];
  clouds: ToxicCloud[] = [];
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
    for (const b of this.map.buildings) {
      const c = b.cells;
      this.grid.setRect(c.x, c.y, c.w, c.h, true);
      for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) this.grid.opaque[this.grid.idx(x, y)] = 1;
    }
    for (const p of this.map.props) this.grid.setRect(p.cells.x, p.cells.y, p.cells.w, p.cells.h, true, p.id);
    for (const d of this.map.districts)
      this.districts.set(d.id, { def: d, infestation: d.initialInfestation, noise: 0, noiseHold: 0, secured: d.id === 'base', outpostId: null, cleared: d.initialInfestation === 0 });

    if (opts.populate !== false) this.populate();
  }

  // ---------- setup ----------

  /** Per-building state for searching and nests (v4.9 #46, #65). */
  buildingState = new Map<number, { searched: boolean; nest: number }>();
  nestTimer = 0;

  private populate(): void {
    // a share of buildings in infested districts have a few dead holed up inside (fixed per seed)
    const S = BALANCE.search;
    for (const b of this.map.buildings) {
      const d = this.districtAt({ x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h / 2 });
      const infested = !!d && d.def.id !== 'base' && d.infestation > 0;
      const nest = infested && this.rng.chance(S.nestChance) ? this.rng.int(S.nestSize[0], S.nestSize[1]) : 0;
      this.buildingState.set(b.id, { searched: false, nest });
    }
    const m = this.map;
    const b = m.baseCells; // structures snap to nav cells
    this.addStructure('commandPost', { x: b.x + 3, y: b.y + 4 }, true);
    this.addStructure('barracks', { x: b.x + 3, y: b.y + 26 }, true);
    this.addStructure('supplyDepot', { x: b.x + 12, y: b.y + 4 }, true);
    // perimeter wall with a gate on the east side
    for (let y = b.y - 1; y <= b.y + b.h; y++) {
      const gy = m.baseGate.y / m.cell; // gate is in metres; walls are placed in cells
      if (y >= gy && y < gy + m.baseGate.h / m.cell) continue;
      this.addStructure('baseWall', { x: b.x + b.w, y }, true);
    }
    for (let x = b.x - 1; x < b.x + b.w; x++) {
      this.addStructure('baseWall', { x, y: b.y - 1 }, true);
      this.addStructure('baseWall', { x, y: b.y + b.h }, true);
    }
    for (let y = b.y; y < b.y + b.h; y++) this.addStructure('baseWall', { x: b.x - 1, y }, true);

    // doc §11 starting force: two Rifle Squads + one Engineer Team
    this.spawnSquad('rifle', { x: 66, y: 102 });
    this.spawnSquad('rifle', { x: 66, y: 114 });
    this.spawnSquad('engineer', { x: 54, y: 108 });

    for (const d of m.districts)
      for (const site of d.hiveSites) {
        const hive = new Hive({ ...site }, d.id, BALANCE.hive.hpByStage[0], DIFFICULTY[d.difficulty].firstPulseDelaySec);
        this.hives.push(hive);
        this.registerHive(hive);
      }

    // initial infestation: each district seeds its own population mix
    for (const d of this.districts.values()) {
      const count = Math.round(d.infestation * d.def.density * this.tier(d.def.id).density);
      const kinds = Object.entries(d.def.mix);
      for (let i = 0; i < count; i++) {
        const r = d.def.rect;
        const p = this.grid.nearestFree({ x: this.rng.range(r.x + 12, r.x + r.w - 6), y: this.rng.range(r.y + 6, r.y + r.h - 6) });
        let roll = this.rng.next();
        const kind = kinds.find(([, wgt]) => (roll -= wgt) < 0)?.[0] ?? 'walker';
        this.spawnZombie(kind, p);
      }
    }
  }

  // ---------- entity management ----------

  nextSquadName(defId: string): string {
    const n = SQUAD_NAMES[this.nameCounter++ % SQUAD_NAMES.length];
    return defId === 'engineer' ? `Sapper ${n}` : n;
  }

  spawnSquad(defId: string, pos: Vec2, name?: string): Squad {
    const def = UNITS[defId];
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

  addStructure(defId: string, tile: { x: number; y: number }, built: boolean, rotated = false): Structure {
    const def = STRUCTURES[defId];
    const s = new Structure(def, { ...tile }, built, rotated);
    s.districtId = this.districtAt(s.pos)?.def.id ?? null;
    this.structures.push(s);
    this.byId.set(s.id, s);
    if (def.blocksMovement) this.grid.setRect(tile.x, tile.y, s.size.w, s.size.h, true, s.id);
    if (built && def.slow) this.grid.setSlow(tile.x, tile.y, s.size.w, s.size.h, def.slow, s.id);
    return s;
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

  addSupplies(n: number): void {
    this.supplies = Math.min(this.supplyCap, this.supplies + n);
  }

  // ---------- commands (called by input/UI) ----------

  issueOrder(squads: Squad[], order: Order, queue = false): void {
    // line formation for multi-squad moves (doc §4): fighters in the front rank, support one rank behind
    const n = squads.length;
    const center = squads.reduce((a, s) => ({ x: a.x + s.pos.x / n, y: a.y + s.pos.y / n }), { x: 0, y: 0 });
    const dir = norm(sub(order.pos, center));
    const perp = { x: -dir.y, y: dir.x };
    const spacing = 6; // metres between squads in a line
    const isSupport = (s: Squad) => !!s.def.canBuild?.length;
    const front = squads.filter((s) => !isSupport(s));
    const back = squads.filter(isSupport);
    const slot = new Map<Squad, { k: number; rank: number }>();
    const ranks = front.length ? [front, back] : [back];
    ranks.forEach((rank, r) => rank.forEach((s, i) => slot.set(s, { k: (i - (rank.length - 1) / 2) * spacing, rank: r })));
    squads.forEach((s) => {
      const o: Order = { ...order, pos: { ...order.pos } };
      if (n > 1 && (order.type === 'move' || order.type === 'attackMove')) {
        const { k, rank } = slot.get(s)!;
        const back = rank * 7;
        o.pos = this.grid.nearestFree({ x: order.pos.x + perp.x * k - dir.x * back, y: order.pos.y + perp.y * k - dir.y * back });
      }
      if (!queue) {
        s.orders = [];
        s.path = [];
        s.holding = false;
        s.buildProgress = 0;
      }
      if (order.type === 'hold') {
        s.orders = [];
        s.path = [];
        s.holding = true;
        return;
      }
      s.orders.push(o);
    });
  }

  stop(squads: Squad[]): void {
    for (const s of squads) {
      s.orders = [];
      s.path = [];
      s.holding = false;
      s.targetId = null;
    }
  }

  queueProduction(defId: string): string | null {
    const def = UNITS[defId];
    if (!def) return 'Unknown unit';
    if (def.requires && !isEnabled(def.requires as never)) return `Locked — ${def.unlock}`;
    const producer = this.structures.find((s) => s.alive && s.def.id === def.producedAt);
    if (!producer) return `Needs ${def.producedAt}`;
    if (this.commandUsed + def.command > this.commandCap) return 'Command cap reached';
    if (!this.spend(def.cost)) return 'Not enough money or supplies';
    producer.queue.push({ defId, remaining: def.buildTime });
    return null;
  }

  /** Validates and places a construction site (doc §6: engineers can build anywhere). */
  footprint(defId: string, rotated = false): { w: number; h: number } {
    const sz = STRUCTURES[defId].size;
    return rotated ? { w: sz.h, h: sz.w } : { ...sz };
  }

  canPlace(defId: string, tile: { x: number; y: number }, rotated = false): string | null {
    const def = STRUCTURES[defId];
    if (!def) return 'Unknown structure';
    if (def.requires && !isEnabled(def.requires as never)) return 'Locked';
    const fp = this.footprint(defId, rotated);
    if (!this.grid.rectFree(tile.x, tile.y, fp.w, fp.h)) return 'Blocked';
    if (def.requiresSecured) {
      const d = this.districtAt({ x: (tile.x + fp.w / 2) * this.grid.cell, y: (tile.y + fp.h / 2) * this.grid.cell });
      if (!d || d.def.id === 'base') return 'Outposts go in a district';
      if (d.outpostId) return 'District already has an outpost';
      if (d.infestation > 0) return `Infestation must be 0% (now ${Math.ceil(d.infestation)}%)`;
    }
    const c = { x: (tile.x + fp.w / 2) * this.grid.cell, y: (tile.y + fp.h / 2) * this.grid.cell };
    for (const z of this.zombieHash.query(c, Math.max(fp.w, fp.h) * this.grid.cell * 0.5 + 1.5)) if (z.alive) return 'Zombies in the way';
    if (!this.canAfford(def.cost)) return 'Not enough money or supplies';
    return null;
  }

  orderBuild(engineers: Squad[], defId: string, tile: { x: number; y: number }, queue = false, rotated = false): string | null {
    const eng = engineers.filter((s) => s.def.canBuild?.includes(defId));
    if (!eng.length) return 'Needs an Engineer Team';
    const err = this.canPlace(defId, tile, rotated);
    if (err) return err;
    const def = STRUCTURES[defId];
    this.spend(def.cost);
    const site = this.addStructure(defId, tile, false, rotated);
    this.issueOrder(eng, { type: 'build', pos: site.pos, targetId: site.id, buildDef: defId }, queue);
    return null;
  }

  orderCharge(engineers: Squad[], hive: Hive, queue = false): string | null {
    const eng = engineers.filter((s) => s.def.abilities?.includes('demoCharge'));
    if (!eng.length) return 'Only engineers carry demo charges';
    this.issueOrder(eng.slice(0, 1), { type: 'charge', pos: hive.pos, targetId: hive.id }, queue);
    return null;
  }

  // ---------- damage, noise, explosions ----------

  makeNoise(pos: Vec2, loudness: number): void {
    if (!isEnabled('noise')) return;
    // merge with a fresh sound from the same spot (a squad's volley is one noise, not eight)
    const m2 = BALANCE.noise.mergeRadius ** 2;
    const same = this.noiseEvents.find((e) => e.age === 0 && (e.pos.x - pos.x) ** 2 + (e.pos.y - pos.y) ** 2 <= m2);
    if (same) same.loudness = Math.max(same.loudness, loudness) + Math.min(loudness, same.loudness) * 0.1;
    else this.noiseEvents.push({ pos: { ...pos }, loudness, age: 0 });
    const d = this.districtAt(pos);
    if (d && d.def.id !== 'base') {
      d.noise = Math.min(BALANCE.noise.pulseThreshold, d.noise + loudness * 0.12);
      d.noiseHold = BALANCE.noise.holdSec;
    }
  }

  damage(target: Targetable, amount: number, type: DamageType, source?: Vec2, attacker?: Targetable): void {
    if (!target.alive) return;
    if (target instanceof Squad) this.damageSquad(target, amount, type, source);
    else if (target instanceof Zombie) this.damageZombie(target, amount, type, attacker);
    else if (target instanceof Hive) this.damageHive(target, amount, type);
    else if (target instanceof Structure) this.damageStructure(target, amount);
  }

  damageSquad(sq: Squad, amount: number, type: DamageType, source?: Vec2): void {
    const reduction = type === 'toxic' || type === 'explosive' ? 0 : sq.inCover;
    let dmg = amount * (1 - reduction);
    if (!sq.alive) return;
    sq.lastHit = this.time;
    sq.pool = Math.max(0, sq.pool - dmg);
    // one shared pool (v4.9 #50): a soldier drops each time it crosses a member's share; the one
    // nearest the source (the one in front) goes first
    while (sq.aliveCount > sq.membersSupported) {
      const alive = sq.members.filter((m) => m.alive);
      const victim = source ? alive.reduce((a, b) => (dist(a.pos, source) < dist(b.pos, source) ? a : b)) : this.rng.pick(alive);
      victim.alive = false;
      this.events.emit('memberKilled', { squadId: sq.id, squadName: sq.name, pos: { ...victim.pos }, facing: victim.facing, unitId: sq.def.id });
      if (!sq.alive) {
        this.events.emit('squadWiped', { squadId: sq.id, squadName: sq.name });
        this.byId.delete(sq.id);
        // Tier 2 hook: soldiers killed by the horde can rise again (specialZombies / reanimation)
        if (isEnabled('specialZombies')) this.spawnZombie('walker', sq.pos);
      }
    }
  }

  damageZombie(z: Zombie, amount: number, type: DamageType, attacker?: Targetable): void {
    z.hp -= amount;
    if (amount >= 1 && type !== 'toxic' && type !== 'fire') this.events.emit('bleed', { pos: { ...z.pos }, from: attacker ? { ...attacker.pos } : undefined, heavy: amount > 25 });
    // getting shot makes it angry at the shooter (v4.4: Bloaters sometimes just stood there)
    if (attacker && attacker.alive && z.alive && z.state !== 'attack') {
      const cur = this.get(z.targetId);
      if (!(cur instanceof Squad) || cur === attacker || dist(z.pos, attacker.pos) < dist(z.pos, cur.pos)) {
        z.targetId = attacker.id;
        z.state = 'chase';
        z.aggro = BALANCE.zombie.aggroTimeSec;
      }
    }
    if (type === 'fire') z.burning = Math.max(z.burning, 3);
    if (z.hp <= 0 && z.alive) {
      z.alive = false;
      this.byId.delete(z.id);
      const d = this.districtAt(z.pos);
      this.events.emit('zombieKilled', { id: z.id, defId: z.def.id, pos: { ...z.pos }, facing: z.facing, districtId: d?.def.id ?? null });
      // small salvage per kill (v4.4): scavenged cash and gear
      this.money += z.def.bounty.money;
      this.addSupplies(z.def.bounty.supplies);
      if (d) d.infestation = Math.max(0, d.infestation - (BALANCE.infestation.perKill[z.def.id] ?? 0.5));
      if (z.def.onDeath === 'toxicCloud') {
        const cloud: ToxicCloud = { id: newId(), pos: { ...z.pos }, radius: 5.5, remaining: 8, dps: 7 };
        this.clouds.push(cloud);
        this.events.emit('toxicCloud', { pos: cloud.pos, radius: cloud.radius, duration: cloud.remaining });
        this.explode(z.pos, 4.5, 6, 'toxic', 0.8);
      }
    }
  }

  damageHive(h: Hive, amount: number, type: DamageType): void {
    // doc §9: only fire or explosives destroy hives
    if (type !== 'fire' && type !== 'explosive') return;
    h.hp -= amount;
    if (h.hp <= 0 && h.alive) {
      h.alive = false;
      this.byId.delete(h.id);
      this.grid.setRect(this.grid.c(h.pos.x) - 1, this.grid.c(h.pos.y) - 1, 2, 2, false);
      const d = this.districts.get(h.districtId);
      if (d) d.infestation = Math.max(0, d.infestation - BALANCE.infestation.hiveDestroyed);
      this.money += BALANCE.economy.hiveBounty;
      this.events.emit('hiveDestroyed', { hiveId: h.id, districtId: h.districtId });
    }
  }

  damageStructure(s: Structure, amount: number): void {
    s.hp -= amount;
    if (s.hp <= 0 && s.alive) {
      this.removeStructure(s);
      this.events.emit('structureDestroyed', { id: s.id, defId: s.def.id, pos: s.pos });
    }
  }

  private removeStructure(s: Structure): void {
    s.alive = false;
    this.byId.delete(s.id);
    const def = s.def;
    if (def.blocksMovement) this.grid.setRect(s.tile.x, s.tile.y, s.size.w, s.size.h, false);
    if (def.slow) this.grid.setSlow(s.tile.x, s.tile.y, s.size.w, s.size.h, 1);
  }

  /** Engineers can take back what they built (v4.2): full refund for an unstarted site, half otherwise. */
  canDeconstruct(s: Structure): string | null {
    if (!s.alive) return 'Already gone';
    if (!s.def.cost.money && !s.def.cost.supplies) return "Base facilities can't be dismantled";
    return null;
  }

  dismantle(s: Structure): void {
    if (this.canDeconstruct(s)) return;
    const k = !s.built && s.buildProgress <= 0 ? 1 : 0.5;
    const refund = { money: Math.round(s.def.cost.money * k), supplies: Math.round(s.def.cost.supplies * k) };
    this.money += refund.money;
    this.addSupplies(refund.supplies);
    // dismantling your own outpost gives up the district quietly — no hive (that's for a zombie retake)
    for (const d of this.districts.values())
      if (d.outpostId === s.id) {
        d.secured = false;
        d.outpostId = null;
      }
    this.removeStructure(s);
    this.events.emit('structureDismantled', { id: s.id, defId: s.def.id, pos: s.pos, refund });
  }

  /** Building under a point (metres), if any. */
  buildingAt(p: Vec2): BuildingDef | undefined {
    return this.map.buildings.find((b) => p.x >= b.rect.x && p.y >= b.rect.y && p.x < b.rect.x + b.rect.w && p.y < b.rect.y + b.rect.h);
  }

  /** Search a building for supplies (v4.9 #46): ~5 s at the door, interrupted by getting hit. */
  orderSearch(squads: Squad[], b: BuildingDef, queue = false): string | null {
    const st = this.buildingState.get(b.id);
    if (!st) return 'Nothing to search there';
    if (st.searched) return 'Already searched';
    const c = { x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h / 2 };
    this.issueOrder(squads, { type: 'search', pos: c, targetId: b.id }, queue);
    return null;
  }

  finishSearch(s: Squad, b: BuildingDef): void {
    const st = this.buildingState.get(b.id);
    if (!st || st.searched) return;
    st.searched = true;
    const S = BALANCE.search;
    const door = { ...s.pos };
    if (st.nest > 0) {
      this.releaseNest(b, door);
      this.events.emit('buildingSearched', { buildingId: b.id, pos: door, found: 'zombies' });
      return;
    }
    const r = this.rng.next();
    let found = 'nothing';
    if (r >= S.emptyChance) {
      const sup = this.rng.int(S.supplies[0], S.supplies[1]);
      this.addSupplies(sup);
      found = `+${sup} supplies`;
      if (this.rng.chance(S.moneyChance)) {
        const m = this.rng.int(S.money[0], S.money[1]);
        this.money += m;
        found += `, +$${m}`;
      }
    }
    this.events.emit('buildingSearched', { buildingId: b.id, pos: door, found });
    this.events.emit('radio', { speaker: s.name, text: found === 'nothing' ? 'Building clear. Nothing worth taking.' : `Building clear. Found ${found.replace(/^\+/, '')}.`, tone: found === 'nothing' ? 'info' : 'good' });
  }

  /** Zombies holed up in a building spill out of the door nearest `near` (v4.9 #65). */
  releaseNest(b: BuildingDef, near: Vec2): void {
    const st = this.buildingState.get(b.id);
    if (!st || st.nest <= 0) return;
    const count = st.nest;
    st.nest = 0;
    // nearest point on the walls, pushed just outside
    const ex = Math.max(b.rect.x, Math.min(b.rect.x + b.rect.w, near.x));
    const ey = Math.max(b.rect.y, Math.min(b.rect.y + b.rect.h, near.y));
    const out = norm(sub(near, { x: ex, y: ey }));
    const door = this.grid.nearestFree({ x: ex + out.x * 1.5, y: ey + out.y * 1.5 });
    const prey = this.squadHash.query(door, 30).filter((q) => q.alive).sort((a, c) => dist(a.pos, door) - dist(c.pos, door))[0];
    for (let i = 0; i < count; i++) {
      const z = this.spawnZombie('walker', { x: door.x + this.rng.range(-1, 1), y: door.y + this.rng.range(-1, 1) });
      if (z && prey) {
        z.targetId = prey.id;
        z.state = 'chase';
        z.aggro = BALANCE.zombie.aggroTimeSec;
      }
    }
    this.events.emit('nestBurst', { buildingId: b.id, pos: door, count });
    this.events.emit('radio', { speaker: prey?.name ?? 'Overwatch', text: count > 2 ? 'Contact! They were holed up inside!' : "One of them was inside! Contact front!", tone: 'warn' });
  }

  /** Send squads back to the Barracks to stand down (v4.9 #55). Frees command and upkeep, refunds a little. */
  orderDisband(squads: Squad[]): string | null {
    const b = this.structures.find((s) => s.alive && s.def.id === 'barracks');
    if (!b) return 'No Barracks to return to';
    const door = this.grid.nearestFree({ x: b.pos.x + b.radius + 1, y: b.pos.y });
    for (const s of squads) {
      s.orders = [{ type: 'disband', pos: door }];
      s.path = [];
      s.targetId = null;
      s.holding = false;
    }
    return null;
  }

  standDown(s: Squad): void {
    if (!s.alive) return;
    const k = BALANCE.economy.disbandRefund;
    const refund = { money: Math.round(s.def.cost.money * k), supplies: Math.round(s.def.cost.supplies * k) };
    this.money += refund.money;
    this.supplies = Math.min(this.supplyCap, this.supplies + refund.supplies);
    for (const m of s.members) m.alive = false;
    this.byId.delete(s.id);
    this.events.emit('radio', { speaker: 'Barracks', text: `${s.name} stood down. +$${refund.money} and +${refund.supplies} supplies back in stores.`, tone: 'info' });
  }

  orderDeconstruct(engineers: Squad[], s: Structure, queue = false): string | null {
    const eng = engineers.filter((e) => e.def.canBuild?.length);
    if (!eng.length) return 'Only engineers can deconstruct';
    const err = this.canDeconstruct(s);
    if (err) return err;
    this.issueOrder(eng, { type: 'deconstruct', pos: s.pos, targetId: s.id }, queue);
    return null;
  }

  /** Engineers pick an unfinished site back up where it was left (v4.4). */
  orderResume(engineers: Squad[], site: Structure, queue = false): string | null {
    const eng = engineers.filter((e) => e.def.canBuild?.length);
    if (!eng.length) return 'Only engineers can build';
    if (site.built) return 'Already built';
    this.issueOrder(eng, { type: 'build', pos: site.pos, targetId: site.id, buildDef: site.def.id }, queue);
    return null;
  }

  /** Engineers patch up damaged structures, paying supplies as they go (v4.4). */
  orderRepair(engineers: Squad[], st: Structure, queue = false): string | null {
    const eng = engineers.filter((e) => e.def.canBuild?.length);
    if (!eng.length) return 'Only engineers can repair';
    if (!st.built) return this.orderResume(eng, st, queue);
    if (st.hp >= st.def.hp) return 'Not damaged';
    this.issueOrder(eng, { type: 'repair', pos: st.pos, targetId: st.id }, queue);
    return null;
  }

  /** Supplies to fully restore `hp` of a structure: half its supply cost per full bar, minimum a trickle. */
  repairCost(st: Structure, hp: number): number {
    return (Math.max(4, st.def.cost.supplies) * 0.5 * hp) / st.def.hp;
  }

  orderAttack(squads: Squad[], target: Targetable, queue = false): void {
    this.issueOrder(squads, { type: 'attack', pos: { ...target.pos }, targetId: target.id }, queue);
  }

  /** Area damage with knockback by distance (doc §5 v4: friend and foe both get thrown). */
  explode(pos: Vec2, radius: number, damage: number, type: DamageType, knockback = 1.5): void {
    this.events.emit('explosion', { pos: { ...pos }, radius, type });
    const kb = isEnabled('knockback') ? knockback : 0;
    for (const z of this.zombieHash.query(pos, radius + 2)) {
      if (!z.alive) continue;
      const d = dist(pos, z.pos);
      if (d > radius + z.radius) continue;
      const falloff = 1 - Math.min(1, d / (radius + z.radius)) * 0.6;
      this.damageZombie(z, damage * falloff, type);
      if (kb) {
        const dir = norm(sub(z.pos, pos));
        z.knock.x += dir.x * kb * 12 * falloff; // m/s
        z.knock.y += dir.y * kb * 12 * falloff;
      }
    }
    for (const s of this.squads) {
      if (!s.alive) continue;
      const d = dist(pos, s.pos);
      if (d > radius + s.radius) continue;
      const falloff = 1 - Math.min(1, d / (radius + s.radius)) * 0.6;
      if (type !== 'toxic') this.damageSquad(s, damage * 0.6 * falloff, type, pos);
      if (kb && d < radius * 0.7) {
        const dir = norm(sub(s.pos, pos));
        s.knock.x += dir.x * kb * 6 * falloff;
        s.knock.y += dir.y * kb * 6 * falloff;
        s.stunned = Math.max(s.stunned, 0.6 * falloff);
      }
    }
    for (const h of this.hives) if (h.alive && dist(pos, h.pos) <= radius + h.radius) this.damageHive(h, damage, type);
    for (const st of this.structures)
      if (st.alive && st.def.id !== 'baseWall' && dist(pos, st.pos) <= radius + st.radius) this.damageStructure(st, damage * 0.3);
    this.makeNoise(pos, type === 'toxic' ? 4 : radius * 3);
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
    updateSupport(this);

    // compaction
    if (this.zombies.some((z) => !z.alive)) this.zombies = this.zombies.filter((z) => z.alive);
    this.squads = this.squads.filter((s) => s.alive);
    this.structures = this.structures.filter((s) => s.alive);

    if (!this.squads.length && this.commandUsed === 0 && !this.canAfford(UNITS.rifle.cost))
      this.finish('defeat', 'Every squad is gone and the treasury is empty.');
  }

  finish(kind: 'victory' | 'defeat', reason: string): void {
    if (this.over) return;
    this.over = kind;
    this.events.emit(kind, { reason });
  }
}
