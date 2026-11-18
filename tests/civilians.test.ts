import { afterEach, describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { BALANCE } from '../src/config/balance';

/** A house in the given district, with search state set up the way a fresh game has it. */
const houseIn = (w: World, district: string) => {
  const b = w.map.buildings.find((x) => w.districtAt({ x: x.rect.x + x.rect.w / 2, y: x.rect.y + x.rect.h / 2 })?.def.id === district)!;
  w.buildingState.set(b.id, { searched: false, nest: 0 });
  return b;
};
const civilians = (w: World) => w.squads.filter((s) => s.alive && s.def.category === 'civilian');
const chance = BALANCE.search.civilianChance;
const setChance = (v: number) => ((BALANCE.search as { civilianChance: number }).civilianChance = v);

describe('civilians from house searches (STATUS #10)', () => {
  afterEach(() => {
    setChance(chance);
  });

  it('a search in Rail Siding can turn up a group of survivors', () => {
    setChance(1);
    const w = new World({ populate: false });
    const b = houseIn(w, 'railSiding');
    const sq = w.spawnSquad('rifle', { x: b.rect.x - 3, y: b.rect.y + b.rect.h / 2 });
    w.finishSearch(sq, b);
    const c = civilians(w);
    expect(c.length).toBe(1);
    const [lo, hi] = BALANCE.search.civilianGroup;
    expect(c[0].members.length).toBeGreaterThanOrEqual(lo);
    expect(c[0].members.length).toBeLessThanOrEqual(hi);
    expect(c[0].def.command).toBe(0); // they don't take up command
  });

  it('the first two regions never have survivors', () => {
    setChance(1);
    const w = new World({ populate: false });
    for (const id of ['motel', 'gasStrip']) {
      const b = houseIn(w, id);
      const sq = w.spawnSquad('rifle', { x: b.rect.x - 3, y: b.rect.y + b.rect.h / 2 });
      w.finishSearch(sq, b);
    }
    expect(civilians(w).length).toBe(0);
  });

  it('walked to the Command Post, they are evacuated for money and supplies', () => {
    const w = new World({ populate: false });
    const cp = w.structures.find((s) => s.def.id === 'commandPost') ?? w.addStructure('commandPost', { x: 20, y: 34 }, true);
    w.spawnSquad('rifle', { x: 20, y: 300 }); // somebody's still fighting (no squads + no money = defeat)
    w.supplies = 0;
    const m0 = w.money;
    const c = w.spawnSquad('civilians', { x: cp.pos.x + 40, y: cp.pos.y }, undefined, 3);
    w.issueOrder([c], { type: 'move', pos: w.grid.nearestFree(cp.pos) });
    let evac = 0;
    w.events.on('civiliansEvacuated', (e) => (evac += e.count));
    for (let i = 0; i < 30 * 30 && c.alive; i++) w.step(1 / 30);
    expect(c.alive).toBe(false);
    expect(evac).toBe(3);
    const P = BALANCE.civilians.perPerson;
    expect(w.money - m0).toBeGreaterThanOrEqual(P.money * 3);
    expect(w.supplies).toBeGreaterThanOrEqual(P.supplies * 3);
  });

  it('they never shoot, and the dead go for them over a closer-looking soldier', () => {
    const w = new World({ populate: false });
    const c = w.spawnSquad('civilians', { x: 300, y: 330 }, undefined, 3);
    const soldier = w.spawnSquad('rifle', { x: 300, y: 318 });
    soldier.def = { ...soldier.def, weapon: { ...soldier.def.weapon, damage: 0, range: 0 } }; // hold fire, just bait
    // a zombie a little closer to the soldier than to the civilians
    const z = w.spawnZombie('walker', { x: 300, y: 325.5 })!;
    let shots = 0;
    w.events.on('shot', () => shots++);
    for (let i = 0; i < 20; i++) w.step(1 / 30);
    expect(z.targetId).toBe(c.id);
    expect(shots).toBe(0);
  });
});
