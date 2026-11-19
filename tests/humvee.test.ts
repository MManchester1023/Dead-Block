import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { STRUCTURES, UNITS } from '../src/config/units';
import { queueProduction } from '../src/sim/rules/commands';

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

describe('the Humvee (STATUS #51, v4.77)', () => {
  it('is made at the Vehicle Bay and carries the MG emplacement\'s gun', () => {
    expect(UNITS.humvee.producedAt).toBe('vehicleBay');
    expect(UNITS.humvee.weapon).toEqual(STRUCTURES.mgNest.weapon);
    expect(UNITS.humvee.seats).toBe(5);
    const w = quiet();
    expect(queueProduction(w, 'humvee')).toMatch(/vehicleBay/);
    const b = w.map.baseCells;
    w.addStructure('vehicleBay', { x: b.x + 15, y: b.y + 8 }, true);
    expect(queueProduction(w, 'humvee')).toBeNull();
    run(w, UNITS.humvee.buildTime + 1);
    expect(w.squads.some((s) => s.def.id === 'humvee')).toBe(true);
  });

  it('an Elite rifle squad (5) climbs in, rides along out of reach, and climbs out', () => {
    const w = quiet();
    const rifle = w.squads.find((s) => s.def.id === 'rifle')!;
    rifle.addMember(); // Elite: five soldiers
    expect(rifle.aliveCount).toBe(5);
    const hv = w.spawnSquad('humvee', { x: rifle.pos.x + 10, y: rifle.pos.y });
    expect(w.orderBoard([rifle], hv)).toBeNull();
    run(w, 4);
    expect(rifle.inVehicle).toBe(hv.id);
    expect(hv.cargo).toBe(rifle.id);
    // rides along
    w.issueOrder([hv], { type: 'move', pos: w.grid.nearestFree({ x: hv.pos.x, y: hv.pos.y + 30 }) });
    run(w, 4);
    expect(Math.hypot(rifle.pos.x - hv.pos.x, rifle.pos.y - hv.pos.y)).toBeLessThan(1); // (a tick behind: riders are hidden)
    // out of the zombies' reach (not in the squad hash) and not shooting
    expect(w.squadHash.query(hv.pos, 5).includes(rifle)).toBe(false);
    const z = w.spawnZombie('walker', { x: hv.pos.x + 8, y: hv.pos.y })!;
    z.def = { ...z.def, speed: 0 };
    let riderShots = 0;
    w.events.on('shot', (e) => {
      if (e.shooter === rifle.id) riderShots++;
    });
    run(w, 2);
    expect(riderShots).toBe(0);
    // climb out
    expect(w.orderUnload([hv])).toBeNull();
    expect(rifle.inVehicle).toBeNull();
    expect(hv.cargo).toBeNull();
    expect(Math.hypot(rifle.pos.x - hv.pos.x, rifle.pos.y - hv.pos.y)).toBeGreaterThan(1);
  });

  it('room for one squad of up to 5', () => {
    const w = quiet();
    const [a, b] = w.squads.filter((s) => s.def.id === 'rifle');
    const hv = w.spawnSquad('humvee', { x: a.pos.x + 6, y: a.pos.y });
    a.addMember();
    a.addMember(); // six: too many
    expect(w.orderBoard([a], hv)).toMatch(/seats/);
    expect(w.orderBoard([b], hv)).toBeNull();
    run(w, 4);
    expect(b.inVehicle).toBe(hv.id);
    expect(w.orderBoard([a], hv)).toMatch(/already/);
  });

  it('when it is destroyed, the squad inside bails out', () => {
    const w = quiet();
    const rifle = w.squads.find((s) => s.def.id === 'rifle')!;
    const hv = w.spawnSquad('humvee', { x: rifle.pos.x + 5, y: rifle.pos.y });
    w.orderBoard([rifle], hv);
    run(w, 3);
    expect(rifle.inVehicle).toBe(hv.id);
    w.damageSquad(hv, 1e6, 'melee');
    run(w, 0.2);
    expect(hv.alive).toBe(false);
    expect(rifle.alive).toBe(true);
    expect(rifle.inVehicle).toBeNull();
  });

  it('its gun shoots all round, out to 35 m', () => {
    const w = quiet();
    const hv = w.spawnSquad('humvee', { x: 120, y: 120 });
    hv.facing = 0;
    w.issueOrder([hv], { type: 'hold', pos: { ...hv.pos } });
    // a zombie behind it (the MG nest's 120° arc would miss it)
    const z = w.spawnZombie('walker', { x: hv.pos.x - 25, y: hv.pos.y })!;
    z.def = { ...z.def, speed: 0, sight: 0, hearing: 0 };
    z.hp = z.maxHp = 1e6; // keep it standing so the gun keeps firing
    let shots = 0;
    w.events.on('shot', (e) => e.shooter === hv.id && shots++);
    run(w, 3);
    expect(shots).toBeGreaterThan(3);
  });

  it('drives like a car: no spinning on the spot, turns only while moving (round 17 #203)', () => {
    const w = quiet();
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ x: 150, y: 100 }));
    hv.facing = 0;
    // a destination right behind it
    const dest = w.grid.nearestFree({ x: hv.pos.x - 40, y: hv.pos.y });
    w.issueOrder([hv], { type: 'move', pos: dest });
    let maxTurnStill = 0;
    let prev = hv.facing;
    let arrived = false;
    for (let i = 0; i < 30 * 30 && !arrived; i++) {
      const p0 = { ...hv.pos };
      w.step(1 / 30);
      const moved = Math.hypot(hv.pos.x - p0.x, hv.pos.y - p0.y);
      const turn = Math.abs(Math.atan2(Math.sin(hv.facing - prev), Math.cos(hv.facing - prev)));
      if (moved < 0.005) maxTurnStill = Math.max(maxTurnStill, turn);
      // never faster than its speed allows on a 6 m turning circle (plus slack for a tick)
      expect(turn).toBeLessThanOrEqual(Math.min(1.5, (moved * 30) / 6) / 30 + 1e-6);
      prev = hv.facing;
      arrived = !hv.currentOrder;
    }
    expect(arrived).toBe(true);
    expect(maxTurnStill).toBeLessThan(0.001); // (creeping a few millimetres turns it a hair, as its turning circle allows)
    expect(Math.hypot(hv.pos.x - dest.x, hv.pos.y - dest.y)).toBeLessThan(4);
  });

  it("infantry can't push it; it moves them aside (round 17 #204)", () => {
    const w = quiet();
    const rifle = w.squads.find((s) => s.def.id === 'rifle')!;
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ x: rifle.pos.x + 2, y: rifle.pos.y }));
    w.issueOrder([hv], { type: 'hold', pos: { ...hv.pos } });
    w.issueOrder([rifle], { type: 'hold', pos: { ...rifle.pos } });
    const h0 = { ...hv.pos }, r0 = { ...rifle.pos };
    run(w, 2);
    expect(Math.hypot(hv.pos.x - h0.x, hv.pos.y - h0.y)).toBeLessThan(0.01);
    expect(Math.hypot(rifle.pos.x - r0.x, rifle.pos.y - r0.y)).toBeGreaterThan(0.5);
  });

  it('routes keep off lamp posts, and it never drives through one (round 17 #208)', () => {
    const w = quiet();
    const posts = w.lampPosts();
    expect(posts.length).toBeGreaterThan(10);
    // drive the length of a street lined with posts
    const p = posts[Math.floor(posts.length / 2)];
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ x: p.x - 30, y: p.y }));
    w.issueOrder([hv], { type: 'move', pos: w.grid.nearestFree({ x: p.x + 30, y: p.y }) });
    let closest = Infinity;
    for (let i = 0; i < 30 * 25 && hv.currentOrder; i++) {
      w.step(1 / 30);
      for (const q of posts) closest = Math.min(closest, Math.hypot(hv.pos.x - q.x, hv.pos.y - q.y));
    }
    expect(closest).toBeGreaterThan(1.3); // its body (1.3 m) never overlaps a post
  });

  it('runs zombies over while driving, not while parked (round 18 #213)', () => {
    const w = quiet();
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ x: 150, y: 100 }));
    hv.facing = 0;
    hv.def = { ...hv.def, weapon: { ...hv.def.weapon, damage: 0 } }; // the gun stays out of it
    // parked next to one: nothing happens
    const z0 = w.spawnZombie('walker', { x: hv.pos.x + 1.5, y: hv.pos.y })!;
    z0.def = { ...z0.def, speed: 0, sight: 0, hearing: 0, damage: 0 };
    run(w, 1);
    expect(z0.alive).toBe(true);
    z0.alive = false;
    // a line of them in its path while it drives
    const zs = [0, 1, 2].map((i) => {
      const z = w.spawnZombie('walker', { x: hv.pos.x + 12 + i * 3, y: hv.pos.y })!;
      z.def = { ...z.def, speed: 0, sight: 0, hearing: 0, damage: 0 };
      return z;
    });
    w.issueOrder([hv], { type: 'move', pos: w.grid.nearestFree({ x: hv.pos.x + 30, y: hv.pos.y }) });
    run(w, 6);
    expect(zs.filter((z) => !z.alive).length).toBeGreaterThanOrEqual(2);
    expect(hv.kills).toBeGreaterThanOrEqual(2);
  });

  it("settles for a spot right beside it instead of circling it (round 18 #215)", () => {
    const w = quiet();
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ x: 150, y: 100 }));
    hv.facing = 0;
    w.issueOrder([hv], { type: 'move', pos: { x: hv.pos.x, y: hv.pos.y + 3 } });
    run(w, 3);
    expect(hv.currentOrder).toBeUndefined();
  });

  it('parks facing the way it was dragged (round 18 #214)', () => {
    const w = quiet();
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ x: 150, y: 100 }));
    hv.facing = 0;
    const dest = w.grid.nearestFree({ x: hv.pos.x + 25, y: hv.pos.y });
    w.issueOrder([hv], { type: 'move', pos: dest }, false, { shape: 'line', facing: Math.PI / 2 }); // park facing south
    for (let i = 0; i < 30 * 30 && hv.currentOrder; i++) w.step(1 / 30);
    expect(hv.currentOrder).toBeUndefined();
    const off = Math.abs(Math.atan2(Math.sin(hv.facing - Math.PI / 2), Math.cos(hv.facing - Math.PI / 2)));
    expect(off).toBeLessThan(0.45); // within ~25°
  });

  it('engineers repair it for supplies (round 18 #220)', () => {
    const w = quiet();
    const eng = w.squads.find((s) => s.def.id === 'engineer')!;
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ x: eng.pos.x + 6, y: eng.pos.y }));
    hv.pool = hv.poolMax * 0.4;
    const s0 = w.supplies;
    expect(w.orderRepairVehicle([eng], hv)).toBeNull();
    run(w, 30);
    expect(hv.pool).toBeCloseTo(hv.poolMax, 0);
    expect(w.supplies).toBeLessThan(s0);
  });

  it('the Vehicle Bay repairs a parked vehicle, and builds them out of its door facing out (round 18)', () => {
    const w = quiet();
    const b = w.map.baseCells;
    let bay: ReturnType<typeof w.addStructure> | null = null;
    for (let y = b.y; y < b.y + b.h && !bay; y++) for (let x = b.x; x < b.x + b.w && !bay; x++) if (!w.canPlace('vehicleBay', { x, y }) || w.canPlace('vehicleBay', { x, y }) === 'Not unlocked yet') {
      if (w.canPlace('vehicleBay', { x, y }) === 'Not unlocked yet') w.unlocked.add('vehicleBay');
      if (!w.canPlace('vehicleBay', { x, y })) bay = w.addStructure('vehicleBay', { x, y }, true);
    }
    expect(bay).not.toBeNull();
    // out of the door (north side), facing north
    expect(queueProduction(w, 'humvee')).toBeNull();
    run(w, UNITS.humvee.buildTime + 0.2);
    const hv = w.squads.find((s) => s.def.id === 'humvee')!;
    expect(hv.pos.y).toBeLessThan(bay!.pos.y - 4);
    // parked next to the bay, it gets repaired
    w.issueOrder([hv], { type: 'hold', pos: { ...hv.pos } });
    hv.pos.x = bay!.pos.x;
    hv.pos.y = bay!.pos.y - bay!.radius - 3;
    hv.pool = hv.poolMax * 0.5;
    const before = hv.pool;
    run(w, 10);
    expect(hv.pool).toBeGreaterThan(before);
  });
});
