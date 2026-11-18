import type { World } from '../World';
import { BALANCE } from '../../config/balance';
import { dist } from '../../core/math';

/** Civilians (STATUS #10): survivors brought to the Command Post are evacuated. */
export function updateCivilians(w: World): void {
  const cp = w.structures.find((s) => s.alive && s.def.id === 'commandPost');
  if (!cp) return;
  for (const s of w.squads)
    if (s.alive && s.def.category === 'civilian' && dist(s.pos, cp.pos) < cp.radius + BALANCE.civilians.evacRange) w.evacuate(s);
}
