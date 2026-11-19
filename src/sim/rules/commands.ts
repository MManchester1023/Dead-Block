import { norm, sub, type Vec2 } from '../../core/math';
import { BALANCE } from '../../config/balance';
import { isEnabled } from '../../config/features';
import { STRUCTURES, UNITS } from '../../config/units';
import { Squad } from '../entities';
import type { Hive, Structure } from '../entities';
import type { BuildingDef } from '../map';
import type { Formation, FormationShape, Order, Targetable } from '../types';
import type { World } from '../World';

/**
 * Player commands (called by input and UI through World): orders, production, building, and the
 * checks behind them. Each returns an error message for the HUD, or null when it went through.
 */

/**
 * Where each squad of a group stands, relative to the point (round 14 #177): `right` along the front,
 * `back` behind it, in metres. Fighters take the front slots, support (engineers) the rear ones.
 */
export function formationSlots(n: number, shape: FormationShape, width?: number): { right: number; back: number }[] {
  const sp = 6; // metres between squads
  const out: { right: number; back: number }[] = [];
  if (shape === 'line' || shape === 'spread') {
    const gap = width && n > 1 ? Math.max(4, Math.min(shape === 'spread' ? 24 : 14, width / (n - 1))) : shape === 'spread' ? sp * 2 : sp;
    for (let i = 0; i < n; i++) out.push({ right: (i - (n - 1) / 2) * gap, back: 0 });
  } else if (shape === 'column') {
    for (let i = 0; i < n; i++) out.push({ right: 0, back: i * sp });
  } else if (shape === 'wedge') {
    for (let i = 0; i < n; i++) {
      const row = Math.ceil(i / 2);
      const side = i === 0 ? 0 : i % 2 ? -1 : 1;
      out.push({ right: side * row * sp, back: row * sp });
    }
  } else {
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    for (let i = 0; i < n; i++) out.push({ right: ((i % cols) - (cols - 1) / 2) * sp, back: Math.floor(i / cols) * sp - ((rows - 1) * sp) / 2 });
  }
  return out;
}

export function issueOrder(w: World, squads: Squad[], order: Order, queue = false, formation?: Formation): void {
  // round 17 #207: a vehicle told where to go revs off (a sound cue; once per order)
  if (['move', 'attackMove', 'attack', 'patrol'].includes(order.type))
    for (const s of squads) if (s.def.category === 'vehicle') w.events.emit('vehicleOrdered', { id: s.id, pos: { ...s.pos } });
  for (const s of squads) {
    if (!queue) {
      s.autoCrouch = false;
      s.seekCover = false;
    }
  }
  // formations for multi-squad moves (doc §4; round 14 #177 adds shapes and a dragged facing): fighters in
  // front, support behind; default a line facing the way the group is going
  const n = squads.length;
  const center = squads.reduce((a, s) => ({ x: a.x + s.pos.x / n, y: a.y + s.pos.y / n }), { x: 0, y: 0 });
  const toward = norm(sub(order.pos, center));
  const ang = formation?.facing ?? Math.atan2(toward.y, toward.x);
  const dir = { x: Math.cos(ang), y: Math.sin(ang) };
  const perp = { x: -dir.y, y: dir.x };
  const isSupport = (s: Squad) => !!s.def.canBuild?.length;
  const ordered = [...squads.filter((s) => !isSupport(s)), ...squads.filter(isSupport)];
  const shape = formation?.shape ?? 'line';
  const slots = formationSlots(n, shape, formation?.width).sort((a, b) => a.back - b.back);
  const slot = new Map<Squad, { k: number; back: number }>();
  if (shape === 'line' && !formation?.width) {
    // the original layout: a line of fighters, support one rank (7 m) behind
    const front = ordered.filter((s) => !isSupport(s));
    const rear = ordered.filter(isSupport);
    const ranks = front.length ? [front, rear] : [rear];
    ranks.forEach((rank, r) => rank.forEach((s, i) => slot.set(s, { k: (i - (rank.length - 1) / 2) * 6, back: r * 7 })));
  } else ordered.forEach((s, i) => slot.set(s, { k: slots[i].right, back: slots[i].back }));
  squads.forEach((s) => {
    const o: Order = { ...order, pos: { ...order.pos } };
    if (n > 1 && (order.type === 'move' || order.type === 'attackMove')) {
      const { k, back } = slot.get(s)!;
      o.pos = w.grid.nearestFree({ x: order.pos.x + perp.x * k - dir.x * back, y: order.pos.y + perp.y * k - dir.y * back });
    }
    if (formation?.facing !== undefined) o.face = formation.facing;
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

/**
 * Patrol (round 14 #174): loop from where each squad stands through the given point(s), fighting what it
 * meets, until given another order. With `add`, a squad already patrolling gets the point appended to its
 * loop. Several squads keep their spacing (each one's loop is shifted by its offset from the group centre).
 */
export function orderPatrol(w: World, squads: Squad[], p: Vec2, add = false): void {
  const n = squads.length;
  if (!n) return;
  const center = squads.reduce((a, s) => ({ x: a.x + s.pos.x / n, y: a.y + s.pos.y / n }), { x: 0, y: 0 });
  for (const s of squads) {
    const off = { x: s.pos.x - center.x, y: s.pos.y - center.y };
    const k = Math.min(1, 8 / (Math.hypot(off.x, off.y) || 1)); // keep the group within ~8 m of each point
    const at = w.grid.nearestFree({ x: p.x + off.x * k, y: p.y + off.y * k });
    const cur = s.currentOrder;
    if (add && cur?.type === 'patrol' && cur.route) {
      cur.route.push(at);
      continue;
    }
    s.orders = [{ type: 'patrol', pos: at, route: [{ ...s.pos }, at], leg: 1 }];
    s.path = [];
    s.holding = false;
    s.buildProgress = 0;
    s.autoCrouch = false;
    s.seekCover = false;
  }
}

export function stop(squads: Squad[]): void {
  for (const s of squads) {
    s.orders = [];
    s.path = [];
    s.holding = false;
    s.targetId = null;
  }
}

/** Campaign unlocks for units (STATUS #20): medics once a Med Bay stands (also true for saves from before the unlock existed). */
export function unitUnlocked(w: World, defId: string): boolean {
  const key = UNITS[defId]?.unlockKey;
  if (!key) return true;
  if (w.unlocked.has(key)) return true;
  return key === 'medic' && w.structures.some((s) => s.alive && s.built && s.def.id === 'medBay');
}

/**
 * Heal (STATUS #20): medics walk to a hurt squad, treat it for a moment, and restore part of its health;
 * lost soldiers rejoin. One use per `cooldown` per medic team.
 */
export function orderHeal(w: World, squads: Squad[], target: Squad, queue = false): string | null {
  const medics = squads.filter((s) => s.alive && s.def.abilities?.includes('heal') && s !== target);
  if (!medics.length) return 'Only medics can heal';
  if (!target.alive) return 'Nobody left to treat';
  if (target.def.category === 'vehicle') return 'Medics treat people, not vehicles';
  if (target.pool >= target.poolMax && target.aliveCount >= target.members.length) return `${target.name} isn't hurt`;
  const ready = medics.filter((s) => w.time >= s.healReadyAt);
  if (!ready.length) return `Heal ready in ${Math.ceil(Math.min(...medics.map((s) => s.healReadyAt)) - w.time)} s`;
  issueOrder(w, ready.slice(0, 1), { type: 'heal', pos: { ...target.pos }, targetId: target.id }, queue);
  return null;
}

export function queueProduction(w: World, defId: string): string | null {
  const def = UNITS[defId];
  if (!def) return 'Unknown unit';
  if (def.requires && !isEnabled(def.requires as never)) return `Locked — ${def.unlock}`;
  if (!unitUnlocked(w, defId)) return `Locked — ${def.unlock}`;
  const producer = w.structures.find((s) => s.alive && s.def.id === def.producedAt);
  if (!producer) return `Needs ${def.producedAt}`;
  if (w.hasCommandCap && w.commandUsed + def.command > w.commandCap) return 'Command cap reached';
  if (!w.spend(def.cost)) return 'Not enough money or supplies';
  producer.queue.push({ defId, remaining: def.buildTime });
  return null;
}

/** A structure's footprint in cells (sandbags and wire can be turned 90°). */
export function footprint(defId: string, rotated = false): { w: number; h: number } {
  const sz = STRUCTURES[defId].size;
  return rotated ? { w: sz.h, h: sz.w } : { ...sz };
}

/** Validates a construction site (doc §6: engineers can build anywhere). */
export function canPlace(w: World, defId: string, tile: { x: number; y: number }, rotated = false): string | null {
  const def = STRUCTURES[defId];
  if (!def) return 'Unknown structure';
  if (def.requires && !isEnabled(def.requires as never)) return 'Locked';
  if (def.unlock && !w.unlocked.has(def.unlock)) return 'Not unlocked yet';
  if (def.restore) return "Can't be built: it's restored where it stands";
  if (def.baseOnly) {
    const fp0 = footprint(defId, rotated);
    const d = w.districtAt({ x: (tile.x + fp0.w / 2) * w.grid.cell, y: (tile.y + fp0.h / 2) * w.grid.cell });
    if (d?.def.id !== 'base') return `${def.name} goes inside the main base`;
  }
  const fp = footprint(defId, rotated);
  if (!w.grid.rectFree(tile.x, tile.y, fp.w, fp.h)) return 'Blocked';
  if (def.requiresSecured) {
    const d = w.districtAt({ x: (tile.x + fp.w / 2) * w.grid.cell, y: (tile.y + fp.h / 2) * w.grid.cell });
    if (!d || d.def.id === 'base') return 'Outposts go in a district';
    if (d.outpostId) return 'District already has an outpost';
    if (w.hives.some((h) => h.alive && h.districtId === d.def.id)) return 'Destroy the hive first';
    if (d.infestation > BALANCE.infestation.outpostMax) return `Infestation must be ${BALANCE.infestation.outpostMax}% or less (now ${Math.ceil(d.infestation)}%)`;
  }
  const c = { x: (tile.x + fp.w / 2) * w.grid.cell, y: (tile.y + fp.h / 2) * w.grid.cell };
  for (const z of w.zombieHash.query(c, Math.max(fp.w, fp.h) * w.grid.cell * 0.5 + 1.5)) if (z.alive) return 'Zombies in the way';
  if (!w.canAfford(def.cost)) return 'Not enough money or supplies';
  return null;
}

export function orderBuild(w: World, engineers: Squad[], defId: string, tile: { x: number; y: number }, queue = false, rotated = false, aim = 0): string | null {
  const eng = engineers.filter((s) => s.def.canBuild?.includes(defId));
  if (!eng.length) return 'Needs an Engineer Team';
  const err = canPlace(w, defId, tile, rotated);
  if (err) return err;
  const def = STRUCTURES[defId];
  w.spend(def.cost);
  const site = w.addStructure(defId, tile, false, rotated, aim);
  issueOrder(w, eng, { type: 'build', pos: site.pos, targetId: site.id, buildDef: defId }, queue);
  return null;
}

export function orderCharge(w: World, engineers: Squad[], hive: Hive, queue = false): string | null {
  const eng = engineers.filter((s) => s.def.abilities?.includes('demoCharge'));
  if (!eng.length) return 'Only engineers carry demo charges';
  issueOrder(w, eng.slice(0, 1), { type: 'charge', pos: hive.pos, targetId: hive.id }, queue);
  return null;
}

/** Round 11 #125: toggle crouching for these squads (all crouch unless all already are). */
export function toggleCrouch(squads: Squad[]): boolean {
  squads = squads.filter((s) => s.def.category !== 'vehicle'); // STATUS #51
  const on = !squads.every((s) => s.crouched);
  for (const s of squads) {
    s.crouched = on;
    s.autoCrouch = false;
  }
  return on;
}

/** Why a structure's upgrade can't be installed right now, or null if it can. */
export function upgradeBlocked(w: World, st: Structure): string | null {
  const up = st.def.upgrade;
  if (!up) return 'Nothing to upgrade';
  if (st.upgraded) return `${up.name} already installed`;
  if (!st.built) return 'Finish building it first';
  if (!w.canAfford(up.cost)) return 'Not enough money or supplies';
  return null;
}

/**
 * Round 12 #138: engineers install a structure's upgrade (the outpost Garrison): they walk over and work
 * for `workSec`, then it's paid for and done. With no team given, the nearest engineer team goes.
 */
export function orderUpgrade(w: World, squads: Squad[], st: Structure, queue = false): string | null {
  const err = upgradeBlocked(w, st);
  if (err) return err;
  let eng = squads.filter((s) => s.alive && s.def.canBuild?.length);
  if (!squads.length) {
    const all = w.squads.filter((s) => s.alive && s.def.canBuild?.length);
    const free = all.filter((s) => !s.orders.length);
    const pool = free.length ? free : all;
    pool.sort((a, b) => Math.hypot(a.pos.x - st.pos.x, a.pos.y - st.pos.y) - Math.hypot(b.pos.x - st.pos.x, b.pos.y - st.pos.y));
    eng = pool.slice(0, 1);
  }
  if (!eng.length) return 'Needs an engineer team';
  issueOrder(w, eng, { type: 'upgrade', pos: st.pos, targetId: st.id }, queue);
  w.events.emit('radio', { speaker: eng[0].name, text: `On our way to install the ${st.def.upgrade!.name.toLowerCase()}.`, tone: 'info' });
  return null;
}

/** Finish an upgrade: pay and switch it on (called when the engineers' work is done). */
export function upgradeStructure(w: World, st: Structure): string | null {
  const up = st.def.upgrade;
  const err = upgradeBlocked(w, st);
  if (err || !up) return err;
  w.spend(up.cost);
  st.upgraded = true;
  w.events.emit('radio', { speaker: 'Command', text: `${up.name} in place at the ${st.def.name.toLowerCase()}.`, tone: 'good' });
  return null;
}

/** Search a building for supplies (v4.9 #46): ~5 s at the door, interrupted by getting hit. */
/**
 * STATUS #51: infantry climb into a vehicle with seats (one squad per vehicle, up to `seats` soldiers).
 * The first squad that fits gets the order.
 */
export function orderBoard(w: World, squads: Squad[], vehicle: Squad, queue = false): string | null {
  const seats = vehicle.def.seats ?? 0;
  if (!seats || !vehicle.alive) return `${vehicle.def.name} can't carry anyone`;
  if (vehicle.cargo != null && w.get(vehicle.cargo)?.alive) return `${vehicle.name} already has a squad aboard`;
  const riders = squads.filter((s) => s.alive && s.def.category === 'infantry' && s.inVehicle == null);
  if (!riders.length) return 'Only infantry squads can ride';
  const fits = riders.find((s) => s.aliveCount <= seats);
  if (!fits) return `Too many soldiers: ${seats} seats`;
  issueOrder(w, [fits], { type: 'board', pos: { ...vehicle.pos }, targetId: vehicle.id }, queue);
  return null;
}

/** STATUS #51: the passenger squad climbs out beside the vehicle. */
export function unload(w: World, vehicle: Squad, bailOut = false): Squad | null {
  const p = vehicle.cargo != null ? w.get(vehicle.cargo) : undefined;
  vehicle.cargo = null;
  if (!(p instanceof Squad) || !p.alive) return null;
  p.inVehicle = null;
  const side = w.grid.nearestFree({ x: vehicle.pos.x + Math.cos(vehicle.facing + Math.PI / 2) * 3, y: vehicle.pos.y + Math.sin(vehicle.facing + Math.PI / 2) * 3 });
  p.pos.x = side.x;
  p.pos.y = side.y;
  p.members.forEach((m, i) => {
    m.pos.x = side.x + ((i % 3) - 1) * 0.9;
    m.pos.y = side.y + (Math.floor(i / 3) - 0.5) * 0.9;
  });
  p.orders = [];
  p.path = [];
  w.events.emit('squadUnloaded', { vehicleId: vehicle.id, squadId: p.id, bailOut });
  w.events.emit('radio', { speaker: p.name, text: bailOut ? `${vehicle.name} is gone! We're out, we're on foot!` : 'Dismounted.', tone: bailOut ? 'bad' : 'info' });
  return p;
}

/** STATUS #51: unload every selected vehicle that has someone aboard. */
export function orderUnload(w: World, vehicles: Squad[]): string | null {
  const full = vehicles.filter((v) => v.alive && v.cargo != null);
  if (!full.length) return 'Nobody aboard';
  for (const v of full) unload(w, v);
  return null;
}

export function orderSearch(w: World, squads: Squad[], b: BuildingDef, queue = false): string | null {
  squads = squads.filter((s) => s.def.category !== 'vehicle'); // STATUS #51: a Humvee can't search a house
  if (!squads.length) return 'Vehicles can\'t search buildings';
  const st = w.buildingState.get(b.id);
  if (!st) return 'Nothing to search there';
  if (st.searched) return 'Already searched';
  const c = { x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h / 2 };
  issueOrder(w, squads, { type: 'search', pos: c, targetId: b.id }, queue);
  return null;
}

/** Man a guard tower (v4.13). One squad per tower. */
export function orderGarrison(w: World, squads: Squad[], tower: Structure, queue = false): string | null {
  if (!tower.def.garrison) return 'Only guard towers can be manned';
  squads = squads.filter((s) => s.def.category !== 'vehicle');
  if (!squads.length) return 'Vehicles can\'t man a tower';
  if (!tower.built) return 'Finish building it first';
  const occupant = w.squads.find((s) => s.alive && s.garrisonedIn === tower.id);
  if (occupant) return `${occupant.name} is already up there`;
  const sq = squads.filter((s) => s.def.category === 'infantry').slice(0, 1);
  if (!sq.length) return 'Needs an infantry squad';
  issueOrder(w, sq, { type: 'garrison', pos: tower.pos, targetId: tower.id }, queue);
  return null;
}

/** Climb down from a tower to the nearest free spot. */
export function leaveTower(w: World, s: Squad): void {
  if (s.garrisonedIn == null) return;
  const tower = w.get(s.garrisonedIn);
  s.garrisonedIn = null;
  const at = tower ? tower.pos : s.pos;
  const out = w.grid.nearestFree({ x: at.x + 4, y: at.y + 1 });
  s.pos.x = out.x;
  s.pos.y = out.y;
  for (const m of s.members) (m.pos.x = out.x), (m.pos.y = out.y);
  s.path = [];
}

/** Send squads back to the Barracks to stand down (v4.9 #55). Frees command and upkeep, refunds a little. */
export function orderDisband(w: World, squads: Squad[]): string | null {
  const b = w.structures.find((s) => s.alive && s.def.id === 'barracks');
  if (!b) return 'No Barracks to return to';
  const door = w.grid.nearestFree({ x: b.pos.x + b.radius + 1, y: b.pos.y });
  for (const s of squads) {
    s.orders = [{ type: 'disband', pos: door }];
    s.path = [];
    s.targetId = null;
    s.holding = false;
  }
  return null;
}

/** A disbanding squad reached the Barracks: gone, with part of its cost back. */
export function standDown(w: World, s: Squad): void {
  if (!s.alive) return;
  const k = BALANCE.economy.disbandRefund;
  const refund = { money: Math.round(s.def.cost.money * k), supplies: Math.round(s.def.cost.supplies * k) };
  w.money += refund.money;
  w.addSupplies(refund.supplies);
  for (const m of s.members) m.alive = false;
  w.forget(s.id);
  w.events.emit('radio', { speaker: 'Barracks', text: `${s.name} stood down. +$${refund.money} and +${refund.supplies} supplies back in stores.`, tone: 'info' });
}

export function orderDeconstruct(w: World, engineers: Squad[], s: Structure, queue = false): string | null {
  const eng = engineers.filter((e) => e.def.canBuild?.length);
  if (!eng.length) return 'Only engineers can deconstruct';
  const err = w.canDeconstruct(s);
  if (err) return err;
  issueOrder(w, eng, { type: 'deconstruct', pos: s.pos, targetId: s.id }, queue);
  return null;
}

/** Engineers pick an unfinished site back up where it was left (v4.4). */
export function orderResume(w: World, engineers: Squad[], site: Structure, queue = false): string | null {
  // STATUS #50: a run-down Med Bay waits for the hospital's equipment
  if (site.def.derelict && !w.unlocked.has(site.def.derelict.needs)) return `${site.def.derelict.why} first`;
  const eng = engineers.filter((e) => e.def.canBuild?.length);
  if (!eng.length) return 'Only engineers can build';
  if (site.built) return 'Already built';
  issueOrder(w, eng, { type: 'build', pos: site.pos, targetId: site.id, buildDef: site.def.id }, queue);
  return null;
}

/** Engineers patch up damaged structures, paying supplies as they go (v4.4). */
export function orderRepair(w: World, engineers: Squad[], st: Structure, queue = false): string | null {
  const eng = engineers.filter((e) => e.def.canBuild?.length);
  if (!eng.length) return 'Only engineers can repair';
  if (!st.built) return orderResume(w, eng, st, queue);
  if (st.hp >= st.def.hp) return 'Not damaged';
  issueOrder(w, eng, { type: 'repair', pos: st.pos, targetId: st.id }, queue);
  return null;
}

/** Supplies to fully restore `hp` of a structure: half its supply cost per full bar, minimum a trickle. */
export function repairCost(st: Structure, hp: number): number {
  return (Math.max(4, st.def.cost.supplies) * 0.5 * hp) / st.def.hp;
}

export function orderAttack(w: World, squads: Squad[], target: Targetable, queue = false): void {
  issueOrder(w, squads, { type: 'attack', pos: { ...target.pos }, targetId: target.id }, queue);
}
