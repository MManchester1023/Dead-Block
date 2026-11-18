import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { STRUCTURES, ZOMBIES } from '../src/config/units';
import { saveWorld, loadWorld } from '../src/sim/save';

describe('round 11 playtest (v4.34)', () => {
  it('supplies have no cap (#136)', () => {
    const w = new World({ populate: false });
    w.supplies = 140;
    w.addSupplies(500);
    expect(w.supplies).toBe(640);
  });

  it("the east Rail Siding hive starts at stage 2, the west one at stage 1 (#133)", () => {
    const w = new World({ seed: 3 });
    w.unlockDistrict('railSiding');
    const hives = w.hives.filter((h) => h.districtId === 'railSiding').sort((a, b) => a.pos.x - b.pos.x);
    expect(hives.map((h) => h.stage)).toEqual([1, 2]);
  });

  it('a Runner dies to 2 rifle hits in region 3, a Walker to 4 (#131)', () => {
    expect(Math.ceil(ZOMBIES.runner.hp / 9)).toBe(2);
    expect(Math.ceil(ZOMBIES.walker.hp / 9)).toBe(4);
  });

  it('outposts start unarmed; the Garrison upgrade costs money and supplies, arms it, and survives a save (#129)', () => {
    const w = new World({ populate: false });
    const op = w.addStructure('outpost', { x: 20, y: 10 }, true);
    expect(op.weapon).toBeUndefined();
    w.money = 50;
    expect(w.upgradeStructure(op)).toMatch(/Not enough/);
    w.money = 500;
    w.supplies = 100;
    const up = STRUCTURES.outpost.upgrade!;
    expect(w.upgradeStructure(op)).toBeNull();
    expect(w.money).toBe(500 - up.cost.money);
    expect(w.supplies).toBe(100 - up.cost.supplies);
    expect(op.weapon?.range).toBe(26);
    expect(w.upgradeStructure(op)).toMatch(/already/);
    const w2 = loadWorld(saveWorld(w));
    expect(w2.structures.find((s) => s.def.id === 'outpost')?.upgraded).toBe(true);
  });

  it('an unarmed outpost does not shoot; a garrisoned one does', () => {
    const w = new World({ populate: false });
    const op = w.addStructure('outpost', { x: 20, y: 10 }, true);
    const z = w.spawnZombie('walker', { x: op.pos.x + 12, y: op.pos.y })!;
    z.def = { ...z.def, speed: 0 };
    let shots = 0;
    w.events.on('shot', () => shots++);
    for (let i = 0; i < 30 * 3; i++) w.step(1 / 30);
    expect(shots).toBe(0);
    w.money = 500;
    w.upgradeStructure(op);
    for (let i = 0; i < 30 * 3; i++) w.step(1 / 30);
    expect(shots).toBeGreaterThan(0);
  });
});
