import { dist, norm, sub, type Vec2 } from '../../core/math';
import { ABILITIES } from '../../config/units';
import { Hive, Structure, type Squad } from '../entities';
import { newId } from '../entities';
import { findPath } from '../pathfinding';
import type { World } from '../World';
import { moveWithCollision } from './movement';

const ARRIVE = 0.35;

export function updateOrders(w: World, dt: number): void {
  for (const s of w.squads) {
    if (!s.alive) continue;
    applyKnock(w, s, dt);
    if (s.stunned > 0) {
      s.stunned -= dt;
      updateMembers(s, dt);
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
        default:
          s.orders.shift();
      }
    }
    separate(w, s, dt);
    updateCover(w, s);
    updateMembers(s, dt);
  }
}

function applyKnock(w: World, s: Squad, dt: number): void {
  if (Math.abs(s.knock.x) + Math.abs(s.knock.y) < 0.01) return;
  moveWithCollision(w.grid, s.pos, s.knock.x * dt, s.knock.y * dt, 0.3);
  const decay = Math.exp(-6 * dt);
  s.knock.x *= decay;
  s.knock.y *= decay;
  s.path = [];
}

/** Returns true on arrival. */
export function moveToward(w: World, s: Squad, dest: Vec2, dt: number, arrive: number): boolean {
  if (dist(s.pos, dest) <= arrive) return true;
  if (!s.path.length || s.pathVersion !== w.grid.version) {
    s.path = findPath(w.grid, s.pos, dest) ?? [];
    s.pathVersion = w.grid.version;
    if (!s.path.length) return true; // unreachable: give up gracefully
  }
  const wp = s.path[0];
  const d = dist(s.pos, wp);
  const tile = w.grid.idx(Math.floor(s.pos.x), Math.floor(s.pos.y));
  const step = s.def.speed * dt * (w.grid.slow[tile] < 1 ? 0.75 : 1);
  if (d <= step) {
    s.pos.x = wp.x;
    s.pos.y = wp.y;
    s.path.shift();
  } else {
    const dir = norm(sub(wp, s.pos));
    moveWithCollision(w.grid, s.pos, dir.x * step, dir.y * step, 0.3);
    s.facing = Math.atan2(dir.y, dir.x);
  }
  s.moving = true;
  return !s.path.length && dist(s.pos, dest) <= arrive + 0.6;
}

function doBuild(w: World, s: Squad, dt: number): void {
  const o = s.currentOrder!;
  const site = w.get(o.targetId ?? null);
  if (!(site instanceof Structure) || !site.alive || site.built) {
    s.orders.shift();
    s.buildProgress = 0;
    return;
  }
  const st = approach(w, s, site.pos, site.radius, site.radius + 1.6, dt);
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

function doCharge(w: World, s: Squad, dt: number): void {
  const o = s.currentOrder!;
  const hive = w.get(o.targetId ?? null);
  if (!(hive instanceof Hive) || !hive.alive) {
    s.orders.shift();
    return;
  }
  const st = approach(w, s, hive.pos, hive.radius, hive.radius + 1.2, dt);
  if (st === 'moving') return;
  if (st === 'blocked') {
    w.events.emit('radio', { speaker: s.name, text: "Can't get close enough to that hive.", tone: 'warn' });
    s.orders.shift();
    return;
  }
  const ab = ABILITIES.demoCharge;
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
    s.orders.unshift({ type: 'move', pos: w.grid.nearestFree({ x: s.pos.x + away.x * 7, y: s.pos.y + away.y * 7 }) });
  }
  s.path = [];
}

/**
 * Walk up to a target until within `reach`. If terrain (cars, rubble) stops us short, accept
 * "as close as we can get" within a small tolerance instead of standing there forever.
 */
function approach(w: World, s: Squad, target: Vec2, radius: number, reach: number, dt: number): 'moving' | 'inReach' | 'blocked' {
  if (dist(s.pos, target) <= reach) return 'inReach';
  const arrived = moveToward(w, s, approachPoint(w, s, target, radius), dt, 0.3);
  if (!arrived) return 'moving';
  s.path = [];
  return dist(s.pos, target) <= reach + 1.6 ? 'inReach' : 'blocked';
}

/** Closest walkable spot just outside a target, on the side the squad is coming from. */
function approachPoint(w: World, s: Squad, target: Vec2, radius: number): Vec2 {
  const d = norm(sub(s.pos, target));
  return w.grid.nearestFree({ x: target.x + d.x * (radius + 0.7), y: target.y + d.y * (radius + 0.7) });
}

function separate(w: World, s: Squad, dt: number): void {
  for (const o of w.squadHash.query(s.pos, 1.8)) {
    if (o === s) continue;
    const d = dist(s.pos, o.pos);
    if (d < 1.6 && d > 0.001) {
      const push = ((1.6 - d) / 1.6) * 2 * dt;
      const dir = norm(sub(s.pos, o.pos));
      moveWithCollision(w.grid, s.pos, dir.x * push, dir.y * push, 0.3);
    }
  }
}

function updateCover(w: World, s: Squad): void {
  s.inCover = 0;
  s.coverPropId = null;
  if (s.moving) return;
  for (const p of w.map.props) {
    if (Math.abs(p.pos.x - s.pos.x) > 2.5 || Math.abs(p.pos.y - s.pos.y) > 2.5) continue;
    if (dist(p.pos, s.pos) < 1.9 && p.cover > s.inCover) {
      s.inCover = p.cover;
      s.coverPropId = p.id;
    }
  }
  for (const st of w.structures) {
    if (!st.built || !st.def.cover) continue;
    if (dist(st.pos, s.pos) < st.radius + 1.3 && st.def.cover > s.inCover) {
      s.inCover = st.def.cover;
      s.coverPropId = st.id;
    }
  }
}

function updateMembers(s: Squad, dt: number): void {
  const c = Math.cos(s.facing + Math.PI / 2);
  const si = Math.sin(s.facing + Math.PI / 2);
  const k = 1 - Math.exp(-8 * dt);
  for (const m of s.members) {
    if (!m.alive) continue;
    const tx = s.pos.x + m.offset.x * c - m.offset.y * si;
    const ty = s.pos.y + m.offset.x * si + m.offset.y * c;
    m.pos.x += (tx - m.pos.x) * k;
    m.pos.y += (ty - m.pos.y) * k;
  }
}
