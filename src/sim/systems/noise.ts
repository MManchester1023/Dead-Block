import { BALANCE } from '../../config/balance';
import type { World } from '../World';
import { lure } from './zombies';

/**
 * Noise (doc §9): each sound pulls nearby zombies in proportion to its loudness, and fills the
 * district's noise meter. A full meter triggers an immediate horde pulse from the district's hives.
 */
export function updateNoise(w: World, dt: number): void {
  for (const ev of w.noiseEvents) {
    if (ev.age > 0) continue;
    const r = ev.loudness * BALANCE.noise.hearingRadiusPerLoudness * 3;
    for (const z of w.zombieHash.query(ev.pos, r * 1.4)) {
      const heard = r * z.def.hearing;
      if ((z.pos.x - ev.pos.x) ** 2 + (z.pos.y - ev.pos.y) ** 2 <= heard * heard) lure(z, ev.pos, 'investigate');
    }
  }
  for (const ev of w.noiseEvents) ev.age += dt;
  w.noiseEvents = w.noiseEvents.filter((e) => e.age < 0.6);

  for (const d of w.districts.values()) {
    d.noise = Math.max(0, d.noise - BALANCE.noise.decayPerSec * dt);
  }
}
