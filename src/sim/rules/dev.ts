// Dev tool (STATUS #59, v4.81): spawn zombies and hives while playing, for testing. Plain sim commands, so
// they stay deterministic like everything else; the in-game dev menu (` key) calls them.
import type { Vec2 } from '../../core/math';
import { BALANCE } from '../../config/balance';
import { STRUCTURES, UNITS, ZOMBIES } from '../../config/units';
import { Hive, type Squad, type Structure, type Zombie } from '../entities';
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

/**
 * Round 18 #221: every friendly unit the dev menu can drop: what's in the game first, then the ones still to come
 * (they work as plain squads or vehicles until they get their own models and behaviour).
 */
export function devUnits(): { id: string; name: string; ready: boolean }[] {
  const ready = (id: string) => {
    const u = UNITS[id];
    return u.producedAt === 'none' || (!!STRUCTURES[u.producedAt] && !u.requires);
  };
  const ids = Object.keys(UNITS);
  return [...ids.filter(ready), ...ids.filter((id) => !ready(id))].map((id) => ({ id, name: UNITS[id].name, ready: ready(id) }));
}

/** …and every structure engineers can build. */
export function devBuildings(): { id: string; name: string }[] {
  const ids = new Set(Object.values(UNITS).flatMap((u) => u.canBuild ?? []));
  return [...ids].filter((id) => STRUCTURES[id]).map((id) => ({ id, name: STRUCTURES[id].name }));
}

/** A friendly unit at a point, free (no cost, no command cap); it waits there. */
export function devSpawnUnit(w: World, defId: string, at: Vec2): Squad | null {
  if (!UNITS[defId]) return null;
  return w.spawnSquad(defId, { x: at.x, y: at.y });
}

/** A finished structure, free and whether unlocked or not; it still has to fit. Returns it, or why not. */
export function devPlaceStructure(w: World, defId: string, tile: { x: number; y: number }, rotated = false, aim = 0): Structure | string {
  const err = w.canPlace(defId, tile, rotated, true);
  if (err) return err;
  return w.addStructure(defId, tile, true, rotated, aim);
}
