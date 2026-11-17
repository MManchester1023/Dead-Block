import { dist, norm, sub, type Vec2 } from '../../core/math';
import { Hive, Structure, type Zombie } from '../entities';
import { findPath } from '../pathfinding';
import type { Targetable } from '../types';
import type { World } from '../World';
import { blockingTile, moveWithCollision } from './movement';

const PATH_BUDGET_PER_TICK = 6;

export function updateZombies(w: World, dt: number): void {
  let pathBudget = PATH_BUDGET_PER_TICK;
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

    const target = w.get(z.targetId);
    let dest: Vec2 | null = null;
    if (target && target.alive) {
      const reach = z.radius + target.radius + 0.35;
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
    if (dist(z.pos, dest) < 0.6) {
      z.goal = null;
      z.path = [];
      if (z.state !== 'chase') z.state = 'idle';
      continue;
    }

    // heard something behind a building? get a real path instead of face-planting into the wall
    if (!z.path.length && z.goal && dest === z.goal && pathBudget > 0 && dist(z.pos, dest) > 4 && !w.grid.lineClear(z.pos, dest)) {
      pathBudget--;
      z.path = findPath(w.grid, z.pos, dest, 3000) ?? [];
    }

    // steer along an A* path if we have one, else beeline
    let wp = dest;
    if (z.path.length) {
      wp = z.path[0];
      if (dist(z.pos, wp) < 0.5) {
        z.path.shift();
        wp = z.path[0] ?? dest;
      }
    }
    const tile = w.grid.idx(Math.floor(z.pos.x), Math.floor(z.pos.y));
    const slow = w.grid.inBounds(Math.floor(z.pos.x), Math.floor(z.pos.y)) ? w.grid.slow[tile] : 1;
    const speed = z.def.speed * (z.state === 'idle' || z.state === 'wander' ? 0.5 : 1) * slow;
    const dir = norm(sub(wp, z.pos));
    z.facing = Math.atan2(dir.y, dir.x);
    const blocked = moveWithCollision(w.grid, z.pos, dir.x * speed * dt, dir.y * speed * dt, z.radius * 0.6);

    if (blocked) {
      // scratch at whatever player structure is in the way (sandbags, walls, outposts…)
      // Tier 2 hook: pile-ups let crowds climb `climbable` structures instead (doc §9).
      const occ = blockingTile(w.grid, z.pos, dir.x, dir.y, z.radius);
      const st = occ ? w.get(occ) : undefined;
      if (st instanceof Structure && st.alive && (z.state === 'chase' || z.state === 'pulse' || z.state === 'investigate')) {
        z.targetId = st.id;
        continue;
      }
    }

    // stuck detection → request a real path (budgeted)
    z.stuckTimer += dt;
    if (z.stuckTimer > 0.8) {
      const moved = dist(z.pos, z.lastPos);
      z.lastPos = { ...z.pos };
      z.stuckTimer = 0;
      if (moved < 0.4 && pathBudget > 0) {
        pathBudget--;
        z.path = findPath(w.grid, z.pos, dest, 2500) ?? [];
      }
    }
  }

  // crowd separation
  const tmp: Zombie[] = [];
  for (const z of w.zombies) {
    if (!z.alive) continue;
    tmp.length = 0;
    w.zombieHash.query(z.pos, 0.9, tmp);
    for (const o of tmp) {
      if (o === z) continue;
      const d = dist(z.pos, o.pos);
      const min = z.radius + o.radius;
      if (d < min && d > 0.0001) {
        const push = ((min - d) / 2) * 0.5;
        const dir = norm(sub(z.pos, o.pos));
        moveWithCollision(w.grid, z.pos, dir.x * push, dir.y * push, z.radius * 0.6);
      }
    }
  }
}

function think(w: World, z: Zombie): void {
  const cur = w.get(z.targetId);
  // keep scratching at a structure only while nothing tastier is near
  let best: Targetable | null = null;
  let bestD = z.def.sight;
  for (const s of w.squadHash.query(z.pos, z.def.sight)) {
    if (!s.alive) continue;
    const d = dist(z.pos, s.pos);
    if (d < bestD && (d < 2.5 || w.grid.lineClear(z.pos, s.pos))) {
      best = s;
      bestD = d;
    }
  }
  if (!best && cur instanceof Structure && cur.alive && dist(z.pos, cur.pos) < cur.radius + 3) return;
  if (!best) {
    for (const st of w.structures) {
      if (!st.alive || st.def.id === 'baseWall') continue;
      const d = dist(z.pos, st.pos) - st.radius;
      if (d < bestD * 0.6) {
        best = st;
        bestD = d;
      }
    }
  }
  if (best) {
    if (best.id !== z.targetId) z.path = [];
    z.targetId = best.id;
    z.state = 'chase';
    return;
  }
  z.targetId = null;
  if (z.state === 'chase' || z.state === 'attack') z.state = 'idle';
  if (!z.goal && z.state === 'idle' && w.rng.chance(0.15)) {
    const home = (z.homeHiveId && (w.get(z.homeHiveId) as Hive | undefined)?.pos) || z.pos;
    z.goal = w.grid.nearestFree({ x: home.x + w.rng.range(-6, 6), y: home.y + w.rng.range(-6, 6) });
    z.state = 'wander';
    z.path = [];
  }
}

/** Send a zombie toward a point (noise, horde pulse). Chasing zombies ignore it. */
export function lure(z: Zombie, pos: Vec2, state: 'investigate' | 'pulse'): void {
  if (z.state === 'chase' || z.state === 'attack') return;
  if (z.state === 'pulse' && state === 'investigate') return;
  const j = (((z.id * 2654435761) >>> 0) / 4294967296 - 0.5) * 3;
  const k = (((z.id * 40503) % 997) / 997 - 0.5) * 3;
  const goal = { x: pos.x + j, y: pos.y + k };
  // sustained fire from the same spot shouldn't wipe the path every tick
  const moved = !z.goal || (z.goal.x - goal.x) ** 2 + (z.goal.y - goal.y) ** 2 > 16;
  z.goal = goal;
  z.state = state;
  if (moved) z.path = [];
}
