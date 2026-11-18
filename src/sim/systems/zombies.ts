import { dist, type Vec2 } from '../../core/math';
import { BALANCE } from '../../config/balance';
import { Hive, Squad, Structure, type Zombie } from '../entities';
import type { Targetable } from '../types';
import type { World } from '../World';
import { blockingTile, moveWithCollision } from './movement';

const HQ = new Set(['commandPost', 'barracks', 'supplyDepot']);

export function updateZombies(w: World, dt: number): void {
  for (const z of w.zombies) {
    if (!z.alive) continue;

    // knockback (doc §5 v4)
    if (Math.abs(z.knock.x) + Math.abs(z.knock.y) > 0.01) {
      moveWithCollision(w.grid, z.pos, z.knock.x * dt, z.knock.y * dt, z.radius * 0.6);
      const k = Math.exp(-5 * dt);
      z.knock.x *= k;
      z.knock.y *= k;
      continue;
    }

    z.thinkTimer -= dt;
    if (z.thinkTimer <= 0) {
      z.thinkTimer = 0.35 + w.rng.next() * 0.3;
      think(w, z);
    }
    z.attackCooldown -= dt;
    z.aggro = Math.max(0, z.aggro - dt);

    const target = w.get(z.targetId);
    let dest: Vec2 | null = null;
    if (target && target.alive) {
      const reach = z.radius + target.radius + 0.6; // metres
      if (dist(z.pos, target.pos) <= reach) {
        z.state = 'attack';
        z.facing = Math.atan2(target.pos.y - z.pos.y, target.pos.x - z.pos.x);
        if (z.attackCooldown <= 0) {
          z.attackCooldown = z.def.attackCooldown;
          w.damage(target, z.def.damage, 'melee', z.pos);
        }
        continue;
      }
      dest = target instanceof Structure ? w.grid.nearestFree(target.pos) : target.pos;
      z.state = 'chase';
    } else {
      z.targetId = null;
      if (z.goal) dest = z.goal;
    }
    if (!dest) continue;
    if (dist(z.pos, dest) < 1.2) {
      z.goal = null;
      if (z.state !== 'chase') z.state = 'idle';
      continue;
    }

    // Can we see where we're going? Checked a couple of times a second, not every tick. If not (a sound
    // behind a building, prey that ducked out of sight, or we're stuck), follow the shared flow field
    // toward the destination instead of face-planting into walls (v4.5 crowd tech; replaces per-zombie A*).
    z.losTimer -= dt;
    const roaming = z.state === 'wander' || z.state === 'idle';
    if (z.losTimer <= 0) {
      z.losTimer = 0.4 + ((z.id * 0.37) % 1) * 0.3;
      z.useField = !roaming && (z.stuckFor > 0 || (dist(z.pos, dest) > 8 && !w.grid.lineClear(z.pos, dest)));
      if (z.stuckFor > 0) z.stuckFor -= 1;
    }
    let dx = dest.x - z.pos.x;
    let dy = dest.y - z.pos.y;
    if (z.useField) {
      const f = w.flow.direction(w.flow.field(dest), z.pos);
      if (f) (dx = f.x), (dy = f.y);
    }
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;
    const speed = z.def.speed * (roaming ? 0.5 : 1) * w.grid.slowAt(z.pos);
    z.facing = Math.atan2(dy, dx);
    const blocked = moveWithCollision(w.grid, z.pos, dx * speed * dt, dy * speed * dt, z.radius * 0.6);

    if (blocked) {
      // Tier 2 hook: pile-ups let crowds climb `climbable` structures instead (doc §9).
      const occ = blockingTile(w.grid, z.pos, dx, dy, z.radius);
      const st = occ ? w.get(occ) : undefined;
      if (st instanceof Structure && st.alive) {
        if (target instanceof Squad && target.alive) {
          // v4.9 (#52): prey first. Go around the sandbags; only claw through them when there's
          // really no way round, and keep the squad as the target throughout.
          z.wallTime += dt;
          if (z.wallTime < 2.5) {
            z.useField = true;
            z.stuckFor = Math.max(z.stuckFor, 2);
          } else if (z.attackCooldown <= 0) {
            z.attackCooldown = z.def.attackCooldown;
            z.state = 'attack';
            w.damage(st, z.def.damage, 'melee', z.pos);
          }
          continue;
        }
        // v4.9 (#60): the perimeter wall isn't worth chewing on; the flow field takes them to the gate.
        // An offline power station (v4.17) is just scenery to them until it's running.
        if (st.def.id === 'baseWall' || (st.def.restore && !st.built)) {
          z.useField = true;
          z.stuckFor = Math.max(z.stuckFor, 2);
        } else if (z.state === 'chase' || z.state === 'pulse' || z.state === 'investigate') {
          // scratch at whatever else is in the way (sandbags across the gate, an outpost…)
          z.targetId = st.id;
          continue;
        }
      }
    } else if (z.wallTime > 0) z.wallTime = Math.max(0, z.wallTime - dt * 0.5);

    // stuck (pressed against a car, a corner…): switch to the flow field for a few checks
    z.stuckTimer += dt;
    if (z.stuckTimer > 0.8) {
      const moved = Math.hypot(z.pos.x - z.lastPos.x, z.pos.y - z.lastPos.y);
      z.lastPos.x = z.pos.x;
      z.lastPos.y = z.pos.y;
      z.stuckTimer = 0;
      if (moved < 1 && !roaming) {
        z.stuckFor = 4;
        z.useField = true;
      }
    }
  }

  // crowd separation: sum the pushes from overlapping neighbours, then one collision-checked move
  const tmp: Zombie[] = [];
  for (const z of w.zombies) {
    if (!z.alive) continue;
    tmp.length = 0;
    w.zombieHash.query(z.pos, 1.6, tmp);
    let px = 0;
    let py = 0;
    for (const o of tmp) {
      if (o === z) continue;
      const ox = z.pos.x - o.pos.x;
      const oy = z.pos.y - o.pos.y;
      const d = Math.hypot(ox, oy);
      const min = z.radius + o.radius;
      if (d < min && d > 0.0001) {
        const push = ((min - d) / 2) * 0.5;
        px += (ox / d) * push;
        py += (oy / d) * push;
      }
    }
    if (px || py) moveWithCollision(w.grid, z.pos, px, py, z.radius * 0.6);
  }
}

function think(w: World, z: Zombie): void {
  const cur = w.get(z.targetId);
  let best: Targetable | null = null;
  let bestD = z.def.sight;
  for (const s of w.squadHash.query(z.pos, z.def.sight)) {
    if (!s.alive) continue;
    // the dead go for civilians first (STATUS #10)
    const d = dist(z.pos, s.pos) * (s.def.category === 'civilian' ? BALANCE.civilians.preyBias : 1);
    if (d < bestD && (d < 5 || w.grid.lineClear(z.pos, s.pos))) {
      best = s;
      bestD = d;
    }
  }

  // Aggro (v4.2): time-based first, then distance-based. A zombie that has seen a squad hunts it
  // for aggroTimeSec even out of sight, then keeps coming while it's within leashDistance.
  if (cur instanceof Squad && cur.alive) {
    if (best === cur) z.aggro = BALANCE.zombie.aggroTimeSec; // still in view: refresh
    const curD = dist(z.pos, cur.pos);
    const hunting = z.aggro > 0 || curD <= BALANCE.zombie.leashDistance;
    // only switch prey for something clearly closer
    if (hunting && !(best && best !== cur && bestD < curD * 0.6)) {
      z.state = 'chase';
      return;
    }
  }
  if (best instanceof Squad) {
    z.targetId = best.id;
    z.state = 'chase';
    z.aggro = BALANCE.zombie.aggroTimeSec;
    return;
  }

  // keep scratching at a structure only while nothing tastier is near
  if (!best && cur instanceof Structure && cur.alive && dist(z.pos, cur.pos) < cur.radius + 6) return;
  if (!best) {
    // v4.9 (#60): HQ buildings draw them from much further than sandbags and nests
    for (const st of w.structures) {
      if (!st.alive || st.def.id === 'baseWall' || (st.def.restore && !st.built)) continue;
      const hq = HQ.has(st.def.id);
      const d = dist(z.pos, st.pos) - st.radius - (hq ? 30 : 0);
      if (d < bestD * 0.6) {
        best = st;
        bestD = d;
      }
    }
  }
  if (best) {
    z.targetId = best.id;
    z.state = 'chase';
    return;
  }
  z.targetId = null;
  if (z.state === 'chase' || z.state === 'attack') z.state = 'idle';
  if (!z.goal && z.state === 'idle' && w.rng.chance(0.15)) {
    const home = (z.homeHiveId && (w.get(z.homeHiveId) as Hive | undefined)?.pos) || z.pos;
    z.goal = w.grid.nearestFree({ x: home.x + w.rng.range(-14, 14), y: home.y + w.rng.range(-14, 14) });
    z.state = 'wander';
  }
}

/** Send a zombie toward a point (noise, horde pulse). Chasing zombies ignore it. */
export function lure(z: Zombie, pos: Vec2, state: 'investigate' | 'pulse'): void {
  if (z.state === 'chase' || z.state === 'attack') return;
  if (z.state === 'pulse' && state === 'investigate') return;
  const j = (((z.id * 2654435761) >>> 0) / 4294967296 - 0.5) * 6;
  const k = (((z.id * 40503) % 997) / 997 - 0.5) * 6;
  const goal = { x: pos.x + j, y: pos.y + k };
  // sustained fire from the same spot shouldn't wipe the path every tick
  const moved = !z.goal || (z.goal.x - goal.x) ** 2 + (z.goal.y - goal.y) ** 2 > 64;
  z.goal = goal;
  z.state = state;
  if (moved) z.useField = false; // new destination: re-check line of sight
}
