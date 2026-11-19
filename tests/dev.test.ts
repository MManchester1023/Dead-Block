import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { devBuildings, devClearZombies, devPlaceStructure, devSpawnHive, devSpawnUnit, devSpawnZombies, devUnits } from '../src/sim/rules/dev';
import { STRUCTURES, UNITS } from '../src/config/units';

describe('dev menu commands (STATUS #59, v4.81)', () => {
  it('drops the asked number of zombies, spread out; hunters go for the nearest squad', () => {
    const w = new World({ seed: 2, fixedHives: true });
    const sq = w.squads.find((s) => s.def.id === 'rifle')!;
    const at = w.grid.nearestFree({ x: sq.pos.x + 30, y: sq.pos.y });
    const zs = devSpawnZombies(w, 'runner', at, 10, true);
    expect(zs).toHaveLength(10);
    expect(zs.every((z) => z.def.id === 'runner' && z.state === 'chase' && z.targetId != null)).toBe(true);
    const spread = Math.max(...zs.map((z) => Math.hypot(z.pos.x - at.x, z.pos.y - at.y)));
    expect(spread).toBeGreaterThan(2);
    const idle = devSpawnZombies(w, 'walker', at, 3, false);
    expect(idle.every((z) => z.state !== 'chase')).toBe(true);
  });

  it('places a hive at the stage asked for, belonging to the region it lands in, and it spawns', () => {
    const w = new World({ seed: 2, fixedHives: true });
    const motel = w.districts.get('motel')!.def.rect;
    const h = devSpawnHive(w, { x: motel.x + motel.w / 2, y: motel.y + motel.h / 2 }, 3);
    expect(h.stage).toBe(3);
    expect(h.districtId).toBe('motel');
    expect(w.hives.includes(h)).toBe(true);
    h.spawnTimer = 0;
    for (let i = 0; i < 30 * 3; i++) w.step(1 / 30);
    expect(h.spawned.size).toBeGreaterThan(0); // its own brood
  });

  it('clears every zombie', () => {
    const w = new World({ seed: 2, fixedHives: true });
    expect(w.zombies.some((z) => z.alive)).toBe(true);
    const n = devClearZombies(w);
    expect(n).toBeGreaterThan(0);
    expect(w.zombies.filter((z) => z.alive).length).toBe(0); // (hives carry on spawning afterwards)
  });

  it('spawns every friendly unit, free, and they all take orders (round 18 #221)', () => {
    const w = new World({ seed: 2, fixedHives: true });
    for (const h of w.hives) (h.spawnTimer = 1e9), (h.pulseTimer = 1e9);
    const list = devUnits();
    expect(list.map((u) => u.id).sort()).toEqual(Object.keys(UNITS).sort());
    expect(list.filter((u) => u.ready).map((u) => u.id)).toEqual(expect.arrayContaining(['rifle', 'engineer', 'medic', 'humvee']));
    const money = w.money;
    const sq = w.squads.find((s) => s.def.id === 'rifle')!;
    const spawned = list.map((u, i) => devSpawnUnit(w, u.id, { x: sq.pos.x + 8 + (i % 4) * 6, y: sq.pos.y + Math.floor(i / 4) * 6 })!);
    expect(spawned.every((s, i) => s && s.def.id === list[i].id && s.alive)).toBe(true);
    expect(w.money).toBe(money);
    for (const s of spawned) w.issueOrder([s], { type: 'move', pos: w.grid.nearestFree({ x: s.pos.x + 10, y: s.pos.y }) });
    for (let i = 0; i < 30 * 5; i++) w.step(1 / 30);
    expect(spawned.every((s) => s.alive && Number.isFinite(s.pos.x) && Number.isFinite(s.pos.y))).toBe(true);
  });

  it("places every buildable structure finished and free, unlocked or not; it still has to fit (round 18 #221)", () => {
    const w = new World({ seed: 2, fixedHives: true });
    for (const z of w.zombies) z.alive = false;
    const list = devBuildings().map((b) => b.id);
    expect(list).toEqual(expect.arrayContaining(['sandbags', 'wire', 'mgNest', 'guardTower', 'vehicleBay', 'outpost']));
    expect(w.unlocked.has('vehicleBay')).toBe(false);
    w.money = 0;
    w.supplies = 0;
    // each somewhere it fits: the base for base-only ones, a district for outposts, else near the base
    const b = w.map.baseCells;
    for (const id of list) {
      const def = STRUCTURES[id];
      let placed: ReturnType<typeof devPlaceStructure> | null = null;
      const tries: { x: number; y: number }[] = [];
      if (def.requiresSecured) {
        const r = w.districts.get('motel')!.def.rect;
        for (let y = r.y; y < r.y + r.h; y += 2) for (let x = r.x; x < r.x + r.w; x += 2) tries.push({ x: Math.floor(x / w.grid.cell), y: Math.floor(y / w.grid.cell) });
      } else for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) tries.push({ x, y });
      for (const t of tries) {
        if (w.canPlace(id, t, false, true)) continue;
        placed = devPlaceStructure(w, id, t);
        break;
      }
      expect(placed, id).not.toBeNull();
      expect(typeof placed, id).not.toBe('string');
      const st = placed as Exclude<typeof placed, string | null>;
      expect(st.built, id).toBe(true);
      expect(st.hp, id).toBe(def.hp);
      // the same spot again: it doesn't fit (wire doesn't block, so it can overlap, as in a normal build)
      if (def.blocksMovement) expect(typeof devPlaceStructure(w, id, st.tile), id).toBe('string');
    }
    expect(w.money).toBe(0);
    expect(w.supplies).toBe(0);
  });
});
