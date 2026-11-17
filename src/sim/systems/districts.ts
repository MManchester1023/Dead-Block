import { BALANCE } from '../../config/balance';
import { isEnabled } from '../../config/features';
import { Hive, Structure } from '../entities';
import type { World } from '../World';

/** v4.9 (#65): squads brushing past, or gunfire next to, a building with dead inside brings them out. */
function updateNests(w: World, dt: number): void {
  w.nestTimer -= dt;
  if (w.nestTimer > 0) return;
  w.nestTimer = 0.5;
  const S = BALANCE.search;
  for (const b of w.map.buildings) {
    const st = w.buildingState.get(b.id);
    if (!st || st.nest <= 0) continue;
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
    if (d.def.id === 'base') continue;
    const hives = w.hives.filter((h) => h.alive && h.districtId === d.def.id);
    if (hives.length) {
      // doc §2: infestation can't hit zero while a hive lives, and it slowly creeps back
      d.infestation = Math.min(
        100,
        Math.max(BALANCE.infestation.floorWithHive, d.infestation + (BALANCE.infestation.regrowPerMinWithHive * hives.length * dt) / 60),
      );
    } else if (d.infestation > 0) {
      // v4.9 (playtest #40): with no hive left, infestation can't exceed what's still walking around,
      // so a district with nothing left to kill drains to 0 instead of sticking at a few percent
      const r = d.def.rect;
      let left = 0;
      for (const z of w.zombies) if (z.alive && z.pos.x >= r.x && z.pos.y >= r.y && z.pos.x < r.x + r.w && z.pos.y < r.y + r.h) left += BALANCE.infestation.perKill[z.def.id] ?? 0.5;
      if (d.infestation > left) d.infestation = Math.max(left, d.infestation - BALANCE.infestation.unpaidDrainPerSec * dt);
    }

    if (!d.cleared && d.infestation <= 0) {
      d.cleared = true;
      w.money += BALANCE.economy.districtClearBounty;
      w.events.emit('radio', {
        speaker: 'Command',
        text: `${d.def.name} reads 0% infestation. Get engineers in there and plant an outpost. +$${BALANCE.economy.districtClearBounty}`,
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
        if (d.def.starter && [...w.districts.values()].every((x) => x.secured))
          w.events.emit('victory', { reason: `${d.def.name} is secured. The first block is ours.` });
      }
    } else if (d.outpostId) {
      const op = w.get(d.outpostId);
      if (!(op instanceof Structure) || !op.alive) {
        // doc §19: a retaken region gets a hive where the outpost stood
        const pos = op ? { ...op.pos } : { x: d.def.rect.x + d.def.rect.w / 2, y: d.def.rect.y + d.def.rect.h / 2 };
        d.secured = false;
        d.cleared = false;
        d.outpostId = null;
        d.infestation = 40;
        w.commandCap -= BALANCE.economy.commandPerSecuredDistrict;
        if (isEnabled('regionTakeover')) {
          const hive = new Hive(pos, d.def.id, BALANCE.hive.hpByStage[0], w.tier(d.def.id).pulseIntervalSec[0]);
          w.hives.push(hive);
          w.registerHive(hive);
        }
        w.events.emit('districtLost', { districtId: d.def.id, name: d.def.name });
      }
    }
  }
}
