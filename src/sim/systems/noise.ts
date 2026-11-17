import { BALANCE } from '../../config/balance';
import type { World } from '../World';
import { lure } from './zombies';
import { Hive, type Zombie } from '../entities';
import { dist } from '../../core/math';

/**
 * Noise (doc §9): each sound pulls nearby zombies in proportion to its loudness, and fills the
 * district's noise meter. A full meter triggers an immediate horde pulse from the district's hives.
 */
export function updateNoise(w: World, dt: number): void {
  for (const ev of w.noiseEvents) {
    if (ev.age > 0) continue;
    const r = Math.min(BALANCE.noise.maxHearingRadius, ev.loudness * BALANCE.noise.hearingRadiusPerLoudness);
    for (const z of w.zombieHash.query(ev.pos, r * 1.4)) {
      const heard = Math.min(BALANCE.noise.maxHearingRadius, r * z.def.hearing);
      const d = Math.hypot(z.pos.x - ev.pos.x, z.pos.y - ev.pos.y);
      if (d > heard || !responds(w, z, d, heard)) continue;
      lure(z, ev.pos, 'investigate');
    }
  }
  for (const ev of w.noiseEvents) ev.age += dt;
  w.noiseEvents = w.noiseEvents.filter((e) => e.age < 0.6);

  // v4.9 (playtest #43): the meter holds after the last sound, then drains gently
  for (const d of w.districts.values()) {
    if (d.noiseHold > 0) d.noiseHold -= dt;
    else d.noise = Math.max(0, d.noise - BALANCE.noise.decayPerSec * dt);
  }
}

/**
 * Not every zombie answers a distant sound (v4.9, playtest #32: a few shots at the gate used to drag
 * the whole district into the kill zone). Within half the hearing radius everyone comes; beyond that
 * the share falls to `farResponse` at the edge. Each zombie has a fixed attentiveness, so repeating
 * the shot doesn't eventually pull them all. Hive-born zombies near home guard it unless the sound is close.
 */
function responds(w: World, z: Zombie, d: number, heard: number): boolean {
  const N = BALANCE.noise;
  if (z.state === 'chase' || z.state === 'attack') return true; // lure() ignores them anyway
  if (z.homeHiveId != null && d > N.guardHearing) {
    const home = w.get(z.homeHiveId);
    if (home instanceof Hive && home.alive && dist(z.pos, home.pos) < N.guardRadius) return false;
  }
  const t = d / heard;
  if (t <= 0.5) return true;
  const share = 1 - (1 - N.farResponse) * ((t - 0.5) / 0.5);
  const attentive = (((z.id * 2246822519) >>> 0) % 1000) / 1000;
  return attentive < share;
}
