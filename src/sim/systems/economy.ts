import { BALANCE } from '../../config/balance';
import { UNITS } from '../../config/units';
import type { World } from '../World';

export function updateEconomy(w: World, dt: number): void {
  const E = BALANCE.economy;
  const securedCount = [...w.districts.values()].filter((d) => d.secured && d.def.id !== 'base').length;
  w.money += (securedCount * E.securedDistrictMoneyPerMin * dt) / 60;

  w.dayTimer += dt;
  if (w.dayTimer >= E.dayLengthSec) {
    w.dayTimer -= E.dayLengthSec;
    w.day++;
    w.addSupplies(E.baseSuppliesPerDay + securedCount * E.securedDistrictSuppliesPerDay);
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
      const door = w.grid.nearestFree({ x: b.tile.x + b.def.size.w + 1, y: b.tile.y + b.def.size.h / 2 });
      const sq = w.spawnSquad(job.defId, door);
      const rally = w.grid.nearestFree({ x: w.map.rally.x + w.rng.range(-2, 2), y: w.map.rally.y + w.rng.range(-3, 3) });
      w.issueOrder([sq], { type: 'move', pos: rally });
      w.events.emit('unitProduced', { id: sq.id, defId: job.defId, name: `${sq.name} (${UNITS[job.defId].name})` });
    }
  }
}
