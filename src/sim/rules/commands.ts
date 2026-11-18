import { norm, sub } from '../../core/math';
import { BALANCE } from '../../config/balance';
import { isEnabled } from '../../config/features';
import { STRUCTURES, UNITS } from '../../config/units';
import type { Hive, Squad, Structure } from '../entities';
import type { BuildingDef } from '../map';
import type { Order, Targetable } from '../types';
import type { World } from '../World';

/**
 * Player commands (called by input and UI through World): orders, production, building, and the
 * checks behind them. Each returns an error message for the HUD, or null when it went through.
 */

export function issueOrder(w: World, squads: Squad[], order: Order, queue = false): void {
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
      o.pos = w.grid.nearestFree({ x: order.pos.x + perp.x * k - dir.x * back, y: order.pos.y + perp.y * k - dir.y * back });
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

export function stop(squads: Squad[]): void {
  for (const s of squads) {
    s.orders = [];
    s.path = [];
    s.holding = false;
    s.targetId = null;
  }
}

export function queueProduction(w: World, defId: string): string | null {
  const def = UNITS[defId];
  if (!def) return 'Unknown unit';
  if (def.requires && !isEnabled(def.requires as never)) return `Locked — ${def.unlock}`;
  const producer = w.structures.find((s) => s.alive && s.def.id === def.producedAt);
  if (!producer) return `Needs ${def.producedAt}`;
  if (w.commandUsed + def.command > w.commandCap) return 'Command cap reached';
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

/** Buy a structure's one-time upgrade (round 11 #129: the outpost garrison). */
export function upgradeStructure(w: World, st: Structure): string | null {
  const up = st.def.upgrade;
  if (!up) return 'Nothing to upgrade';
  if (st.upgraded) return `${up.name} already bought`;
  if (!st.built) return 'Finish building it first';
  if (!w.spend(up.cost)) return 'Not enough money or supplies';
  st.upgraded = true;
  w.events.emit('radio', { speaker: 'Command', text: `${up.name} in place at the ${st.def.name.toLowerCase()}.`, tone: 'good' });
  return null;
}

/** Search a building for supplies (v4.9 #46): ~5 s at the door, interrupted by getting hit. */
export function orderSearch(w: World, squads: Squad[], b: BuildingDef, queue = false): string | null {
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
