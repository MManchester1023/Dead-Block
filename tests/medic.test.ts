import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { ABILITIES, STRUCTURES, UNITS } from '../src/config/units';
import { queueProduction } from '../src/sim/rules/commands';

/** A quiet world: no zombies, hives asleep. */
function quiet(seed = 3): World {
  const w = new World({ seed, fixedHives: true });
  for (const z of w.zombies) z.alive = false;
  for (const h of w.hives) (h.spawnTimer = 1e9), (h.pulseTimer = 1e9);
  w.money = 10000;
  w.supplies = 10000;
  return w;
}

function run(w: World, sec: number): void {
  for (let i = 0; i < sec * 30; i++) w.step(1 / 30);
}

describe('Medic Team (STATUS #20, v4.61)', () => {
  it('carries a pistol and has Heal', () => {
    expect(UNITS.medic.weapon.name).toBe('Pistol');
    expect(UNITS.medic.weapon.range).toBeLessThan(UNITS.rifle.weapon.range);
    expect(UNITS.medic.abilities).toContain('heal');
  });

  it('is locked until a Med Bay is built, then the Barracks can recruit it', () => {
    const w = quiet();
    expect(w.unitUnlocked('medic')).toBe(false);
    expect(queueProduction(w, 'medic')).toMatch(/Locked/);
    w.unlocked.add('medic');
    expect(w.unitUnlocked('medic')).toBe(true);
    expect(queueProduction(w, 'medic')).toBeNull();
  });

  it('engineers repairing the run-down Med Bay (after the hospital) unlock the Medic Team (STATUS #50)', () => {
    const w = quiet();
    const bay = w.structures.find((s) => s.def.id === 'medBay')!;
    expect(bay.built).toBe(false); // run down from the start
    const eng = w.squads.find((s) => s.def.id === 'engineer')!;
    expect(w.orderResume([eng], bay)).toMatch(/hospital/);
    w.unlocked.add('medBay'); // what looting the hospital does
    expect(w.orderResume([eng], bay)).toBeNull();
    run(w, STRUCTURES.medBay.buildTime + 40);
    expect(bay.built).toBe(true);
    expect(w.unlocked.has('medic')).toBe(true);
  });

  it('a built Med Bay counts too (older saves)', () => {
    const w = quiet();
    const b = w.map.baseRect;
    w.addStructure('medBay', { x: Math.floor(b.x + b.w / 2) - 6, y: Math.floor(b.y + b.h / 2) + 4 }, true);
    expect(w.unitUnlocked('medic')).toBe(true);
  });

  it('heals a hurt squad: walks over, treats it, restores health, lost soldiers rejoin, then cools down', () => {
    const w = quiet();
    const rifle = w.squads.find((s) => s.def.id === 'rifle')!;
    const medic = w.spawnSquad('medic', { x: rifle.pos.x + 12, y: rifle.pos.y });
    w.issueOrder([rifle], { type: 'hold', pos: { ...rifle.pos } });
    rifle.pool = rifle.poolMax * 0.3;
    // two soldiers down
    const lost = rifle.members.filter((m) => m.alive).slice(0, 2);
    for (const m of lost) m.alive = false;
    const aliveBefore = rifle.aliveCount;
    expect(w.orderHeal([medic], rifle)).toBeNull();
    run(w, 1);
    expect(medic.currentOrder?.type).toBe('heal');
    run(w, ABILITIES.heal.workSec + 5);
    expect(medic.currentOrder?.type).not.toBe('heal');
    expect(rifle.pool).toBeCloseTo(rifle.poolMax * (0.3 + ABILITIES.heal.share), 0);
    expect(rifle.aliveCount).toBeGreaterThan(aliveBefore);
    // cooldown
    rifle.pool = rifle.poolMax * 0.3;
    expect(w.orderHeal([medic], rifle)).toMatch(/Heal ready in/);
    run(w, ABILITIES.heal.cooldown);
    expect(w.orderHeal([medic], rifle)).toBeNull();
  });

  it("won't treat a squad that isn't hurt, and only medics heal", () => {
    const w = quiet();
    const rifle = w.squads.find((s) => s.def.id === 'rifle')!;
    const medic = w.spawnSquad('medic', { x: rifle.pos.x + 4, y: rifle.pos.y });
    expect(w.orderHeal([medic], rifle)).toMatch(/isn't hurt/);
    rifle.pool = rifle.poolMax / 2;
    expect(w.orderHeal([rifle], rifle)).toMatch(/Only medics/);
  });

  it("medics don't shoot while treating (but do otherwise)", () => {
    const pistolShots = (heal: boolean): number => {
      const w = quiet();
      const rifle = w.squads.find((s) => s.def.id === 'rifle')!;
      const medic = w.spawnSquad('medic', { x: rifle.pos.x + 3, y: rifle.pos.y });
      rifle.pool = rifle.poolMax / 2;
      rifle.def = { ...rifle.def, weapon: { ...rifle.def.weapon, damage: 0 } }; // leave the zombie to the medics
      if (heal) w.orderHeal([medic], rifle);
      w.spawnZombie('walker', { x: medic.pos.x + 9, y: medic.pos.y });
      let n = 0;
      w.events.on('shot', (e) => {
        if (e.weapon === 'Pistol') n++;
      });
      for (let i = 0; i < 45; i++) w.step(1 / 30); // inside the 2 s of treatment
      if (heal) expect(medic.currentOrder?.type).toBe('heal');
      return n;
    };
    expect(pistolShots(false)).toBeGreaterThan(0);
    expect(pistolShots(true)).toBe(0);
  });
});
