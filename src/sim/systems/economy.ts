import { BALANCE } from '../../config/balance';
import { UNITS } from '../../config/units';
import type { World } from '../World';

/**
 * Secured districts paying income, weighted by how much of each is still really ours: dead loose inside
 * (STATUS #11) cut a district's share, down to nothing at the roaming cap.
 */
export function securedShare(w: World): number {
  let n = 0;
  for (const d of w.districts.values())
    if (d.secured && d.def.id !== 'base') n += Math.max(0, 1 - d.infestation / BALANCE.roaming.securedCap);
  return n;
}

/** Current income rates per minute, for the HUD. */
export function incomeRates(w: World): { money: number; supplies: number } {
  const E = BALANCE.economy;
  const secured = securedShare(w);
  return { money: Math.round(secured * E.securedDistrictMoneyPerMin), supplies: Math.round(E.baseSuppliesPerMin + secured * E.securedDistrictSuppliesPerMin) };
}

export function updateEconomy(w: World, dt: number): void {
  const E = BALANCE.economy;
  const securedCount = securedShare(w);
  w.money += (securedCount * E.securedDistrictMoneyPerMin * dt) / 60;
  w.addSupplies(((E.baseSuppliesPerMin + securedCount * E.securedDistrictSuppliesPerMin) * dt) / 60);

  w.dayTimer += dt;
  if (w.dayTimer >= E.dayLengthSec) {
    w.dayTimer -= E.dayLengthSec;
    w.day++;
    // daily upkeep (doc §11): one predictable payment per active unit per day
    const upkeep = w.squads.reduce((n, s) => n + (s.alive ? s.def.upkeep : 0), 0);
    let paid = true;
    if (w.supplies >= upkeep) w.supplies -= upkeep;
    else {
      const short = upkeep - w.supplies;
      w.supplies = 0;
      if (w.money >= short * 2) w.money -= short * 2; // emergency purchase at a markup
      else paid = false;
    }
    w.events.emit('newDay', { day: w.day, upkeep, paid });
  }

  // production queues
  for (const b of w.structures) {
    if (!b.alive || !b.queue.length) continue;
    const job = b.queue[0];
    job.remaining -= dt;
    if (job.remaining <= 0) {
      b.queue.shift();
      const door = w.grid.nearestFree({ x: b.pos.x + b.radius + 3, y: b.pos.y });
      const sq = w.spawnSquad(job.defId, door);
      const rally = w.grid.nearestFree({ x: w.map.rally.x + w.rng.range(-6, 6), y: w.map.rally.y + w.rng.range(-8, 8) });
      w.issueOrder([sq], { type: 'move', pos: rally });
      w.events.emit('unitProduced', { id: sq.id, defId: job.defId, name: `${sq.name} (${UNITS[job.defId].name})` });
    }
  }
}

/**
 * Med Bay (v4.17): squads resting next to a powered Med Bay heal over time, paying supplies, and
 * soldiers rejoin as the squad's health climbs back past each member's share. A wiped squad is gone.
 */
export function updateMedical(w: World, dt: number): void {
  for (const bay of w.structures) {
    const H = bay.def.heal;
    if (!H || !bay.alive || !bay.built) continue;
    if (bay.def.needsPower && !w.powerOnline) continue; // (STATUS #50: the Med Bay has its own generator now)
    for (const s of w.squadHash.query(bay.pos, H.radius + bay.radius + 4)) {
      if (!s.alive || s.moving || s.pool >= s.poolMax || s.inVehicle != null || s.def.category === 'vehicle') continue;
      if (Math.hypot(s.pos.x - bay.pos.x, s.pos.y - bay.pos.y) > H.radius + bay.radius) continue;
      if (w.time - s.lastHit < H.restAfterHitSec) continue;
      let hp = Math.min(s.poolMax - s.pool, s.poolMax * H.perSec * dt);
      const cost = hp * H.suppliesPerHp;
      if (w.supplies < cost) {
        if (w.supplies <= 0) continue;
        hp = w.supplies / H.suppliesPerHp;
      }
      w.supplies = Math.max(0, w.supplies - hp * H.suppliesPerHp);
      s.pool += hp;
      s.healing = w.time;
      // lost soldiers rejoin as health comes back
      while (s.aliveCount < s.membersSupported) {
        const m = s.members.find((x) => !x.alive);
        if (!m) break;
        m.alive = true;
        m.pos.x = bay.pos.x;
        m.pos.y = bay.pos.y + bay.radius;
        w.events.emit('memberRejoined', { squadId: s.id, squadName: s.name, pos: { ...m.pos } });
      }
    }
  }
}
