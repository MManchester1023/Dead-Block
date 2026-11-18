import type { Vec2 } from '../core/math';
import type { UnitDef, ZombieDef, StructureDef } from '../config/units';
import { BALANCE } from '../config/balance';
import { CELL } from '../config/world';
import { type Faction, type Order, ThreatClass, type Targetable } from './types';

export interface Member {
  index: number;
  alive: boolean;
  cooldown: number;
  /** Formation slot relative to squad center. */
  offset: Vec2;
  /** Member position, metres (drifts around its slot — see updateMembers). */
  pos: Vec2;
  facing: number;
  /** Sim time of this member's last shot (drives the shooting animation). */
  lastShot: number;
  /** At rest, walking back to their spot (round 12 #137); otherwise standing still. */
  settling?: boolean;
  /** Per-member loadout/cosmetics hook for Armory customization (doc §7, Tier 4). */
  loadout?: { weapon?: string; attachments?: string[]; cosmetics?: Record<string, string> };
}

/** Member slots around the squad centre, metres. */
const FORMATION_SLOTS: Vec2[] = [
  { x: -1.2, y: -1.2 },
  { x: 1.2, y: -1.2 },
  { x: -1.2, y: 1.2 },
  { x: 1.2, y: 1.2 },
  { x: 0, y: 0 }, // a fifth soldier (Elite, round 10 #118) takes the middle
];

let nextId = 1;
export const newId = (): number => nextId++;
export const resetIds = (n = 1) => {
  nextId = n;
};

export class Squad implements Targetable {
  readonly id = newId();
  faction: Faction = 'player';
  threat = ThreatClass.Normal;
  radius = 2; // metres — the squad's spread, used for melee reach and blasts
  members: Member[];
  orders: Order[] = [];
  path: Vec2[] = [];
  pathVersion = -1;
  /** Where the current cached path leads (lets us re-plan when chasing a moving target). */
  pathFor: Vec2 | null = null;
  targetId: number | null = null;
  holding = false;
  inCover = 0; // current cover damage reduction
  /** Which way the formation is laid out (round 12 #137): follows the squad on the move, frozen at rest. */
  formFacing: number | null = null;
  coverPropId: number | null = null;
  facing = 0;
  xp = 0;
  level = 0;
  kills = 0;
  buildProgress = 0;
  /** Future: building id when garrisoned / on a roof (doc §5, Tier 2). */
  garrisonedIn: number | null = null;
  knock: Vec2 = { x: 0, y: 0 };
  stunned = 0;
  /** Sim time this squad last took damage (interrupts planting a charge). */
  lastHit = -1;
  /** Throttle for "can't do that" radio lines. */
  lastBlockedMsg?: number;
  /** Sim time the squad last got treatment at a Med Bay. */
  healing = -99;
  /** Climbing up into / down from a guard tower (round 9 #97): can't move or shoot meanwhile. */
  climb: { towerId: number; t: number; up: boolean } | null = null;
  selected = false;
  moving = false;
  /**
   * One shared health pool for the whole squad (v4.9, playtest #50). Soldiers drop out each time the
   * pool crosses one member's share, so a hurt squad also shoots less. Nothing refills it on its own:
   * only medics / a Med Bay (later tiers).
   */
  pool: number;
  poolMax: number;

  constructor(public def: UnitDef, public name: string, public pos: Vec2) {
    this.pool = this.poolMax = def.memberHp * def.members;
    this.members = Array.from({ length: def.members }, (_, i) => ({
      index: i,
      alive: true,
      cooldown: (i / def.members) * def.weapon.cooldown, // staggered volleys
      offset: FORMATION_SLOTS[i % FORMATION_SLOTS.length],
      pos: { x: pos.x + FORMATION_SLOTS[i % FORMATION_SLOTS.length].x, y: pos.y + FORMATION_SLOTS[i % FORMATION_SLOTS.length].y },
      facing: 0,
      lastShot: -99,
    }));
  }

  /** A new soldier joins (Elite promotion, round 10 #118): one more member, and their share of health. */
  addMember(): void {
    const share = this.poolMax / this.members.length;
    const i = this.members.length;
    const slot = FORMATION_SLOTS[i % FORMATION_SLOTS.length];
    this.members.push({ index: i, alive: true, cooldown: this.def.weapon.cooldown * 0.5, offset: slot, pos: { x: this.pos.x + slot.x, y: this.pos.y + slot.y }, facing: this.facing, lastShot: -99 });
    this.poolMax += share;
    this.pool += share;
  }

  get alive(): boolean {
    return this.members.some((m) => m.alive);
  }
  get aliveCount(): number {
    return this.members.reduce((n, m) => n + (m.alive ? 1 : 0), 0);
  }
  get hp(): number {
    return this.pool;
  }
  get maxHp(): number {
    return this.poolMax;
  }
  /** How many soldiers the current pool supports (rounds up: a sliver of health keeps one standing). */
  get membersSupported(): number {
    return this.pool <= 0 ? 0 : Math.ceil((this.pool / this.poolMax) * this.members.length - 1e-9);
  }
  get levelName(): string {
    return BALANCE.combat.levels[this.level].name;
  }
  get dmgMult(): number {
    return BALANCE.combat.levels[this.level].dmg;
  }
  get currentOrder(): Order | undefined {
    return this.orders[0];
  }
}

export type ZombieState = 'idle' | 'wander' | 'investigate' | 'chase' | 'attack' | 'pulse' | 'roam';

export class Zombie implements Targetable {
  readonly id = newId();
  faction: Faction = 'zombie';
  hp: number;
  alive = true;
  state: ZombieState = 'idle';
  goal: Vec2 | null = null;
  targetId: number | null = null;
  attackCooldown = 0;
  thinkTimer: number;
  stuckTimer = 0;
  lastPos: Vec2;
  vel: Vec2 = { x: 0, y: 0 };
  knock: Vec2 = { x: 0, y: 0 };
  facing: number;
  homeHiveId: number | null = null;
  burning = 0;
  /** Seconds of "I know you're there" left after last seeing the target (doc §9, v4.2 aggro rule). */
  aggro = 0;
  /** Following the shared flow field (destination out of sight, or stuck). Re-checked every ~0.5 s. */
  useField = false;
  /** Seconds spent idle or wandering (round 12 #144: leftovers eventually come for your structures). */
  idleFor = 0;
  losTimer = 0;
  stuckFor = 0;
  /** Seconds spent pressed against a player structure while chasing a squad (v4.9). */
  wallTime = 0;

  maxHp: number;

  constructor(public def: ZombieDef, public pos: Vec2) {
    this.hp = this.maxHp = def.hp;
    // deterministic per-id jitter so zombies don't all think on the same tick
    const j = ((this.id * 2654435761) >>> 0) / 4294967296;
    this.thinkTimer = j;
    this.facing = j * Math.PI * 2;
    this.lastPos = { ...pos };
  }
  get threat(): ThreatClass {
    return this.def.threat;
  }
  get radius(): number {
    return this.def.radius;
  }
}

export class Hive implements Targetable {
  readonly id = newId();
  faction: Faction = 'zombie';
  threat = ThreatClass.Special;
  radius = 4; // metres
  hp: number;
  alive = true;
  stage = 1; // 1 Dormant … 4 Overrun (doc §9) — never regresses
  stageTimer = 0;
  spawnTimer = 0;
  pulseTimer: number;
  spawned = new Set<number>();

  constructor(public pos: Vec2, public districtId: string, hp: number, firstPulse: number) {
    this.hp = hp;
    this.pulseTimer = firstPulse;
  }
}

export class Structure implements Targetable {
  readonly id = newId();
  faction: Faction = 'player';
  threat = ThreatClass.Structure;
  hp: number;
  alive = true;
  built: boolean;
  buildProgress = 0;
  cooldown = 0;
  targetId: number | null = null;
  facing = 0;
  /** Outposts: local supply stock (doc §6 outpost resupply, Tier 1). */
  stock = 0;
  /** Production queue (barracks etc). */
  queue: { defId: string; remaining: number }[] = [];
  districtId: string | null = null;
  /** Footprint; sandbags and wire can be rotated 90°. */
  size: { w: number; h: number };
  /** Direction the field of fire points (radians, sim frame), for structures with an `arc` (v4.13). */
  aim = 0;
  /** Its `def.upgrade` has been bought (round 11 #129). */
  upgraded = false;

  /** The gun it fires: its own, or the one its upgrade adds. */
  get weapon() {
    return this.def.weapon ?? (this.upgraded ? this.def.upgrade?.weapon : undefined);
  }

  /** `tile` is the top-left nav cell; `size` is in cells. `pos`/`radius` are metres. */
  constructor(public def: StructureDef, public tile: { x: number; y: number }, built: boolean, rotated = false) {
    this.hp = built ? def.hp : def.hp * 0.1;
    this.built = built;
    this.size = rotated ? { w: def.size.h, h: def.size.w } : { ...def.size };
  }
  get pos(): Vec2 {
    return { x: (this.tile.x + this.size.w / 2) * CELL, y: (this.tile.y + this.size.h / 2) * CELL };
  }
  get radius(): number {
    return (Math.max(this.size.w, this.size.h) / 2) * CELL;
  }
}

export interface DemoCharge {
  id: number;
  pos: Vec2;
  fuse: number;
  ownerSquadId: number;
}

export interface ToxicCloud {
  id: number;
  pos: Vec2;
  radius: number;
  remaining: number;
  dps: number;
}
