import { dist, norm, sub, type Vec2 } from '../../core/math';
import { BALANCE } from '../../config/balance';
import type { Squad } from '../entities';
import type { BuildingDef } from '../map';
import type { World } from '../World';

/** The city's buildings: searching them (supplies, survivors, or the dead holed up inside) and evacuation. */

/** Building under a point (metres), if any. */
export function buildingAt(w: World, p: Vec2): BuildingDef | undefined {
  return w.map.buildings.find((b) => p.x >= b.rect.x && p.y >= b.rect.y && p.x < b.rect.x + b.rect.w && p.y < b.rect.y + b.rect.h);
}

/** A squad finished searching: the dead burst out, survivors come out, or there's loot (or nothing). */
export function finishSearch(w: World, s: Squad, b: BuildingDef): void {
  const st = w.buildingState.get(b.id);
  if (!st || st.searched) return;
  st.searched = true;
  const S = BALANCE.search;
  const door = { ...s.pos };
  if (b.landmark) {
    lootLandmark(w, s, b, door);
    return;
  }
  if (st.nest > 0) {
    releaseNest(w, b, door);
    w.events.emit('buildingSearched', { buildingId: b.id, pos: door, found: 'zombies' });
    return;
  }
  // survivors hiding inside (STATUS #10): districts from Rail Siding on
  if (w.districtAt(door)?.def.civilians && w.rng.chance(S.civilianChance)) {
    findCivilians(w, s, b, door);
    return;
  }
  const r = w.rng.next();
  let found = 'nothing';
  if (r >= S.emptyChance) {
    const sup = w.rng.int(S.supplies[0], S.supplies[1]);
    w.addSupplies(sup);
    found = `+${sup} supplies`;
    if (w.rng.chance(S.moneyChance)) {
      const m = w.rng.int(S.money[0], S.money[1]);
      w.money += m;
      found += `, +$${m}`;
    }
  }
  w.events.emit('buildingSearched', { buildingId: b.id, pos: door, found });
  w.events.emit('radio', { speaker: s.name, text: found === 'nothing' ? 'Building clear. Nothing worth taking.' : `Building clear. Found ${found.replace(/^\+/, '')}.`, tone: found === 'nothing' ? 'info' : 'good' });
}

/**
 * STATUS #50: a significant building always pays out, and the first of its kind unlocks something
 * (hospital → engineers can repair the Med Bay in the base).
 */
function lootLandmark(w: World, s: Squad, b: BuildingDef, door: Vec2): void {
  const kind = b.landmark!;
  const L = BALANCE.landmarks[kind];
  const sup = L ? w.rng.int(L.supplies[0], L.supplies[1]) : 0;
  const money = L ? w.rng.int(L.money[0], L.money[1]) : 0;
  w.addSupplies(sup);
  w.money += money;
  const firstEver = !w.unlocked.has('landmark');
  const firstOfKind = !w.unlocked.has(`looted:${kind}`);
  w.unlocked.add('landmark');
  w.unlocked.add(`looted:${kind}`);
  if (kind === 'hospital') w.unlocked.add('medBay');
  const found = `+${sup} supplies, +$${money}`;
  w.events.emit('buildingSearched', { buildingId: b.id, pos: door, found });
  w.events.emit('landmarkLooted', { buildingId: b.id, kind, pos: { ...door }, first: firstEver, firstOfKind, supplies: sup, money });
  const extra = kind === 'hospital' && firstOfKind ? ' And medical equipment: engineers can get the Med Bay in the base running now.' : '';
  w.events.emit('radio', { speaker: s.name, text: `${kind[0].toUpperCase() + kind.slice(1)} cleared out. ${sup} supplies and $${money}.${extra}`, tone: 'good' });
}

/** A group of survivors comes out of a searched house (STATUS #10). */
export function findCivilians(w: World, s: Squad, b: BuildingDef, door: Vec2): Squad {
  const [lo, hi] = BALANCE.search.civilianGroup;
  const first = w.counters().survivors === 0;
  const c = w.spawnSquad('civilians', door, undefined, w.rng.int(lo, hi));
  c.facing = s.facing;
  w.events.emit('buildingSearched', { buildingId: b.id, pos: door, found: 'civilians' });
  w.events.emit('civiliansFound', { squadId: c.id, count: c.members.length, pos: { ...door }, first });
  w.events.emit('radio', { speaker: s.name, text: `Found ${c.members.length} survivors hiding in there. Get them back to the Command Post.`, tone: 'good' });
  return c;
}

/** Civilians at the Command Post are flown out: money and supplies for each one still alive (STATUS #10). */
export function evacuate(w: World, c: Squad): void {
  if (!c.alive) return;
  const n = c.aliveCount;
  const P = BALANCE.civilians.perPerson;
  const money = P.money * n;
  const supplies = P.supplies * n;
  w.money += money;
  w.addSupplies(supplies);
  for (const m of c.members) m.alive = false;
  w.forget(c.id);
  w.events.emit('civiliansEvacuated', { count: n, money, supplies, pos: { ...c.pos } });
  w.events.emit('radio', { speaker: 'Command Post', text: `${n} survivor${n === 1 ? '' : 's'} evacuated. +$${money} and +${supplies} supplies from the grateful.`, tone: 'good' });
}

/** Zombies holed up in a building spill out of the door nearest `near` (v4.9 #65). */
export function releaseNest(w: World, b: BuildingDef, near: Vec2): void {
  const st = w.buildingState.get(b.id);
  if (!st || st.nest <= 0) return;
  const count = st.nest;
  st.nest = 0;
  // nearest point on the walls, pushed just outside
  const ex = Math.max(b.rect.x, Math.min(b.rect.x + b.rect.w, near.x));
  const ey = Math.max(b.rect.y, Math.min(b.rect.y + b.rect.h, near.y));
  const out = norm(sub(near, { x: ex, y: ey }));
  const door = w.grid.nearestFree({ x: ex + out.x * 1.5, y: ey + out.y * 1.5 });
  const prey = w.squadHash.query(door, 30).filter((q) => q.alive).sort((a, c) => dist(a.pos, door) - dist(c.pos, door))[0];
  for (let i = 0; i < count; i++) {
    const z = w.spawnZombie('walker', { x: door.x + w.rng.range(-1, 1), y: door.y + w.rng.range(-1, 1) });
    if (z && prey) {
      z.targetId = prey.id;
      z.state = 'chase';
      z.aggro = BALANCE.zombie.aggroTimeSec;
    }
  }
  w.events.emit('nestBurst', { buildingId: b.id, pos: door, count });
  w.events.emit('radio', { speaker: prey?.name ?? 'Overwatch', text: count > 2 ? 'Contact! They were holed up inside!' : "One of them was inside! Contact front!", tone: 'warn' });
}
