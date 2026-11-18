import { BALANCE } from '../../config/balance';
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
    // climbing a tower's ladder (round 9 #97): ~2 s up or down, nothing else meanwhile
    if (s.climb) {
      const tower = w.get(s.climb.towerId);
      if (!(tower instanceof Structure) || !tower.alive) s.climb = null; // handled below if they were up there
      else {
        s.climb.t -= dt;
        s.holding = true;
        if (s.climb.t > 0) {
          if (s.garrisonedIn != null) manTower(w, s, tower);
          else updateMembers(w, s, dt);
          continue;
        }
        const up = s.climb.up;
        s.climb = null;
        if (up) {
          if (!w.squads.some((x) => x !== s && x.garrisonedIn === tower.id)) {
            s.garrisonedIn = tower.id;
            w.events.emit('radio', { speaker: s.name, text: 'In the tower. Good view from up here.', tone: 'info' });
          }
        } else {
          w.leaveTower(s);
          continue;
        }
      }
    }
    // up a guard tower (v4.13): stay put until given another order, or the tower falls
    if (s.garrisonedIn != null) {
      const tower = w.get(s.garrisonedIn);
      const alive = tower instanceof Structure && tower.alive;
      const next = s.currentOrder;
      if (!alive) {
        w.leaveTower(s);
        s.stunned = 1.2; // dropped off a collapsing tower
        w.events.emit('radio', { speaker: s.name, text: "Tower's coming down! We're on the ground!", tone: 'bad' });
      } else if (next && next.type !== 'hold' && next.type !== 'garrison') {
        // climb down first; the order waits until they're on the ground
        s.climb = { towerId: tower.id, t: tower.def.garrison!.climbSec, up: false };
        manTower(w, s, tower);
        continue;
      } else {
        if (next) s.orders.shift();
        s.pos.x = tower.pos.x;
        s.pos.y = tower.pos.y;
        s.holding = true;
        s.inCover = tower.def.garrison!.cover;
        manTower(w, s, tower);
        continue;
      }
    }
    const o = s.currentOrder;
    // standing in Bloater gas with nothing to do: step out of it (v4.15 #83)
    if (!o && w.hazard[w.grid.c(s.pos.y) * w.map.cols + w.grid.c(s.pos.x)]) {
      // nearest open cell that's clear of gas
      const g = w.grid;
      const cx = g.c(s.pos.x);
      const cy = g.c(s.pos.y);
      let best: { x: number; y: number } | null = null;
      for (let r = 1; r <= 8 && !best; r++)
        for (let dy = -r; dy <= r && !best; dy++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = cx + dx;
            const y = cy + dy;
            if (x < 0 || y < 0 || x >= w.map.cols || y >= w.map.rows || g.isBlocked(x, y) || w.hazard[y * w.map.cols + x]) continue;
            best = { x: g.center(x), y: g.center(y) };
            break;
          }
      if (best) {
        s.orders.push({ type: 'move', pos: best });
        s.holding = false;
      }
    }
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
        case 'repair':
          doRepair(w, s, dt);
          break;
        case 'garrison': {
          const tower = w.get(o.targetId ?? null);
          if (!(tower instanceof Structure) || !tower.alive || !tower.built) {
            s.orders.shift();
            break;
          }
          const st = approach(w, s, tower.pos, tower.radius, tower.radius + 3.5, dt);
          if (st === 'moving') break;
          s.orders.shift();
          s.path = [];
          if (st === 'inReach' && !w.squads.some((x) => x !== s && (x.garrisonedIn === tower.id || x.climb?.towerId === tower.id)))
            s.climb = { towerId: tower.id, t: tower.def.garrison!.climbSec, up: true };
          break;
        }
        case 'search':
          doSearch(w, s, dt);
          break;
        case 'upgrade':
          doUpgrade(w, s, dt);
          break;
        case 'disband':
          // v4.9 (#55): walk into the Barracks and stand down
          if (moveToward(w, s, o.pos, dt, 2.5)) w.standDown(s);
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
  if (!s.path.length || s.pathVersion !== w.navVersion) {
    s.path = findPath(w.grid, s.pos, dest, 6000, w.hazard) ?? [];
    s.pathVersion = w.navVersion;
    s.pathFor = { ...dest };
    if (!s.path.length) return true; // unreachable: give up gracefully
  }
  const wp = s.path[0];
  const d = dist(s.pos, wp);
  // v4.9 (#49): wire slows soldiers as much as zombies; plan your own lanes through it
  const step = Math.min(d, s.def.speed * dt * w.grid.slowAt(s.pos));
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

/** Round 12 #138: engineers install a structure's upgrade (outpost Garrison): walk over, work, done. */
function doUpgrade(w: World, s: Squad, dt: number): void {
  const o = s.currentOrder!;
  const st = w.get(o.targetId ?? null);
  const up = st instanceof Structure ? st.def.upgrade : undefined;
  if (!(st instanceof Structure) || !st.alive || !up || st.upgraded) {
    s.orders.shift();
    s.buildProgress = 0;
    return;
  }
  const res = approach(w, s, st.pos, st.radius, st.radius + 4, dt);
  if (res === 'moving') return;
  if (res === 'blocked') {
    w.events.emit('radio', { speaker: s.name, text: `Can't reach the ${st.def.name.toLowerCase()}.`, tone: 'warn' });
    s.orders.shift();
    return;
  }
  s.path = [];
  s.facing = Math.atan2(st.pos.y - s.pos.y, st.pos.x - s.pos.x);
  s.buildProgress += dt * (s.aliveCount / s.def.members);
  if (s.buildProgress < up.workSec) return;
  s.buildProgress = 0;
  s.orders.shift();
  const err = w.upgradeStructure(st);
  if (err) w.events.emit('radio', { speaker: s.name, text: `Can't finish the ${up.name.toLowerCase()}: ${err.toLowerCase()}.`, tone: 'warn' });
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
  // restoring a power station only happens with the area held (v4.17)
  if (site.def.restore) {
    const near = w.zombieHash.query(site.pos, site.def.restore.clearRadius + site.radius).some((z) => z.alive);
    if (near) {
      if (w.time - (s.lastBlockedMsg ?? -99) > 12) {
        s.lastBlockedMsg = w.time;
        w.events.emit('radio', { speaker: s.name, text: "Can't work on the station with the dead this close. Clear the yard!", tone: 'warn' });
      }
      return;
    }
  }
  const crew = s.aliveCount / s.def.members;
  site.buildProgress += dt * crew;
  site.hp = Math.min(site.def.hp, site.hp + (site.def.hp / site.def.buildTime) * dt * crew);
  w.makeNoise(s.pos, 0.8 * dt * 10); // hammering and sandbag-slinging isn't quiet
  if (site.buildProgress >= site.def.buildTime) {
    site.built = true;
    site.hp = site.def.hp;
    if (site.def.slow) w.grid.setSlow(site.tile.x, site.tile.y, site.size.w, site.size.h, site.def.slow, site.id);
    w.events.emit('structureBuilt', { id: site.id, defId: site.def.id, pos: site.pos });
    if (site.def.restore) {
      const first = !w.unlocked.has('medBay');
      w.unlocked.add('power');
      w.unlocked.add('medBay');
      w.events.emit('powerRestored', { id: site.id, first });
      w.events.emit('radio', { speaker: s.name, text: first ? "Power's on! Lights, pumps, the lot. Tell the doc the Med Bay's a go." : 'Station is back online.', tone: 'good' });
    }
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

function doRepair(w: World, s: Squad, dt: number): void {
  const o = s.currentOrder!;
  const st = w.get(o.targetId ?? null);
  if (!(st instanceof Structure) || !st.alive || st.hp >= st.def.hp) {
    s.orders.shift();
    return;
  }
  const r = approach(w, s, st.pos, st.radius, st.radius + 4, dt);
  if (r === 'moving') return;
  if (r === 'blocked') {
    s.orders.shift();
    return;
  }
  s.path = [];
  s.facing = Math.atan2(st.pos.y - s.pos.y, st.pos.x - s.pos.x);
  // a crew restores a full bar in about the structure's build time (at least 6 s)
  const hp = Math.min(st.def.hp - st.hp, (st.def.hp / Math.max(6, st.def.buildTime)) * dt * (s.aliveCount / s.def.members));
  const cost = w.repairCost(st, hp);
  if (w.supplies < cost) {
    w.events.emit('radio', { speaker: s.name, text: 'Out of supplies for repairs, Command.', tone: 'warn' });
    s.orders.shift();
    return;
  }
  w.supplies -= cost;
  st.hp += hp;
  w.makeNoise(s.pos, 0.6 * dt * 10);
  if (st.hp >= st.def.hp) {
    st.hp = st.def.hp;
    s.orders.shift();
  }
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
/** v4.9 (#46): walk to the nearest wall, stand at the door for a few seconds, see what's inside. */
function doSearch(w: World, s: Squad, dt: number): void {
  const o = s.currentOrder!;
  const b = w.map.buildings.find((x) => x.id === o.targetId);
  const st = b && w.buildingState.get(b.id);
  if (!b || !st || st.searched) {
    s.orders.shift();
    s.buildProgress = 0;
    return;
  }
  const edge = { x: Math.max(b.rect.x, Math.min(b.rect.x + b.rect.w, s.pos.x)), y: Math.max(b.rect.y, Math.min(b.rect.y + b.rect.h, s.pos.y)) };
  const res = approach(w, s, edge, 0.5, 3.5, dt);
  if (res === 'moving') return;
  if (res === 'blocked') {
    w.events.emit('radio', { speaker: s.name, text: "Can't find a way in.", tone: 'warn' });
    s.orders.shift();
    return;
  }
  s.path = [];
  s.facing = Math.atan2(edge.y - s.pos.y, edge.x - s.pos.x);
  if (s.lastHit >= w.time - dt * 1.5) {
    s.buildProgress = 0; // getting hit at the door starts it over
    return;
  }
  if (s.buildProgress === 0) w.makeNoise(s.pos, BALANCE.search.loudness);
  s.buildProgress += dt;
  if (s.buildProgress < BALANCE.search.timeSec) return;
  s.buildProgress = 0;
  s.orders.shift();
  w.finishSearch(s, b);
}

/** Soldiers on the platform: one at each corner, facing the target (or the way the squad faces). */
function manTower(w: World, s: Squad, tower: Structure): void {
  const half = (tower.size.w * w.grid.cell) / 2 - 0.9;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const t = w.get(s.targetId);
  s.members.forEach((m, i) => {
    const [cx, cy] = corners[i % 4];
    m.pos.x = tower.pos.x + cx * half;
    m.pos.y = tower.pos.y + cy * half;
    m.facing = t && t.alive ? Math.atan2(t.pos.y - m.pos.y, t.pos.x - m.pos.x) : Math.atan2(cy, cx);
  });
}

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
    // two squads holding behind the same car can stand closer (round 7 #81: they used to shove each other out of cover)
    const min = s.holding && o.holding && !s.moving && !o.moving ? 2.4 : 4;
    if (d < min && d > 0.001) {
      const push = ((min - d) / min) * 5 * dt;
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
  const resting = !s.moving;
  // round 12 #137: at rest the formation keeps the layout it arrived in; a squad turning to shoot turns
  // its soldiers on the spot instead of swinging the whole formation round its centre (that read as gliding)
  if (!resting || s.formFacing == null) s.formFacing = s.facing;
  const c = Math.cos(s.formFacing + Math.PI / 2);
  const si = Math.sin(s.formFacing + Math.PI / 2);
  // round 10 #106: resting soldiers stand still (the drift read as gliding with a still idle pose);
  // bring back a small sway once there's an idle animation with weight shifts. Moving squads stay loose.
  const amp = resting ? 0 : 0.6;
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
    // each soldier has their own pace. Round 12 #137: at rest a soldier is either still or walking:
    // within 0.3 m of their spot they stand dead still; further away they walk there at a real walking
    // pace (fast enough for the walk animation), instead of sliding over in the idle pose
    if (resting && d <= (m.settling ? 0.05 : 0.3)) m.settling = false;
    else if (resting) m.settling = true;
    const pace = resting ? (m.settling ? 2.2 + 0.2 * Math.sin(ph) : 0) : s.def.speed * (1.05 + 0.12 * Math.sin(ph * 3.1));
    const step = Math.min(d, pace * dt + (d > 4 ? (d - 4) * dt * 4 : 0)); // catch up if left far behind
    if (d > 0.001 && pace > 0) {
      const nx = m.pos.x + (dx / d) * step;
      const ny = m.pos.y + (dy / d) * step;
      // round 12 #147: soldiers don't step into walls, sandbags or cars (they can always step out of one)
      if (!w.grid.isBlockedXY(nx, ny) || w.grid.isBlockedXY(m.pos.x, m.pos.y)) {
        m.pos.x = nx;
        m.pos.y = ny;
      }
    }
    const glance = Math.sin(t * 0.3 + ph * 2.1) * 0.5;
    const want = d > 0.25 && (!resting || m.settling) ? Math.atan2(dy, dx) : s.facing + (s.targetId ? glance * 0.3 : glance);
    let diff = want - m.facing;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    m.facing += diff * Math.min(1, dt * 6);
  }
}
