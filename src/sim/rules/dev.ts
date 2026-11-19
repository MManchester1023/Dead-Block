// Dev tool (STATUS #59, v4.81): spawn zombies and hives while playing, for testing. Plain sim commands, so
// they stay deterministic like everything else; the in-game dev menu (` key) calls them.
import type { Vec2 } from '../../core/math';
import { BALANCE } from '../../config/balance';
import { ZOMBIES } from '../../config/units';
import { Hive, type Zombie } from '../entities';
import type { World } from '../World';

/** Drop `count` zombies of a type around a point (a loose spiral); `hunt`: they go for the nearest squad. */
export function devSpawnZombies(w: World, kind: string, at: Vec2, count: number, hunt: boolean): Zombie[] {
  if (!ZOMBIES[kind]) return [];
  const out: Zombie[] = [];
  for (let i = 0; i < count; i++) {
    const a = i * 2.4; // golden-ish angle: an even spread
    const r = 1.3 * Math.sqrt(i);
    const z = w.spawnZombie(kind, { x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r });
    if (!z) break; // at the global cap
    if (hunt) {
      let best: { id: number; d: number } | null = null;
      for (const s of w.squads) {
        if (!s.alive || s.inVehicle != null || s.def.category === 'civilian') continue;
        const d = Math.hypot(s.pos.x - z.pos.x, s.pos.y - z.pos.y);
        if (!best || d < best.d) best = { id: s.id, d };
      }
      if (best) {
        z.targetId = best.id;
        z.state = 'chase';
        z.aggro = 60;
      }
    }
    out.push(z);
  }
  return out;
}

/** Put a hive down at a stage (1–4); it belongs to the region it lands in (the base if none) and acts like any other. */
export function devSpawnHive(w: World, at: Vec2, stage: number): Hive {
  const st = Math.max(1, Math.min(4, Math.round(stage)));
  const pos = w.grid.nearestFree(at);
  const district = w.districtAt(pos)?.def.id ?? 'base';
  const hive = new Hive({ ...pos }, district, BALANCE.hive.hpByStage[st - 1], w.tier(district).firstPulseDelaySec);
  hive.stage = st;
  w.hives.push(hive);
  w.registerHive(hive);
  return hive;
}

/** Every zombie gone (hives stay). Returns how many. */
export function devClearZombies(w: World): number {
  let n = 0;
  for (const z of w.zombies)
    if (z.alive) {
      z.alive = false;
      n++;
    }
  return n;
}
