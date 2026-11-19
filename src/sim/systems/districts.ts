import { BALANCE } from '../../config/balance';
import { isEnabled } from '../../config/features';
import { Hive, Structure } from '../entities';
import type { World } from '../World';
import { infestationPerKill } from '../rules/damage';

/** v4.9 (#65): squads brushing past, or gunfire next to, a building with dead inside brings them out. */
function updateNests(w: World, dt: number): void {
  w.nestTimer -= dt;
  if (w.nestTimer > 0) return;
  w.nestTimer = 0.5;
  const S = BALANCE.search;
  for (const b of w.map.buildings) {
    const st = w.buildingState.get(b.id);
    if (!st || st.nest <= 0) continue;
    if (w.districtAt({ x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h / 2 })?.locked) continue;
    const r = b.rect;
    const near = (p: { x: number; y: number }, m: number) => p.x > r.x - m && p.x < r.x + r.w + m && p.y > r.y - m && p.y < r.y + r.h + m;
    const sq = w.squads.find((s) => s.alive && near(s.pos, S.nestTriggerRange) && s.currentOrder?.type !== 'search');
    if (sq) {
      w.releaseNest(b, sq.pos);
      continue;
    }
    const loud = w.noiseEvents.find((e) => e.age < 0.6 && e.loudness >= 1.5 && near(e.pos, S.nestNoiseRange));
    if (loud) w.releaseNest(b, loud.pos);
  }
}

export function updateDistricts(w: World, dt: number): void {
  updateNests(w, dt);
  for (const d of w.districts.values()) {
    if (d.def.id === 'base' || d.locked) continue;
    const hives = w.hives.filter((h) => h.alive && h.districtId === d.def.id);
    if (hives.length) {
      // doc §2: infestation can't hit zero while a hive lives, and it slowly creeps back
      d.infestation = Math.min(
        100,
        Math.max(BALANCE.infestation.floorWithHive, d.infestation + (BALANCE.infestation.regrowPerMinWithHive * hives.length * dt) / 60),
      );
    } else if (!d.secured) {
      // With no hive left, infestation tracks what's still walking around (v4.9 #40: it can't sit above
      // it, so an empty district drains to 0) and round 9 #98: it can't reach 0 while anything is left
      // (kills of zombies that wandered in or came out of buildings used to zero it early).
      const r = d.def.rect;
      let left = 0;
      let alive = 0;
      for (const z of w.zombies)
        if (z.alive && z.pos.x >= r.x && z.pos.y >= r.y && z.pos.x < r.x + r.w && z.pos.y < r.y + r.h) {
          left += infestationPerKill(z.def.id);
          alive++;
        }
      if (alive > 0 && d.infestation < 1) d.infestation = 1;
      else if (d.infestation > left) d.infestation = Math.max(alive > 0 ? 1 : left, d.infestation - BALANCE.infestation.unpaidDrainPerSec * dt);
    }

    // round 11 #120: clear enough for an outpost at <= 2% once the hives are dead (stragglers left
    // inside make the secured district CONTESTED, which deals with them)
    if (!d.cleared && !hives.length && d.infestation <= BALANCE.infestation.outpostMax) {
      d.cleared = true;
      w.money += BALANCE.economy.districtClearBounty;
      const left = w.deadIn(d.def.id);
      w.events.emit('radio', {
        speaker: 'Command',
        text: `${d.def.name} is as good as clear${left ? ` (${left} dead still wandering)` : ''}. Get engineers in there and plant an outpost. +$${BALANCE.economy.districtClearBounty}`,
        tone: 'good',
      });
    }

    if (!d.secured) {
      const op = w.structures.find((s) => s.alive && s.built && s.def.id === 'outpost' && s.districtId === d.def.id);
      if (op) {
        d.secured = true;
        d.outpostId = op.id;
        d.infestation = 0;
        w.commandCap += BALANCE.economy.commandPerSecuredDistrict;
        w.events.emit('districtSecured', { districtId: d.def.id, name: d.def.name });
        // the next tutorial region opens (doc §17)
        for (const n of w.districts.values()) if (n.locked && n.def.unlockAfter === d.def.id) w.unlockDistrict(n.def.id);
        if (d.def.starter && [...w.districts.values()].every((x) => x.secured))
          w.events.emit('victory', { reason: `${d.def.name} is secured. The first block is ours.` });
      }
    } else if (d.outpostId) {
      // STATUS #11: dead loose inside a secured district (roamers, stragglers) raise its infestation,
      // which cuts its income (economy.ts); cleared out, it falls back to 0
      const R = BALANCE.roaming;
      const r = d.def.rect;
      let inside = 0;
      for (const z of w.zombies) if (z.alive && z.pos.x >= r.x && z.pos.y >= r.y && z.pos.x < r.x + r.w && z.pos.y < r.y + r.h) inside++;
      if (inside) {
        d.infestation = Math.min(R.securedCap, d.infestation + (inside * R.securedCreepPerZombiePerMin * dt) / 60);
        if (!d.contested) {
          d.contested = true;
          w.events.emit('districtContested', { districtId: d.def.id, name: d.def.name });
          w.events.emit('radio', { speaker: 'Overwatch', text: `Dead inside ${d.def.name}. Clear them out before they eat into the income.`, tone: 'warn' });
        }
      } else {
        d.infestation = Math.max(0, d.infestation - (R.securedRecoverPerMin * dt) / 60);
        if (d.infestation <= 0) d.contested = false;
      }
      const op = w.get(d.outpostId);
      if (!(op instanceof Structure) || !op.alive) {
        // doc §19: a retaken region gets a hive where the outpost stood
        const pos = op ? { ...op.pos } : { x: d.def.rect.x + d.def.rect.w / 2, y: d.def.rect.y + d.def.rect.h / 2 };
        d.secured = false;
        d.cleared = false;
        d.contested = false;
        d.outpostId = null;
        d.infestation = 40;
        w.commandCap -= BALANCE.economy.commandPerSecuredDistrict;
        if (isEnabled('regionTakeover')) {
          const hive = new Hive(pos, d.def.id, BALANCE.hive.hpByStage[0]);
          w.hives.push(hive);
          w.registerHive(hive);
        }
        w.events.emit('districtLost', { districtId: d.def.id, name: d.def.name });
      }
    }
  }
}
