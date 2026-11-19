import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { STRUCTURES, UNITS, vehicleHandling } from '../src/config/units';
import { squadStatus } from '../src/ui/status';
import type { Squad } from '../src/sim/entities';

/** A quiet world: no zombies, hives asleep, money to spend. */
function quiet(): World {
  const w = new World({ seed: 3, fixedHives: true });
  for (const z of w.zombies) z.alive = false;
  for (const h of w.hives) (h.spawnTimer = 1e9), (h.pulseTimer = 1e9);
  w.money = 10000;
  w.supplies = 10000;
  return w;
}
const run = (w: World, sec: number) => {
  for (let i = 0; i < sec * 30; i++) w.step(1 / 30);
};
/** A still zombie that doesn't notice anything (and, with `tough`, doesn't die to gunfire). */
function dummy(w: World, at: { x: number; y: number }, tough = false) {
  const z = w.spawnZombie('walker', at)!;
  z.def = { ...z.def, speed: 0, sight: 0, hearing: 0 };
  if (tough) z.hp = z.maxHp = 1e6;
  return z;
}
/** An open stretch of the east–west street through (172, 105.5), clear of the parked cars in the seed-3 city. */
const STREET = { x: 172, y: 105.5 }; // (copy it: a squad keeps the very point it's spawned at as its position)

describe('the Humvee, round 19 (v4.85)', () => {
  it('its MG and the MG emplacement hit harder than infantry weapons (#222)', () => {
    expect(UNITS.humvee.weapon.damage).toBe(20);
    expect(STRUCTURES.mgNest.weapon!.damage).toBe(20);
    for (const u of Object.values(UNITS)) if (u.category === 'infantry') expect(u.weapon.damage, u.id).toBeLessThan(20 + 26); // (the sniper and mortar are slow, heavy shots)
    expect(UNITS.humvee.weapon.damage).toBeGreaterThan(UNITS.rifle.weapon.damage);
  });

  it("doesn't fire until its turret has turned onto the target (#231)", () => {
    const w = quiet();
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ ...STREET }));
    hv.facing = 0;
    w.issueOrder([hv], { type: 'hold', pos: { ...hv.pos } });
    // straight behind it: the turret has half a turn to make
    dummy(w, { x: hv.pos.x - 20, y: hv.pos.y }, true);
    let firstShot = -1;
    let angleAtShot = 0;
    w.events.on('shot', (e) => {
      if (e.shooter === hv.id && firstShot < 0) (firstShot = w.time), (angleAtShot = hv.turretAngle);
    });
    const t0 = w.time;
    run(w, 3);
    const speed = vehicleHandling(hv.def).turretSpeed;
    expect(firstShot).toBeGreaterThan(0);
    // half a turn at its speed before the first shot (less a tick or two)
    expect(firstShot - t0).toBeGreaterThan(Math.PI / speed - 0.15);
    expect(Math.abs(Math.abs(angleAtShot) - Math.PI)).toBeLessThan(0.15);
  });

  it("steers round trees as well as lamp posts; shrubs aren't obstacles (#225)", () => {
    const w = quiet();
    const obs = w.vehicleObstacles();
    const decor = w.decor();
    const count = (k: string[]) => decor.filter((d) => k.includes(d.kind)).length;
    expect(obs.length).toBe(count(['tree', 'palm', 'streetlight']));
    expect(count(['tree', 'palm'])).toBeGreaterThan(20);
    expect(count(['shrub'])).toBeGreaterThan(0);
    expect(obs.length).toBeLessThan(decor.length);
    // drive a few routes round the middle of town: never inside a post or a tree
    const H = vehicleHandling(UNITS.humvee);
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ ...STREET }));
    let closest = Infinity;
    for (const to of [{ x: 110, y: 107.5 }, { x: 175, y: 80 }, { x: 150, y: 140 }, { x: 120, y: 70 }]) {
      w.issueOrder([hv], { type: 'move', pos: w.grid.nearestFree(to) });
      for (let i = 0; i < 30 * 30 && hv.currentOrder; i++) {
        w.step(1 / 30);
        for (const o of w.vehicleObstaclesNear(hv.pos)) closest = Math.min(closest, Math.hypot(hv.pos.x - o.x, hv.pos.y - o.y) - (H.body + o.r));
      }
    }
    expect(closest).toBeGreaterThan(-0.05);
  });

  it('remembers what it ran into and plans round it; backs out farther (#226)', () => {
    const w = quiet();
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ ...STREET }));
    hv.facing = 0;
    // something its route doesn't know about, straight ahead: an obstacle added after its route was planned
    w.issueOrder([hv], { type: 'move', pos: w.grid.nearestFree({ x: hv.pos.x + 40, y: hv.pos.y }) });
    w.step(1 / 30);
    const post = { x: hv.pos.x + 12, y: hv.pos.y, r: 0.6 };
    w.vehicleObstacles().push(post);
    (w as unknown as { obstacles: { byCell: Map<number, unknown[]> } }).obstacles.byCell.set(w.grid.c(post.y) * w.grid.width + w.grid.c(post.x), [post]);
    let bumped = false;
    let backedOut = 0;
    let arrived = false;
    for (let i = 0; i < 30 * 30 && !arrived; i++) {
      const was = hv.bumps;
      w.step(1 / 30);
      if (hv.bumps > was) bumped = true;
      if (hv.vel < 0) backedOut += -hv.vel / 30;
      arrived = !hv.currentOrder;
    }
    expect(bumped).toBe(true);
    expect(hv.avoid.length).toBeGreaterThan(0);
    expect(backedOut).toBeGreaterThan(2);
    expect(arrived).toBe(true);
    expect(hv.bumps).toBeLessThanOrEqual(2);
  });

  it('backs straight up to a spot close behind it (#227)', () => {
    const w = quiet();
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ ...STREET }));
    hv.facing = 0;
    const dest = { x: hv.pos.x - 9, y: hv.pos.y };
    expect(w.grid.lineClear(hv.pos, dest)).toBe(true);
    w.issueOrder([hv], { type: 'move', pos: dest });
    let minVel = 0;
    let maxTurn = 0;
    for (let i = 0; i < 30 * 15 && hv.currentOrder; i++) {
      w.step(1 / 30);
      minVel = Math.min(minVel, hv.vel);
      maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(Math.sin(hv.facing), Math.cos(hv.facing))));
    }
    expect(hv.currentOrder).toBeFalsy();
    expect(minVel).toBeLessThan(-1); // it reversed…
    expect(maxTurn).toBeLessThan(0.4); // …without turning round
    expect(Math.hypot(hv.pos.x - dest.x, hv.pos.y - dest.y)).toBeLessThan(3);
  });

  it("drives on through queued waypoints, stopping only at the last (#229)", () => {
    const w = quiet();
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ ...STREET }));
    hv.facing = Math.PI;
    const a = w.grid.nearestFree({ x: hv.pos.x - 25, y: hv.pos.y });
    const b = w.grid.nearestFree({ x: hv.pos.x - 45, y: hv.pos.y });
    w.issueOrder([hv], { type: 'move', pos: a });
    w.issueOrder([hv], { type: 'move', pos: b }, true);
    let slowest = Infinity;
    for (let i = 0; i < 30 * 20 && hv.currentOrder; i++) {
      w.step(1 / 30);
      if (Math.hypot(hv.pos.x - a.x, hv.pos.y - a.y) < 4) slowest = Math.min(slowest, Math.abs(hv.vel));
    }
    expect(hv.currentOrder).toBeFalsy();
    expect(slowest).toBeGreaterThan(5); // no stop at the first one
    expect(Math.hypot(hv.pos.x - b.x, hv.pos.y - b.y)).toBeLessThan(4);
  });

  it('runs over only what is under its body, not beside it (#223)', () => {
    const w = quiet();
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ ...STREET }));
    hv.facing = Math.PI;
    hv.vel = 10;
    w.issueOrder([hv], { type: 'move', pos: w.grid.nearestFree({ x: hv.pos.x - 40, y: hv.pos.y }) });
    const under = dummy(w, { x: hv.pos.x - 12, y: hv.pos.y + 0.5 }, true);
    const beside = dummy(w, { x: hv.pos.x - 12, y: hv.pos.y + 2.2 }, true);
    // (both bullet-proof: the gun shoots at them too; only the crush matters here)
    const crushed = new Set<number>();
    w.events.on('zombieRunOver', (e) => {
      for (const z of [under, beside]) if (Math.hypot(z.pos.x - e.pos.x, z.pos.y - e.pos.y) < 0.01) crushed.add(z.id);
    });
    run(w, 2.5);
    expect(crushed.has(under.id)).toBe(true);
    expect(crushed.has(beside.id)).toBe(false);
    expect(beside.alive).toBe(true);
  });

  it('reads "REPAIRING" while being fixed, not "TREATING" (#228)', () => {
    const w = quiet();
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ ...STREET }));
    hv.healing = w.time;
    expect(squadStatus(hv as Squad, w).text).toBe('REPAIRING');
    const r = w.squads.find((s) => s.def.id === 'rifle')!;
    r.healing = w.time;
    expect(squadStatus(r, w).text).toBe('TREATING');
    // engineers' repairs mark it too
    hv.pool = hv.poolMax * 0.5;
    hv.healing = -1;
    const eng = w.squads.find((s) => s.def.id === 'engineer')!;
    eng.pos.x = hv.pos.x - 3;
    eng.pos.y = hv.pos.y;
    expect(w.orderRepairVehicle([eng], hv)).toBeNull();
    let marked = false;
    for (let i = 0; i < 30 * 10 && !marked; i++) {
      w.step(1 / 30);
      marked = squadStatus(hv, w).text === 'REPAIRING';
    }
    expect(marked).toBe(true);
  });
});
