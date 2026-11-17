import { dist, type Vec2 } from '../../core/math';
import { BALANCE } from '../../config/balance';
import { isEnabled } from '../../config/features';
import { Squad, type Hive } from '../entities';
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

    // spawning within local + global caps
    for (const id of h.spawned) if (!w.get(id)) h.spawned.delete(id);
    h.spawnTimer -= dt;
    if (h.spawnTimer <= 0) {
      h.spawnTimer = H.spawnIntervalSec[h.stage - 1];
      const room = H.localCap[h.stage - 1] - h.spawned.size;
      for (let i = 0; i < Math.min(room, H.spawnGroup[h.stage - 1]); i++) spawnAt(w, h);
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
      h.pulseTimer = BALANCE.horde.pulseIntervalSec;
      pulse(w, h, loud ? 4 : 0);
    }
  }
}

function spawnAt(w: World, h: Hive): void {
  const roll = w.rng.next();
  // mostly Walkers while young; Runners and Bloaters creep in as the hive matures
  const bloater = 0.02 + 0.02 * (h.stage - 1);
  const runner = bloater + 0.06 + 0.07 * (h.stage - 1);
  const kind = roll < bloater ? 'bloater' : roll < runner ? 'runner' : 'walker';
  const a = w.rng.range(0, Math.PI * 2);
  const p = w.grid.nearestFree({ x: h.pos.x + Math.cos(a) * (h.radius + 2), y: h.pos.y + Math.sin(a) * (h.radius + 2) });
  const z = w.spawnZombie(kind, p, h.id);
  if (z) h.spawned.add(z.id);
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
  const size = BALANCE.horde.basePulseSize + BALANCE.horde.perStagePulseSize * (h.stage - 1) + bonus;
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
    const z = w.spawnZombie(w.rng.chance(0.1 + 0.07 * (h.stage - 1)) ? 'runner' : 'walker', w.grid.nearestFree({ x: h.pos.x + Math.cos(a) * (h.radius + 3), y: h.pos.y + Math.sin(a) * (h.radius + 3) }), h.id);
    if (!z) break;
    h.spawned.add(z.id);
    lure(z, target, 'pulse');
    sent++;
  }
  w.events.emit('hordePulse', { districtId: h.districtId, size: sent, target });
}
