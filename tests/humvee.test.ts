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
    expect(Math.hypot(rifle.pos.x - hv.pos.x, rifle.pos.y - hv.pos.y)).toBeLessThan(0.01);
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
});
