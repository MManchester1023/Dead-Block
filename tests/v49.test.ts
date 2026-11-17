import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { BALANCE } from '../src/config/balance';
import { CELL } from '../src/config/world';
import { gainXp } from '../src/sim/systems/combat';
import { specialRoom } from '../src/sim/systems/hives';

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

  it('tutorial-tier zombies are weaker and Runners/Bloaters are capped per district (#53, #59)', () => {
    const w = new World({ populate: false });
    const z = w.spawnZombie('walker', motelPoint(w))!;
    expect(z.maxHp).toBeLessThan(36);
    const p = motelPoint(w);
    for (let i = 0; i < 30; i++) w.spawnZombie('walker', { x: p.x + (i % 6) * 2, y: p.y + Math.floor(i / 6) * 2 });
    const room = specialRoom(w, 'motel');
    expect(room).toBeGreaterThan(0);
    expect(room).toBeLessThanOrEqual(w.tier('motel').specialMax);
    for (let i = 0; i < room; i++) w.spawnZombie('runner', { x: p.x - 10, y: p.y + i });
    expect(specialRoom(w, 'motel')).toBe(0);
  });

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
});
