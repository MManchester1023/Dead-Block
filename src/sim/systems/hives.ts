import { dist, type Vec2 } from '../../core/math';
import { BALANCE } from '../../config/balance';
import { isEnabled } from '../../config/features';
import { Squad, type Hive, type Zombie } from '../entities';
import { ZOMBIES } from '../../config/units';
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
      const room = broodRoom(w, h);
      const cap = T.normalPool[h.stage - 1] + T.mediumPool[h.stage - 1];
      // a hive that's been bled dry rebuilds faster (v4.9, playtest #32)
      const thin = h.spawned.size < cap * H.reinforceBelow;
      h.spawnTimer = T.spawnIntervalSec[h.stage - 1] * (thin ? H.reinforceRate : 1);
      for (let i = 0; i < T.spawnGroup[h.stage - 1]; i++) {
        // separate pools (v4.13 #75): a medium if its pool has room and the roll says so, else a normal
        const medium = room.medium > 0 && (room.normal <= 0 || w.rng.chance(T.mediumChance[h.stage - 1]));
        if (!medium && room.normal <= 0) break;
        const kind = medium ? pickMedium(w) : pickNormal(w, T.runnerShare[h.stage - 1]);
        if (!kind) break;
        if (!spawnAt(w, h, kind)) break;
        if (medium) room.medium--;
        else room.normal--;
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

/**
 * Room left in a hive's two pools (doc §9, v4.13 #75). Normal (Walker, Runner) and medium (every other
 * non-boss type) are counted separately; together they're the hive's total brood.
 */
export function broodRoom(w: World, h: Hive): { normal: number; medium: number } {
  const T = w.tier(h.districtId);
  let normal = 0;
  let medium = 0;
  for (const id of h.spawned) {
    const z = w.get(id) as Zombie | undefined;
    if (!z || !z.alive) continue;
    if (z.def.class === 'medium') medium++;
    else if (z.def.class === 'normal') normal++;
  }
  return { normal: T.normalPool[h.stage - 1] - normal, medium: T.mediumPool[h.stage - 1] - medium };
}

/** Walker or Runner. */
export function pickNormal(w: World, runnerShare: number): string {
  return w.rng.chance(runnerShare) ? 'runner' : 'walker';
}

/** Any enabled medium type (only the Bloater until special zombies are switched on). */
export function pickMedium(w: World): string | null {
  const types = Object.values(ZOMBIES).filter((d) => d.class === 'medium' && (!d.requires || isEnabled(d.requires as never)));
  return types.length ? w.rng.pick(types).id : null;
}

function spawnAt(w: World, h: Hive, kind: string): Zombie | null {
  const a = w.rng.range(0, Math.PI * 2);
  const p = w.grid.nearestFree({ x: h.pos.x + Math.cos(a) * (h.radius + 2), y: h.pos.y + Math.sin(a) * (h.radius + 2) });
  const z = w.spawnZombie(kind, p, h.id);
  if (z) h.spawned.add(z.id);
  return z;
}

/** Pulse target: nearest player outpost, else the base itself (through the gate, at the Command Post; v4.9 #60). */
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
  if (best) return best;
  const hq = w.structures.find((s) => s.alive && s.def.id === 'commandPost') ?? w.structures.find((s) => s.alive && s.def.id === 'barracks');
  const g = w.map.baseGate;
  return hq ? w.grid.nearestFree(hq.pos) : { x: g.x + g.w + 4, y: g.y + g.h / 2 };
}

export function pulse(w: World, h: Hive, bonus = 0): void {
  const size = Math.round((BALANCE.horde.basePulseSize + BALANCE.horde.perStagePulseSize * (h.stage - 1)) * w.tier(h.districtId).pulseSize) + bonus;
  const runnerShare = w.tier(h.districtId).runnerShare[h.stage - 1];
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
    // pulses are normals; the medium pool is for the hive's own brood
    const z = w.spawnZombie(pickNormal(w, runnerShare), w.grid.nearestFree({ x: h.pos.x + Math.cos(a) * (h.radius + 3), y: h.pos.y + Math.sin(a) * (h.radius + 3) }), h.id);
    if (!z) break;
    h.spawned.add(z.id);
    lure(z, target, 'pulse');
    sent++;
  }
  w.events.emit('hordePulse', { districtId: h.districtId, size: sent, target });
}
