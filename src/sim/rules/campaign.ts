import { type Vec2 } from '../../core/math';
import { BALANCE, HORDE } from '../../config/balance';
import { Hive } from '../entities';
import type { DistrictDef } from '../map';
import { pickMedium } from '../systems/hives';
import type { DistrictState, World } from '../World';

/**
 * Campaign setup and regions: the starting base and force, seeding a district with its hives and dead,
 * fences, and opening the next tutorial region (doc §17).
 */

/** A new game: building nests, the base, the starting squads, and every open district's hives and dead. */
export function populate(w: World): void {
  // a share of buildings in infested districts have a few dead holed up inside (fixed per seed)
  const S = BALANCE.search;
  for (const b of w.map.buildings) {
    const d = w.districtAt({ x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h / 2 });
    const infested = !!d && d.def.id !== 'base' && d.infestation > 0;
    const nest = infested && w.rng.chance(S.nestChance) ? Math.round(w.rng.int(S.nestSize[0], S.nestSize[1]) * HORDE.count) : 0;
    w.buildingState.set(b.id, { searched: false, nest });
  }
  const m = w.map;
  const b = m.baseCells; // structures snap to nav cells
  w.addStructure('commandPost', { x: b.x + 3, y: b.y + 4 }, true);
  w.addStructure('barracks', { x: b.x + 3, y: b.y + 26 }, true);
  w.addStructure('supplyDepot', { x: b.x + 12, y: b.y + 4 }, true);
  // perimeter wall with a gate on the east side
  for (let y = b.y - 1; y <= b.y + b.h; y++) {
    const gy = m.baseGate.y / m.cell; // gate is in metres; walls are placed in cells
    if (y >= gy && y < gy + m.baseGate.h / m.cell) continue;
    w.addStructure('baseWall', { x: b.x + b.w, y }, true);
  }
  for (let x = b.x - 1; x < b.x + b.w; x++) {
    w.addStructure('baseWall', { x, y: b.y - 1 }, true);
    w.addStructure('baseWall', { x, y: b.y + b.h }, true);
  }
  for (let y = b.y; y < b.y + b.h; y++) w.addStructure('baseWall', { x: b.x - 1, y }, true);

  // doc §11 starting force: two Rifle Squads + one Engineer Team
  w.spawnSquad('rifle', { x: 66, y: 102 });
  w.spawnSquad('rifle', { x: 66, y: 114 });
  w.spawnSquad('engineer', { x: 54, y: 108 });

  // hives and the starting dead, for every district that's open (locked ones seed when they open)
  for (const d of w.districts.values()) if (!d.locked) {
    seedDistrict(w, d);
    firstRoam(w, d);
  }
}

/** The first pack leaves a full interval after a district opens (none in the opening minutes). */
export function firstRoam(w: World, d: DistrictState): void {
  const T = w.tier(d.def.id).roam;
  d.roamTimer = T ? T.everySec[1] : 0;
}

/** Hives plus the district's own starting population mix. */
export function seedDistrict(w: World, d: DistrictState): void {
  const T = w.tier(d.def.id);
  for (const [i, site] of d.def.hiveSites.entries()) {
    const hs = d.def.hiveStage ?? 1;
    const stage = Array.isArray(hs) ? (hs[i] ?? 1) : hs;
    const hive = new Hive({ ...site }, d.def.id, BALANCE.hive.hpByStage[stage - 1], T.firstPulseDelaySec);
    hive.stage = stage;
    w.hives.push(hive);
    w.registerHive(hive);
  }
  const count = Math.round(d.infestation * d.def.density * T.density * HORDE.count);
  const kinds = Object.entries(d.def.mix);
  const r = d.def.rect;
  // v4.15 (#77): a region opened mid-game keeps its dead well back from the cut fence and out of
  // sight of the squads waiting there, so opening it doesn't start a fight on the spot
  const borders = d.def.borders ?? [];
  const toRect = (p: Vec2, b: { x: number; y: number; w: number; h: number }) =>
    Math.hypot(Math.max(b.x - p.x, 0, p.x - (b.x + b.w)), Math.max(b.y - p.y, 0, p.y - (b.y + b.h)));
  const ok = (p: Vec2) =>
    borders.every((b) => toRect(p, b) > 50) && !w.squads.some((s) => s.alive && Math.hypot(s.pos.x - p.x, s.pos.y - p.y) < 40);
  const spot = () => {
    for (let k = 0; k < 16; k++) {
      const p = w.grid.nearestFree({ x: w.rng.range(r.x + 12, r.x + r.w - 6), y: w.rng.range(r.y + 6, r.y + r.h - 6) });
      if (ok(p)) return p;
    }
    return w.grid.nearestFree({ x: r.x + r.w - 20, y: r.y + r.h - 20 });
  };
  // medium zombies get their own share of the starting crowd, with a minimum so they're actually met (#70, #75)
  const mediums = Math.max(T.mediumStartMin, Math.round(count * T.mediumStart));
  for (let i = 0; i < count; i++) {
    let kind: string | null;
    if (i < mediums) kind = pickMedium(w);
    else {
      let roll = w.rng.next();
      kind = kinds.find(([, wgt]) => (roll -= wgt) < 0)?.[0] ?? 'walker';
    }
    w.spawnZombie(kind ?? 'walker', spot());
  }
  // packs: a few of one kind together (region 2's Runner packs)
  for (const pk of d.def.packs ?? [])
    for (let n = 0; n < pk.count; n++) {
      const c = spot();
      for (let i = 0; i < Math.round(pk.size * HORDE.count); i++) w.spawnZombie(pk.kind, { x: c.x + w.rng.range(-2, 2), y: c.y + w.rng.range(-2, 2) });
    }
}

/** Close (or open) a region's fence line on the nav grid. */
export function setBorder(w: World, d: DistrictDef, closed: boolean): void {
  const c = w.grid.cell;
  for (const b of d.borders ?? []) w.grid.setRect(Math.round(b.x / c), Math.round(b.y / c), Math.round(b.w / c), Math.round(b.h / c), closed);
}

/** Open a tutorial region (doc §17): cut the fence, seed it, wake its hive. */
export function unlockDistrict(w: World, id: string): void {
  const d = w.districts.get(id);
  if (!d || !d.locked) return;
  d.locked = false;
  if (d.def.borders) setBorder(w, d.def, false);
  seedDistrict(w, d);
  // the region's power station(s), offline until restored (v4.17)
  for (const ps of d.def.powerStations ?? []) w.addStructure('powerStation', ps, false);
  d.quietUntil = w.time + BALANCE.noise.openingQuietSec;
  firstRoam(w, d);
  const unlocks = d.def.unlocksOnOpen ?? [];
  for (const u of unlocks) w.unlocked.add(u);
  w.events.emit('districtUnlocked', { districtId: id, name: d.def.name, unlocks });
  w.events.emit('radio', { speaker: 'Command', text: `Engineers have cut the wire. ${d.def.name} is open. Same drill: find the ${d.def.hiveSites.length > 1 ? 'hives' : 'hive'}, kill ${d.def.hiveSites.length > 1 ? 'them' : 'it'}, plant an outpost.`, tone: 'warn' });
}
