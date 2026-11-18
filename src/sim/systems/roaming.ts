import { BALANCE, HORDE } from '../../config/balance';
import { isEnabled } from '../../config/features';
import { Structure } from '../entities';
import type { Rect } from '../../core/math';
import type { DistrictState, World } from '../World';

/**
 * Roaming packs (STATUS #11, round 8 #88). Every few minutes a district's idle dead drift off in a pack
 * to a neighbouring open district. A neighbour with an outpost is the likelier destination, and a pack
 * that finds one tears into it, so outposts have to be fortified and held, not just planted. Packs settle
 * where they end up; dead loose in a secured district raise its infestation and cut its income
 * (districts.ts / economy.ts) until someone clears them out.
 *
 * Rates come from the source district's difficulty tier (`roam`); the tutorial region doesn't roam.
 */
export function updateRoaming(w: World, dt: number): void {
  if (!isEnabled('roaming')) return;
  updateStragglers(w, dt);
  const R = BALANCE.roaming;
  for (const d of w.districts.values()) {
    if (d.def.id === 'base' || d.locked) continue;
    const T = w.tier(d.def.id).roam;
    if (!T) continue;
    d.roamTimer -= dt;
    if (d.roamTimer > 0) continue;
    const hasHive = w.hives.some((h) => h.alive && h.districtId === d.def.id);
    d.roamTimer = w.rng.range(T.everySec[0], T.everySec[1]) * (hasHive ? 1 : R.noHiveSlower);
    sendPack(w, d, [Math.round(T.group[0] * HORDE.count), Math.round(T.group[1] * HORDE.count)]);
  }
}

/** Neighbouring districts: their rectangles touch (within a few metres). */
export function neighbours(w: World, d: DistrictState): DistrictState[] {
  const a = d.def.rect;
  const m = BALANCE.roaming.neighbourGap;
  return [...w.districts.values()].filter((o) => {
    if (o === d) return false;
    const b = o.def.rect;
    return a.x - m < b.x + b.w && b.x - m < a.x + a.w && a.y - m < b.y + b.h && b.y - m < a.y + a.h;
  });
}

const inside = (r: Rect, p: { x: number; y: number }) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

/** Pick a pack of idle dead in `d` and send it next door. Returns how many went (0 if none could). */
export function sendPack(w: World, d: DistrictState, group: readonly [number, number]): number {
  const R = BALANCE.roaming;
  const dests = neighbours(w, d).filter((o) => !o.locked && o.def.id !== 'base');
  if (!dests.length) return 0;
  const idle = w.zombies.filter((z) => z.alive && (z.state === 'idle' || z.state === 'wander') && inside(d.def.rect, z.pos));
  const size = Math.min(idle.length, w.rng.int(group[0], group[1]));
  if (size < group[0]) return 0;

  // destination: an outpost next door (likelier), else somewhere in a neighbouring district
  const outposts = dests
    .map((o) => (o.outpostId != null ? w.get(o.outpostId) : undefined))
    .filter((s): s is Structure => s instanceof Structure && s.alive);
  let to: DistrictState;
  let goal: { x: number; y: number };
  let outpost: Structure | undefined;
  if (outposts.length && w.rng.chance(R.outpostBias)) {
    outpost = w.rng.pick(outposts);
    to = w.districts.get(outpost.districtId!)!;
    goal = w.grid.nearestFree(outpost.pos);
  } else {
    to = w.rng.pick(dests);
    const r = to.def.rect;
    goal = w.grid.nearestFree({ x: r.x + r.w * w.rng.range(0.2, 0.8), y: r.y + r.h * w.rng.range(0.2, 0.8) });
  }

  // the pack: the idle dead closest to one of them, so they set off together
  const lead = w.rng.pick(idle);
  idle.sort((a, b) => Math.hypot(a.pos.x - lead.pos.x, a.pos.y - lead.pos.y) - Math.hypot(b.pos.x - lead.pos.x, b.pos.y - lead.pos.y));
  const pack = idle.slice(0, size);
  for (const z of pack) {
    // they leave their hive's brood (it can breed replacements) and settle wherever they end up
    if (z.homeHiveId != null) {
      const h = w.hives.find((x) => x.id === z.homeHiveId);
      h?.spawned.delete(z.id);
      z.homeHiveId = null;
    }
    z.state = 'roam';
    z.targetId = null;
    z.goal = { x: goal.x + w.rng.range(-3, 3), y: goal.y + w.rng.range(-3, 3) };
    z.useField = false;
  }
  w.events.emit('roamers', { from: d.def.id, to: to.def.id, count: pack.length, outpostId: outpost?.id ?? null, pos: { ...lead.pos } });
  // round 11 #132: no radio call for a pack setting off (the CONTESTED alert on arrival stays)
  return pack.length;
}

/**
 * Round 12 #144: dead left idle in a district whose hives are gone (stragglers, the last of a pack)
 * don't stand around for ever. After `stragglerIdleSec` they head for the nearest structure of yours in
 * that district, or failing that the nearest outpost next door, and tear into it (the 'roam' state, as packs do).
 */
export function updateStragglers(w: World, dt: number): void {
  const R = BALANCE.roaming;
  for (const z of w.zombies) {
    if (!z.alive) continue;
    if (z.state !== 'idle' && z.state !== 'wander') {
      z.idleFor = 0;
      continue;
    }
    z.idleFor += dt;
    if (z.idleFor < R.stragglerIdleSec) continue;
    z.idleFor = R.stragglerIdleSec / 2; // nothing to go for: look again in a minute
    const d = w.districtAt(z.pos);
    if (!d || d.def.id === 'base' || d.locked) continue;
    if (w.hives.some((h) => h.alive && h.districtId === d.def.id)) continue;
    const mine = (s: Structure) => s.alive && s.faction === 'player' && s.def.id !== 'baseWall' && !(s.def.restore && !s.built);
    let best: Structure | undefined;
    let bestD = Infinity;
    for (const s of w.structures) {
      if (!mine(s) || !inside(d.def.rect, s.pos)) continue;
      const dd = (s.pos.x - z.pos.x) ** 2 + (s.pos.y - z.pos.y) ** 2;
      if (dd < bestD) (best = s), (bestD = dd);
    }
    if (!best)
      for (const o of neighbours(w, d)) {
        const op = o.outpostId != null ? w.get(o.outpostId) : undefined;
        if (!(op instanceof Structure) || !mine(op)) continue;
        const dd = (op.pos.x - z.pos.x) ** 2 + (op.pos.y - z.pos.y) ** 2;
        if (dd < bestD) (best = op), (bestD = dd);
      }
    if (!best) continue;
    z.idleFor = 0;
    z.state = 'roam';
    z.targetId = null;
    z.goal = w.grid.nearestFree({ x: best.pos.x + w.rng.range(-2, 2), y: best.pos.y + w.rng.range(-2, 2) });
    z.useField = false;
  }
}
