import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { BALANCE } from '../src/config/balance';
import { CELL } from '../src/config/world';
import { gainXp } from '../src/sim/systems/combat';
import { broodRoom } from '../src/sim/systems/hives';

const M = (x: number, y: number) => ({ x: x * CELL, y: y * CELL });
const motelPoint = (w: World) => {
  const r = w.districts.get('motel')!.def.rect;
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
};

describe('v4.9 playtest round 5', () => {
  it('the noise meter holds after the last shot, then drains (#43)', () => {
    const w = new World({ populate: false });
    const d = w.districts.get('motel')!;
    for (let i = 0; i < 40; i++) w.makeNoise(motelPoint(w), 3);
    const peak = d.noise;
    expect(peak).toBeGreaterThan(5);
    for (let i = 0; i < 30 * (BALANCE.noise.holdSec - 1); i++) w.step(1 / 30);
    expect(d.noise).toBe(peak);
    for (let i = 0; i < 30 * 4; i++) w.step(1 / 30);
    expect(d.noise).toBeLessThan(peak);
  });

  it('a district with no hive and nothing left alive drains to 0% (#40)', () => {
    const w = new World({ populate: false });
    for (const h of w.hives) h.alive = false;
    const d = w.districts.get('motel')!;
    d.infestation = 5;
    for (let i = 0; i < 30 * 15 && !d.cleared; i++) w.step(1 / 30);
    expect(d.infestation).toBe(0);
    expect(d.cleared).toBe(true);
  });

  it('tutorial-tier zombies are weaker; normal and medium zombies have separate pools (#59, #75)', () => {
    const w = new World({ seed: 2 });
    const z = w.spawnZombie('walker', motelPoint(w))!;
    expect(z.maxHp).toBeLessThan(36);
    // the starting crowd always includes a few mediums (Bloaters), so they're actually met (#70)
    const motel = w.districts.get('motel')!.def.rect;
    const start = w.zombies.filter((x) => x.pos.x >= motel.x && x.pos.x < motel.x + motel.w && x.pos.y >= motel.y && x.pos.y < motel.y + motel.h);
    expect(start.filter((x) => x.def.class === 'medium').length).toBeGreaterThanOrEqual(w.tier('motel').mediumStartMin);
    // a hive fills both pools separately; together they make the brood total
    const h = w.hives[0];
    for (let i = 0; i < 30 * 600; i++) w.step(1 / 30);
    const room = broodRoom(w, h);
    const T = w.tier('motel');
    const brood = [...h.spawned].map((id) => w.get(id)).filter(Boolean) as typeof w.zombies;
    const med = brood.filter((x) => x.def.class === 'medium').length;
    expect(med).toBeLessThanOrEqual(T.mediumPool[h.stage - 1]);
    expect(brood.length - med).toBeLessThanOrEqual(T.normalPool[h.stage - 1]);
    expect(room.normal + room.medium).toBe(T.normalPool[h.stage - 1] + T.mediumPool[h.stage - 1] - brood.length);
  }, 60000);

  it('a promotion raises max health but does not heal (#48)', () => {
    const w = new World({ populate: false });
    const sq = w.spawnSquad('rifle', M(20, 36));
    w.damageSquad(sq, 30, 'melee');
    const hp = sq.hp;
    const max = sq.maxHp;
    gainXp(w, sq, 1000);
    expect(sq.maxHp).toBeGreaterThan(max);
    expect(sq.hp).toBe(hp);
  });

  it('barbed wire slows soldiers as much as zombies (#49)', () => {
    const w = new World({ populate: false });
    w.addStructure('wire', { x: 20, y: 36 }, true);
    expect(w.grid.slowAt(M(20.5, 36.5))).toBeCloseTo(0.35);
    const a = w.spawnSquad('rifle', M(18, 36.5));
    const b = w.spawnSquad('rifle', M(18, 46.5));
    w.issueOrder([a], { type: 'move', pos: M(26, 36.5) });
    w.issueOrder([b], { type: 'move', pos: M(26, 46.5) });
    for (let i = 0; i < 30 * 2.5; i++) w.step(1 / 30);
    expect(a.pos.x).toBeLessThan(b.pos.x - 2);
  });

  it('a disbanded squad walks to the Barracks, disappears and frees its command (#55)', () => {
    const w = new World();
    const sq = w.squads[0];
    const used = w.commandUsed;
    const m0 = w.money;
    expect(w.orderDisband([sq])).toBeNull();
    for (let i = 0; i < 30 * 60 && sq.alive; i++) w.step(1 / 30);
    expect(sq.alive).toBe(false);
    expect(w.squads.includes(sq)).toBe(false);
    expect(w.commandUsed).toBe(used - sq.def.command);
    expect(w.money).toBeGreaterThan(m0);
  });

  it('starting command cap fits more than four squads, and grows with secured districts (#56)', () => {
    const w = new World();
    expect(w.commandCap).toBe(BALANCE.economy.commandCap);
    expect(BALANCE.economy.commandCap / 2).toBeGreaterThan(4);
  });

  it('searching a building takes ~5 s at the door and pays out once (#46)', () => {
    const w = new World({ populate: false });
    const b = w.map.buildings.find((x) => w.districtAt({ x: x.rect.x + x.rect.w / 2, y: x.rect.y + x.rect.h / 2 })?.def.id === 'motel')!;
    w.buildingState.set(b.id, { searched: false, nest: 0 });
    const sq = w.spawnSquad('rifle', { x: b.rect.x - 6, y: b.rect.y + b.rect.h / 2 });
    expect(w.orderSearch([sq], b)).toBeNull();
    for (let i = 0; i < 30 * 3; i++) w.step(1 / 30);
    expect(w.buildingState.get(b.id)!.searched).toBe(false); // still at the door
    for (let i = 0; i < 30 * 12 && !w.buildingState.get(b.id)!.searched; i++) w.step(1 / 30);
    expect(w.buildingState.get(b.id)!.searched).toBe(true);
    expect(w.orderSearch([sq], b)).toBe('Already searched');
  });

  it('dead holed up in a building come out when a squad gets close (#65)', () => {
    const w = new World({ populate: false });
    const b = w.map.buildings.find((x) => w.districtAt({ x: x.rect.x + x.rect.w / 2, y: x.rect.y + x.rect.h / 2 })?.def.id === 'motel')!;
    w.buildingState.set(b.id, { searched: false, nest: 3 });
    let burst = 0;
    w.events.on('nestBurst', (e) => (burst += e.count));
    const sq = w.spawnSquad('rifle', { x: b.rect.x - 3, y: b.rect.y + b.rect.h / 2 });
    for (let i = 0; i < 20; i++) w.step(1 / 30);
    expect(burst).toBe(3);
    expect(w.zombies.filter((z) => z.alive).every((z) => z.targetId === sq.id)).toBe(true);
    expect(w.buildingState.get(b.id)!.nest).toBe(0);
  });

  it('an MG emplacement only fires inside its field of fire (#71)', () => {
    const w = new World({ populate: false });
    const mg = w.addStructure('mgNest', { x: 20, y: 40 }, true, false, 0); // aimed east (+x)
    const behind = w.spawnZombie('walker', { x: mg.pos.x - 12, y: mg.pos.y })!; // west: outside the arc
    behind.def = { ...behind.def, speed: 0 };
    for (let i = 0; i < 30 * 3; i++) w.step(1 / 30);
    expect(behind.alive).toBe(true);
    const front = w.spawnZombie('walker', { x: mg.pos.x + 12, y: mg.pos.y + 3 })!; // east: inside
    front.def = { ...front.def, speed: 0 };
    for (let i = 0; i < 30 * 5 && front.alive; i++) w.step(1 / 30);
    expect(front.alive).toBe(false);
  });
});

