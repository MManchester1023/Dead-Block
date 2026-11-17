import { BALANCE } from '../../config/balance';
import { isEnabled } from '../../config/features';
import { Hive, Structure } from '../entities';
import type { World } from '../World';

export function updateDistricts(w: World, dt: number): void {
  for (const d of w.districts.values()) {
    if (d.def.id === 'base') continue;
    const hives = w.hives.filter((h) => h.alive && h.districtId === d.def.id);
    if (hives.length) {
      // doc §2: infestation can't hit zero while a hive lives, and it slowly creeps back
      d.infestation = Math.min(
        100,
        Math.max(BALANCE.infestation.floorWithHive, d.infestation + (BALANCE.infestation.regrowPerMinWithHive * hives.length * dt) / 60),
      );
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
        if (isEnabled('regionTakeover')) {
          const hive = new Hive(pos, d.def.id, BALANCE.hive.hpByStage[0], BALANCE.horde.pulseIntervalSec);
          w.hives.push(hive);
          w.registerHive(hive);
        }
        w.events.emit('districtLost', { districtId: d.def.id, name: d.def.name });
      }
    }
  }
}
