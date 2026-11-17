import { dist, type Vec2 } from '../../core/math';
import { isEnabled } from '../../config/features';
import { SUPPORT_BY_ID } from '../../config/support';
import { newId } from '../entities';
import type { World } from '../World';

export interface PendingImpact {
  at: number;
  pos: Vec2;
  kind: 'shell';
}

export interface SupplyCrate {
  id: number;
  pos: Vec2;
  landsAt: number;
  landed: boolean;
  supplies: number;
}

/** Can this power be called right now? Returns a reason if not. */
export function supportBlocked(w: World, id: string): string | null {
  const def = SUPPORT_BY_ID[id];
  if (!def) return 'Unknown support';
  if (def.requires && !isEnabled(def.requires as never)) return `Locked: ${def.unlock}`;
  if (!w.structures.some((s) => s.alive && s.def.id === 'commandPost')) return 'Needs the Command Post';
  const ready = w.supportReadyAt.get(id) ?? 0;
  if (w.time < ready) return `Ready in ${Math.ceil(ready - w.time)} s`;
  if (!w.canAfford(def.cost)) return `Needs $${def.cost.money}${def.cost.supplies ? ` and ${def.cost.supplies} supplies` : ''}`;
  return null;
}

export function callSupport(w: World, id: string, pos: Vec2): string | null {
  const err = supportBlocked(w, id);
  if (err) return err;
  const def = SUPPORT_BY_ID[id];
  w.spend(def.cost);
  w.supportReadyAt.set(id, w.time + def.cooldown);
  w.events.emit('smoke', { pos: { ...pos }, color: def.smoke, duration: def.delay + 6 });
  if (id === 'artillery') {
    w.events.emit('radio', { speaker: 'Fire Direction', text: `Shot over. White smoke is the aim point, ${def.delay} seconds. Heads down.`, tone: 'warn' });
    for (let i = 0; i < 8; i++) {
      const a = w.rng.range(0, Math.PI * 2);
      const r = Math.sqrt(w.rng.next()) * 10;
      w.impacts.push({ at: w.time + def.delay + i * 0.5, pos: { x: pos.x + Math.cos(a) * r, y: pos.y + Math.sin(a) * r }, kind: 'shell' });
    }
  } else if (id === 'supplyDrop') {
    w.events.emit('radio', { speaker: 'Quartermaster', text: 'Crate inbound on the green smoke. Somebody go pick it up.', tone: 'info' });
    w.crates.push({ id: newId(), pos: w.grid.nearestFree(pos), landsAt: w.time + def.delay, landed: false, supplies: 45 });
  }
  return null;
}

export function updateSupport(w: World): void {
  if (w.impacts.length) {
    const due = w.impacts.filter((i) => i.at <= w.time);
    if (due.length) {
      w.impacts = w.impacts.filter((i) => i.at > w.time);
      for (const s of due) w.explode(s.pos, 5, 110, 'explosive', 2);
    }
  }
  for (const c of w.crates) {
    if (!c.landed && w.time >= c.landsAt) c.landed = true;
    if (!c.landed) continue;
    const taker = w.squads.find((s) => s.alive && dist(s.pos, c.pos) < 5);
    if (taker) {
      w.addSupplies(c.supplies);
      c.supplies = 0;
      w.events.emit('radio', { speaker: taker.name, text: `Got the crate. +${45} supplies.`, tone: 'good' });
    }
  }
  w.crates = w.crates.filter((c) => c.supplies > 0);
}
