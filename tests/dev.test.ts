import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { devClearZombies, devSpawnHive, devSpawnZombies } from '../src/sim/rules/dev';

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
});
