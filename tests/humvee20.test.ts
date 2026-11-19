import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { findPath } from '../src/sim/pathfinding';
import { STRUCTURES, UNITS, structureExit } from '../src/config/units';

function quiet(): World {
  const w = new World({ seed: 3, fixedHives: true });
  for (const z of w.zombies) z.alive = false;
  for (const h of w.hives) (h.spawnTimer = 1e9), (h.pulseTimer = 1e9);
  return w;
}
const STREET = { x: 172, y: 105.5 }; // (copy it: a squad keeps the very point it's spawned at as its position)

describe('Humvee pathing, round 20 (v4.89)', () => {
  it("plans routes that don't go through a tree's or a lamp post's square (#241)", () => {
    const w = quiet();
    const route = w.vehicleRoute();
    const g = w.grid;
    expect(route.walls.some((x) => x)).toBe(true);
    // every square holding a tree trunk is a wall
    for (const o of w.vehicleObstacles()) expect(route.walls[g.c(o.y) * g.width + g.c(o.x)]).toBe(1);
    // routes across town: no wall squares between the ends (sampled along each leg)
    let legs = 0;
    for (const [a, b] of [[{ x: 172, y: 105.5 }, { x: 60, y: 60 }], [{ x: 172, y: 105.5 }, { x: 110, y: 200 }], [{ x: 60, y: 60 }, { x: 200, y: 160 }]]) {
      const from = g.nearestFree(a), to = g.nearestFree(b);
      const p = findPath(g, from, to, 6000, w.hazard, route)!;
      expect(p.length).toBeGreaterThan(0);
      let prev = from;
      for (const q of p.slice(0, -1)) {
        const n = Math.ceil(Math.hypot(q.x - prev.x, q.y - prev.y) / 0.5);
        for (let i = 1; i <= n; i++) {
          const x = prev.x + ((q.x - prev.x) * i) / n, y = prev.y + ((q.y - prev.y) * i) / n;
          const c = g.c(y) * g.width + g.c(x);
          if (c !== g.c(from.y) * g.width + g.c(from.x)) expect(route.walls[c]).toBe(0);
        }
        prev = q;
        legs++;
      }
    }
    expect(legs).toBeGreaterThan(2);
  });

  it("sent somewhere it can't reach, it drives to the nearest point it can and stops there (#242)", () => {
    const w = quiet();
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ ...STREET }));
    // inside a locked region, behind its fence
    const locked = [...w.districts.values()].find((d) => d.locked)!;
    const r = locked.def.rect;
    const to = w.grid.nearestFree({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    w.issueOrder([hv], { type: 'move', pos: to });
    let t = 0;
    for (; t < 90 && hv.currentOrder; t += 1 / 30) w.step(1 / 30);
    expect(hv.currentOrder).toBeFalsy();
    expect(hv.bumps).toBeLessThanOrEqual(2);
  });

  it("stuck, it backs off and tries other ways instead of giving up; if every way is shut it says so (#242)", () => {
    const w = quiet();
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ ...STREET }));
    hv.facing = 0;
    const dest = w.grid.nearestFree({ x: hv.pos.x + 40, y: hv.pos.y });
    w.issueOrder([hv], { type: 'move', pos: dest });
    w.step(1 / 30);
    // a row of posts right across the street that its routes don't know about
    const obs = w.vehicleObstacles();
    const byCell = (w as unknown as { obstacles: { byCell: Map<number, { x: number; y: number; r: number }[]> } }).obstacles.byCell;
    for (let y = hv.pos.y - 9; y <= hv.pos.y + 9; y += 0.9) {
      const o = { x: hv.pos.x + 14, y, r: 0.5 };
      obs.push(o);
      const c = w.grid.c(o.y) * w.grid.width + w.grid.c(o.x);
      byCell.set(c, [...(byCell.get(c) ?? []), o]);
    }
    let radio = '';
    w.events.on('radio', (e) => (radio = e.text));
    const t0 = w.time;
    for (let i = 0; i < 30 * 120 && hv.currentOrder; i++) w.step(1 / 30);
    const arrived = Math.hypot(hv.pos.x - dest.x, hv.pos.y - dest.y) < 6;
    expect(hv.currentOrder).toBeFalsy();
    // either it found another way round, or it kept at it well past the old 4 s and then radioed in
    if (!arrived) {
      expect(w.time - t0).toBeGreaterThan(15);
      expect(radio).toMatch(/another route/);
    }
  });

  it('round 20 numbers: Vehicle Bay $150, Humvee $180, MGs 15 a hit, Humvee out to 45 m, out of the far-right door (#232–#243)', () => {
    expect(STRUCTURES.vehicleBay.cost).toEqual({ money: 150, supplies: 60 });
    expect(UNITS.humvee.cost).toEqual({ money: 180, supplies: 40 });
    expect(UNITS.humvee.weapon.damage).toBe(15);
    expect(STRUCTURES.mgNest.weapon!.damage).toBe(15);
    expect(UNITS.humvee.weapon.range).toBe(45);
    expect(STRUCTURES.mgNest.weapon!.range).toBe(35);
    expect(UNITS.humvee.weapon).not.toBe(STRUCTURES.mgNest.weapon);
    // the right-hand door's middle (the model's doors are at x -4.2, 0, +4.2 from the centre)
    const ex = structureExit(STRUCTURES.vehicleBay, { x: 10, y: 10 }, false, 3)!;
    expect(ex.x - (10 + 2.5) * 3).toBeCloseTo(4.2, 5);
  });

  it('the Humvee picks targets out to 45 m', () => {
    const w = quiet();
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ ...STREET }));
    hv.facing = Math.PI;
    w.issueOrder([hv], { type: 'hold', pos: { ...hv.pos } });
    const z = w.spawnZombie('walker', { x: hv.pos.x - 42, y: hv.pos.y })!;
    z.def = { ...z.def, speed: 0, sight: 0, hearing: 0 };
    z.hp = z.maxHp = 1e6;
    expect(w.grid.lineClear(hv.pos, z.pos)).toBe(true);
    let shots = 0;
    w.events.on('shot', (e) => e.shooter === hv.id && shots++);
    for (let i = 0; i < 60; i++) w.step(1 / 30);
    expect(shots).toBeGreaterThan(2);
  });
});
