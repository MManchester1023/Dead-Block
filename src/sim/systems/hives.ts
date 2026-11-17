import { dist, type Vec2 } from '../../core/math';
import { BALANCE } from '../../config/balance';
import { isEnabled } from '../../config/features';
import { Squad, type Hive, type Zombie } from '../entities';
import type { World } from '../World';
import { lure } from './zombies';

export function updateHives(w: World, dt: number): void {
  if (!isEnabled('hives')) return;
  const H = BALANCE.hive;
  for (const h of w.hives) {
    if (!h.alive) continue;
    // permanent stage progression (doc §9) — never regresses
    if (h.stage < 4) {
      h.stageTimer += dt;
      if (h.stageTimer >= H.stageDurationSec[h.stage - 1]) {
        h.stageTimer = 0;
        h.stage++;
        h.hp += H.hpByStage[h.stage - 1] - H.hpByStage[h.stage - 2]; // matures: tougher to crack
        w.events.emit('hiveStage', { hiveId: h.id, stage: h.stage, districtId: h.districtId });
      }
    }

    // hive alarm: intruders near the hive draw every zombie around it (no sprinting in to plant a charge)
    const intruder = w.squadHash.query(h.pos, H.alarmRadius + h.radius).find((s) => s.alive);
    if (intruder) {
      for (const z of w.zombieHash.query(h.pos, H.alarmCallRadius)) {
        if (!z.alive || z.targetId === intruder.id) continue;
        if (z.state === 'attack' && w.get(z.targetId) instanceof Squad) continue; // already busy eating someone
        z.targetId = intruder.id;
        z.state = 'chase';
        z.aggro = BALANCE.zombie.aggroTimeSec;
      }
    }

    // spawning within local + global caps; rates come from the district's difficulty tier
    const T = w.tier(h.districtId);
    for (const id of h.spawned) if (!w.get(id)) h.spawned.delete(id);
    h.spawnTimer -= dt;
    if (h.spawnTimer <= 0) {
      const cap = T.localCap[h.stage - 1];
      // a hive that's been bled dry rebuilds faster (v4.9, playtest #32)
      const thin = h.spawned.size < cap * H.reinforceBelow;
      h.spawnTimer = T.spawnIntervalSec[h.stage - 1] * (thin ? H.reinforceRate : 1);
      const room = cap - h.spawned.size;
      let specials = specialRoom(w, h.districtId);
      for (let i = 0; i < Math.min(room, T.spawnGroup[h.stage - 1]); i++) {
        const z = spawnAt(w, h, specials > 0);
        if (z && isSpecial(z)) specials--;
      }
    }

    // horde pulses (doc §11) — on a timer, or immediately when the district's noise meter fills
    const d = w.districts.get(h.districtId);
    h.pulseTimer -= dt;
    const loud = isEnabled('noise') && !!d && d.noise >= BALANCE.noise.pulseThreshold;
    if (h.pulseTimer <= 0 || loud) {
      if (loud && d) {
        w.events.emit('noiseAlert', { districtId: d.def.id });
        d.noise = 0;
      }
      h.pulseTimer = T.pulseIntervalSec[h.stage - 1];
      pulse(w, h, loud ? 4 : 0);
    }
  }
}

const isSpecial = (z: Zombie | undefined): boolean => !!z && z.def.id !== 'walker';

/**
 * How many more Runners/Bloaters the district may hold right now (v4.9, playtest #53): a share of
 * its zombies, never more than the tier's hard ceiling.
 */
export function specialRoom(w: World, districtId: string): number {
  const d = w.districts.get(districtId);
  if (!d) return 0;
  const T = w.tier(districtId);
  const r = d.def.rect;
  let total = 0;
  let specials = 0;
  for (const z of w.zombies) {
    if (!z.alive || z.pos.x < r.x || z.pos.y < r.y || z.pos.x >= r.x + r.w || z.pos.y >= r.y + r.h) continue;
    total++;
    if (isSpecial(z)) specials++;
  }
  return Math.max(0, Math.min(T.specialMax, Math.floor(total * T.specialShare) + 1) - specials);
}

function spawnAt(w: World, h: Hive, allowSpecial: boolean): Zombie | null {
  const roll = w.rng.next();
  // mostly Walkers while young; Runners and Bloaters creep in as the hive matures (capped per district)
  const bloater = 0.02 + 0.02 * (h.stage - 1);
  const runner = bloater + 0.06 + 0.07 * (h.stage - 1);
  const kind = !allowSpecial ? 'walker' : roll < bloater ? 'bloater' : roll < runner ? 'runner' : 'walker';
  const a = w.rng.range(0, Math.PI * 2);
  const p = w.grid.nearestFree({ x: h.pos.x + Math.cos(a) * (h.radius + 2), y: h.pos.y + Math.sin(a) * (h.radius + 2) });
  const z = w.spawnZombie(kind, p, h.id);
  if (z) h.spawned.add(z.id);
  return z;
}

/** Pulse target: nearest player outpost, else the base gate. */
export function pulseTarget(w: World, from: Vec2): Vec2 {
  let best: Vec2 | null = null;
  let bestD = Infinity;
  for (const s of w.structures) {
    if (!s.alive || s.def.id !== 'outpost' || !s.built) continue;
    const d = dist(from, s.pos);
    if (d < bestD) {
      bestD = d;
      best = s.pos;
    }
  }
  const g = w.map.baseGate;
  return best ?? { x: g.x + g.w + 4, y: g.y + g.h / 2 };
}

export function pulse(w: World, h: Hive, bonus = 0): void {
  const size = Math.round((BALANCE.horde.basePulseSize + BALANCE.horde.perStagePulseSize * (h.stage - 1)) * w.tier(h.districtId).pulseSize) + bonus;
  let specials = specialRoom(w, h.districtId);
  const target = pulseTarget(w, h.pos);
  let sent = 0;
  // recruit idle zombies near the hive first, then spawn the remainder
  for (const z of w.zombieHash.query(h.pos, 30)) {
    if (sent >= size) break;
    if (z.state === 'chase' || z.state === 'attack' || z.state === 'pulse') continue;
    lure(z, target, 'pulse');
    sent++;
  }
  while (sent < size) {
    const a = w.rng.range(0, Math.PI * 2);
    const runner = specials > 0 && w.rng.chance(0.1 + 0.07 * (h.stage - 1));
    if (runner) specials--;
    const z = w.spawnZombie(runner ? 'runner' : 'walker', w.grid.nearestFree({ x: h.pos.x + Math.cos(a) * (h.radius + 3), y: h.pos.y + Math.sin(a) * (h.radius + 3) }), h.id);
    if (!z) break;
    h.spawned.add(z.id);
    lure(z, target, 'pulse');
    sent++;
  }
  w.events.emit('hordePulse', { districtId: h.districtId, size: sent, target });
}
