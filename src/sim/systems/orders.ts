import { dist, norm, sub, type Vec2 } from '../../core/math';
import { ABILITIES } from '../../config/units';
import { Hive, Structure, type Squad } from '../entities';
import { newId } from '../entities';
import { findPath } from '../pathfinding';
import type { World } from '../World';
import { moveWithCollision } from './movement';

const ARRIVE = 1; // metres
const BODY = 0.9; // squad-centre collision radius, metres

export function updateOrders(w: World, dt: number): void {
  for (const s of w.squads) {
    if (!s.alive) continue;
    applyKnock(w, s, dt);
    if (s.stunned > 0) {
      s.stunned -= dt;
      updateMembers(w, s, dt);
      continue;
    }
    s.moving = false;
    const o = s.currentOrder;
    if (o) {
      switch (o.type) {
        case 'move':
        case 'cover':
          if (moveToward(w, s, o.pos, dt, ARRIVE)) {
            s.orders.shift();
            s.path = [];
            if (o.type === 'cover') s.holding = true;
          }
          break;
        case 'attackMove': {
          const t = w.get(s.targetId);
          if (t && t.alive) break; // stop and fight, resume when clear
          if (moveToward(w, s, o.pos, dt, ARRIVE)) {
            s.orders.shift();
            s.path = [];
          }
          break;
        }
        case 'build':
          doBuild(w, s, dt);
          break;
        case 'charge':
          doCharge(w, s, dt);
          break;
        case 'attack':
          doAttack(w, s, dt);
          break;
        case 'deconstruct':
          doDeconstruct(w, s, dt);
          break;
        default:
          s.orders.shift();
      }
    }
    separate(w, s, dt);
    updateCover(w, s);
    updateMembers(w, s, dt);
  }
}

function applyKnock(w: World, s: Squad, dt: number): void {
  if (Math.abs(s.knock.x) + Math.abs(s.knock.y) < 0.01) return;
  moveWithCollision(w.grid, s.pos, s.knock.x * dt, s.knock.y * dt, BODY);
  const decay = Math.exp(-6 * dt);
  s.knock.x *= decay;
  s.knock.y *= decay;
  s.path = [];
}

/** Returns true on arrival. */
export function moveToward(w: World, s: Squad, dest: Vec2, dt: number, arrive: number): boolean {
  if (dist(s.pos, dest) <= arrive) return true;
  if (s.pathFor && dist(s.pathFor, dest) > 3) s.path = []; // destination moved (chasing a target)
  if (!s.path.length || s.pathVersion !== w.grid.version) {
    s.path = findPath(w.grid, s.pos, dest) ?? [];
    s.pathVersion = w.grid.version;
    s.pathFor = { ...dest };
    if (!s.path.length) return true; // unreachable: give up gracefully
  }
  const wp = s.path[0];
  const d = dist(s.pos, wp);
  const step = Math.min(d, s.def.speed * dt * (w.grid.slowAt(s.pos) < 1 ? 0.75 : 1));
  const dir = norm(sub(wp, s.pos));
  // always move through collision (no snapping onto a waypoint that hugs an obstacle)
  const blocked = moveWithCollision(w.grid, s.pos, dir.x * step, dir.y * step, BODY);
  if (d > 0.01) s.facing = Math.atan2(dir.y, dir.x);
  if (dist(s.pos, wp) < 0.15) s.path.shift();
  s.moving = true;
  const left = dist(s.pos, dest);
  // a destination right against a car or wall can be unreachable for a body this wide: close enough is arrived
  if (blocked && left <= arrive + BODY * 2) return true;
  return !s.path.length && left <= arrive + 1.8;
}

function doBuild(w: World, s: Squad, dt: number): void {
  const o = s.currentOrder!;
  const site = w.get(o.targetId ?? null);
  if (!(site instanceof Structure) || !site.alive || site.built) {
    s.orders.shift();
    s.buildProgress = 0;
    return;
  }
  const st = approach(w, s, site.pos, site.radius, site.radius + 4, dt);
  if (st === 'moving') return;
  if (st === 'blocked') {
    w.events.emit('radio', { speaker: s.name, text: "Can't reach that build site, Command.", tone: 'warn' });
    s.orders.shift();
    return;
  }
  s.path = [];
  s.facing = Math.atan2(site.pos.y - s.pos.y, site.pos.x - s.pos.x);
  const crew = s.aliveCount / s.def.members;
  site.buildProgress += dt * crew;
  site.hp = Math.min(site.def.hp, site.hp + (site.def.hp / site.def.buildTime) * dt * crew);
  w.makeNoise(s.pos, 0.8 * dt * 10); // hammering and sandbag-slinging isn't quiet
  if (site.buildProgress >= site.def.buildTime) {
    site.built = true;
    site.hp = site.def.hp;
    if (site.def.slow) w.grid.setSlow(site.tile.x, site.tile.y, site.size.w, site.size.h, site.def.slow, site.id);
    w.events.emit('structureBuilt', { id: site.id, defId: site.def.id, pos: site.pos });
    s.orders.shift();
  }
}

/** Forced attack (right-click a zombie): close to weapon range with line of sight, then combat locks onto it. */
function doAttack(w: World, s: Squad, dt: number): void {
  const o = s.currentOrder!;
  const t = w.get(o.targetId ?? null);
  if (!t || !t.alive) {
    s.orders.shift();
    s.path = [];
    return;
  }
  const inRange = dist(s.pos, t.pos) - t.radius <= s.def.weapon.range * 0.9 && w.grid.lineClear(s.pos, t.pos);
  if (inRange) {
    s.path = [];
    s.facing = Math.atan2(t.pos.y - s.pos.y, t.pos.x - s.pos.x);
    return;
  }
  moveToward(w, s, t.pos, dt, 0);
}

function doDeconstruct(w: World, s: Squad, dt: number): void {
  const o = s.currentOrder!;
  const site = w.get(o.targetId ?? null);
  if (!(site instanceof Structure) || !site.alive) {
    s.orders.shift();
    s.buildProgress = 0;
    return;
  }
  const st = approach(w, s, site.pos, site.radius, site.radius + 4, dt);
  if (st === 'moving') return;
  if (st === 'blocked') {
    s.orders.shift();
    return;
  }
  s.path = [];
  s.facing = Math.atan2(site.pos.y - s.pos.y, site.pos.x - s.pos.x);
  s.buildProgress += dt * (s.aliveCount / s.def.members);
  w.makeNoise(s.pos, 0.8 * dt * 10);
  if (s.buildProgress >= Math.max(2, site.def.buildTime * 0.5)) {
    w.dismantle(site);
    s.buildProgress = 0;
    s.orders.shift();
  }
}

function doCharge(w: World, s: Squad, dt: number): void {
  const o = s.currentOrder!;
  const hive = w.get(o.targetId ?? null);
  if (!(hive instanceof Hive) || !hive.alive) {
    s.orders.shift();
    return;
  }
  const st = approach(w, s, hive.pos, hive.radius, hive.radius + 3, dt);
  if (st === 'moving') return;
  if (st === 'blocked') {
    w.events.emit('radio', { speaker: s.name, text: "Can't get close enough to that hive.", tone: 'warn' });
    s.orders.shift();
    return;
  }
  const ab = ABILITIES.demoCharge;
  // planting takes a few seconds and getting hit starts it over — engineers need cover fire
  s.path = [];
  s.facing = Math.atan2(hive.pos.y - s.pos.y, hive.pos.x - s.pos.x);
  if (s.lastHit >= w.time - dt * 1.5) {
    s.buildProgress = 0;
    return;
  }
  s.buildProgress += dt;
  if (s.buildProgress < ab.plantTime) return;
  s.buildProgress = 0;
  if (!w.spend(ab.cost)) {
    w.events.emit('radio', { speaker: s.name, text: 'No budget for charges, Command. Need $25 and 10 supplies.', tone: 'warn' });
    s.orders.shift();
    return;
  }
  w.charges.push({ id: newId(), pos: { ...hive.pos }, fuse: ab.fuse, ownerSquadId: s.id });
  w.events.emit('radio', { speaker: s.name, text: `Charge set! ${ab.fuse} seconds — everybody MOVE!`, tone: 'warn' });
  s.orders.shift();
  // auto-retreat away from the blast unless the player queued something else
  if (!s.orders.length) {
    const away = norm(sub(s.pos, hive.pos));
    s.orders.unshift({ type: 'move', pos: w.grid.nearestFree({ x: s.pos.x + away.x * 16, y: s.pos.y + away.y * 16 }) });
  }
  s.path = [];
}

/**
 * Walk up to a target until within `reach`. If terrain (cars, rubble) stops us short, accept
 * "as close as we can get" within a small tolerance instead of standing there forever.
 */
function approach(w: World, s: Squad, target: Vec2, radius: number, reach: number, dt: number): 'moving' | 'inReach' | 'blocked' {
  if (dist(s.pos, target) <= reach) return 'inReach';
  const arrived = moveToward(w, s, approachPoint(w, s, target, radius), dt, ARRIVE);
  if (!arrived) return 'moving';
  s.path = [];
  return dist(s.pos, target) <= reach + 3.5 ? 'inReach' : 'blocked';
}

/** Closest walkable spot just outside a target, on the side the squad is coming from. */
function approachPoint(w: World, s: Squad, target: Vec2, radius: number): Vec2 {
  const d = norm(sub(s.pos, target));
  return w.grid.nearestFree({ x: target.x + d.x * (radius + 1.8), y: target.y + d.y * (radius + 1.8) });
}

function separate(w: World, s: Squad, dt: number): void {
  for (const o of w.squadHash.query(s.pos, 4.5)) {
    if (o === s) continue;
    const d = dist(s.pos, o.pos);
    if (d < 4 && d > 0.001) {
      const push = ((4 - d) / 4) * 5 * dt;
      const dir = norm(sub(s.pos, o.pos));
      moveWithCollision(w.grid, s.pos, dir.x * push, dir.y * push, BODY);
    }
  }
}

function updateCover(w: World, s: Squad): void {
  s.inCover = 0;
  s.coverPropId = null;
  if (s.moving) return;
  for (const p of w.map.props) {
    if (Math.abs(p.pos.x - s.pos.x) > 6 || Math.abs(p.pos.y - s.pos.y) > 6) continue;
    if (dist(p.pos, s.pos) < 4.5 && p.cover > s.inCover) {
      s.inCover = p.cover;
      s.coverPropId = p.id;
    }
  }
  for (const st of w.structures) {
    if (!st.built || !st.def.cover) continue;
    if (dist(st.pos, s.pos) < st.radius + 3 && st.def.cover > s.inCover) {
      s.inCover = st.def.cover;
      s.coverPropId = st.id;
    }
  }
}

/**
 * Members aren't welded to formation slots (v4.2 "less stiff"): each one drifts around its slot,
 * moves at its own pace (so squads string out on the move and bunch up on arrival), and faces
 * where it's going or, at rest, roughly where the squad is looking with its own glances around.
 * Fully deterministic (phase from squad id + member index) so the sim stays reproducible.
 */
function updateMembers(w: World, s: Squad, dt: number): void {
  const t = w.time;
  const c = Math.cos(s.facing + Math.PI / 2);
  const si = Math.sin(s.facing + Math.PI / 2);
  const resting = !s.moving;
  const amp = resting ? (s.holding || s.inCover ? 0.5 : 1.3) : 0.6;
  for (const m of s.members) {
    if (!m.alive) continue;
    const ph = s.id * 1.7 + m.index * 2.3;
    const driftX = (Math.sin(t * 0.21 + ph) + 0.5 * Math.sin(t * 0.53 + ph * 1.9)) * amp;
    const driftY = (Math.cos(t * 0.17 + ph * 1.3) + 0.5 * Math.sin(t * 0.47 + ph * 0.7)) * amp;
    const ox = m.offset.x * 1.15 + driftX;
    const oy = m.offset.y * 1.15 + driftY;
    let tx = s.pos.x + ox * c - oy * si;
    let ty = s.pos.y + ox * si + oy * c;
    if (w.grid.isBlockedXY(tx, ty)) {
      tx = s.pos.x + (tx - s.pos.x) * 0.3;
      ty = s.pos.y + (ty - s.pos.y) * 0.3;
    }
    const dx = tx - m.pos.x;
    const dy = ty - m.pos.y;
    const d = Math.hypot(dx, dy);
    // each soldier has their own pace; resting shuffles are slow
    const pace = resting ? 0.9 + 0.3 * Math.sin(ph) : s.def.speed * (1.05 + 0.12 * Math.sin(ph * 3.1));
    const step = Math.min(d, pace * dt + (d > 4 ? (d - 4) * dt * 4 : 0)); // catch up if left far behind
    if (d > 0.001) {
      m.pos.x += (dx / d) * step;
      m.pos.y += (dy / d) * step;
    }
    const glance = Math.sin(t * 0.3 + ph * 2.1) * 0.5;
    const want = d > 0.25 && !resting ? Math.atan2(dy, dx) : s.facing + (s.targetId ? glance * 0.3 : glance);
    let diff = want - m.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    m.facing += diff * Math.min(1, dt * 6);
  }
}
