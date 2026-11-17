import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { CELL } from '../src/config/world';
import { callSupport } from '../src/sim/systems/support';
import { SUPPORT_BY_ID } from '../src/config/support';

const M = (x: number, y: number) => ({ x: x * CELL, y: y * CELL });

describe('v4.4 playtest round 2', () => {
  it('a shot Bloater turns on the squad that shot it, even from beyond its sight', () => {
    const w = new World({ populate: false, seed: 2 });
    const sq = w.spawnSquad('rifle', M(20, 36));
    const b = w.spawnZombie('bloater', { x: sq.pos.x + 20, y: sq.pos.y })!; // 20 m: past its 12 m sight
    expect(b.targetId).toBeNull();
    w.damage(b, 5, 'bullet', sq.pos, sq);
    expect(b.targetId).toBe(sq.id);
    expect(b.state).toBe('chase');
  });

  it('kills pay a little money and supplies', () => {
    const w = new World({ populate: false });
    const z = w.spawnZombie('walker', M(20, 36))!;
    const m0 = w.money;
    const s0 = w.supplies;
    w.damageZombie(z, 999, 'bullet');
    expect(w.money).toBeGreaterThan(m0);
    expect(w.supplies).toBeGreaterThan(s0);
  });

  it('engineers resume an abandoned construction site where it left off', () => {
    const w = new World({ populate: false });
    const eng = w.spawnSquad('engineer', M(20, 36));
    expect(w.orderBuild([eng], 'mgNest', { x: 23, y: 35 })).toBeNull();
    const site = w.structures.find((s) => s.def.id === 'mgNest')!;
    for (let i = 0; i < 30 * 8; i++) w.step(1 / 30); // walk over and get partway
    expect(site.buildProgress).toBeGreaterThan(0);
    w.issueOrder([eng], { type: 'move', pos: M(15, 36) }); // interrupted mid-build
    for (let i = 0; i < 30 * 3; i++) w.step(1 / 30);
    const halfway = site.buildProgress;
    expect(site.built).toBe(false);
    expect(w.orderResume([eng], site)).toBeNull();
    for (let i = 0; i < 30 * 20 && !site.built; i++) w.step(1 / 30);
    expect(site.built).toBe(true);
    expect(halfway).toBeGreaterThan(0); // it kept its progress rather than starting over
  });

  it('engineers repair damaged structures using supplies', () => {
    const w = new World({ populate: false });
    const eng = w.spawnSquad('engineer', M(20, 36));
    const bags = w.addStructure('sandbags', { x: 23, y: 34 }, true);
    bags.hp = bags.def.hp * 0.3;
    const s0 = w.supplies;
    expect(w.orderRepair([eng], bags)).toBeNull();
    for (let i = 0; i < 30 * 20 && bags.hp < bags.def.hp; i++) w.step(1 / 30);
    expect(bags.hp).toBe(bags.def.hp);
    expect(w.supplies).toBeLessThan(s0);
  });

  it('artillery from the Command Post lands on the smoke and kills what is there', () => {
    const w = new World({ seed: 3 });
    const target = M(70, 22);
    const crowd = Array.from({ length: 6 }, (_, i) => w.spawnZombie('walker', { x: target.x + (i % 3) * 2, y: target.y + Math.floor(i / 3) * 2 })!);
    crowd.forEach((z) => (z.def = { ...z.def, speed: 0 }));
    w.money = 1000;
    expect(callSupport(w, 'artillery', target)).toBeNull();
    expect(callSupport(w, 'artillery', target)).toMatch(/Ready in/); // cooldown
    for (let i = 0; i < 30 * 10; i++) w.step(1 / 30);
    expect(crowd.filter((z) => z.alive).length).toBeLessThan(3);
  });

  it('a supply drop has to be picked up by a squad', () => {
    const w = new World({ populate: false });
    w.addStructure('commandPost', { x: 5, y: 20 }, true);
    w.money = 500;
    w.supplies = 30; // enough that an empty test world doesn't count as defeat
    const spot = M(20, 36);
    expect(callSupport(w, 'supplyDrop', spot)).toBeNull();
    for (let i = 0; i < 30 * (SUPPORT_BY_ID.supplyDrop.delay + 1); i++) w.step(1 / 30);
    expect(w.crates.length).toBe(1); // landed, nobody there yet
    expect(w.crates[0].landed).toBe(true);
    const before = w.supplies;
    w.spawnSquad('rifle', spot);
    w.step(1 / 30);
    expect(w.supplies - before).toBeCloseTo(45, 0);
    expect(w.crates.length).toBe(0);
  });
});
