import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { findPath } from '../src/sim/pathfinding';
import { Structure } from '../src/sim/entities';
import { BALANCE } from '../src/config/balance';

const inRect = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

/** Secure a district instantly: no hives or dead, 0%, an outpost. */
function secure(w: World, id: string): void {
  for (const h of w.hives) if (h.districtId === id) h.alive = false;
  const d = w.districts.get(id)!;
  for (const z of w.zombies) if (inRect(z.pos, d.def.rect)) z.alive = false;
  d.infestation = 0;
  const c = w.grid.cell;
  const spot = w.grid.nearestFree({ x: d.def.rect.x + d.def.rect.w / 2, y: d.def.rect.y + d.def.rect.h / 2 });
  w.addStructure('outpost', { x: Math.round(spot.x / c) - 1, y: Math.round(spot.y / c) - 1 }, true);
  for (let i = 0; i < 30 && !d.secured; i++) w.step(1 / 30);
}

describe('tutorial region 3: Rail Siding and the power system (v4.17)', () => {
  it('stays fenced off until Gas Station Strip is secured, then opens with two hives and an offline power station', () => {
    const w = new World({ seed: 5 });
    const rail = w.districts.get('railSiding')!;
    secure(w, 'motel');
    expect(w.districts.get('gasStrip')!.locked).toBe(false);
    expect(rail.locked).toBe(true);
    expect(w.zombies.filter((z) => z.alive && inRect(z.pos, rail.def.rect)).length).toBe(0);

    secure(w, 'gasStrip');
    expect(rail.locked).toBe(false);
    expect(w.hives.filter((h) => h.alive && h.districtId === 'railSiding').length).toBe(2);
    expect(w.zombies.filter((z) => z.alive && inRect(z.pos, rail.def.rect)).length).toBeGreaterThan(50);
    const station = w.structures.find((s) => s.def.id === 'powerStation')!;
    expect(station).toBeTruthy();
    expect(station.built).toBe(false);
    expect(w.powerOnline).toBe(false);
    // reachable from the base gate once open
    const g = w.map.baseGate;
    expect(findPath(w.grid, { x: g.x + g.w + 4, y: g.y + g.h / 2 }, { x: station.pos.x - 15, y: station.pos.y })).not.toBeNull();
    // and the tutorial isn't won until region 3 is secured too
    expect(w.over).toBeFalsy();
  });

  it('engineers restore the power station only with the yard clear; power unlocks the Vehicle Bay (STATUS #50)', () => {
    const w = new World({ populate: false });
    w.unlockDistrict('gasStrip');
    w.unlockDistrict('railSiding');
    for (const z of w.zombies) z.alive = false;
    const station = w.structures.find((s) => s.def.id === 'powerStation')!;
    const eng = w.spawnSquad('engineer', { x: station.pos.x - 14, y: station.pos.y });
    expect(w.canPlace('vehicleBay', { x: 10, y: 30 })).toBe('Not unlocked yet');
    // a zombie in the yard stops the work
    const z = w.spawnZombie('walker', { x: station.pos.x + 12, y: station.pos.y + 14 })!;
    z.def = { ...z.def, speed: 0, sight: 0, hearing: 0, damage: 0 };
    eng.def = { ...eng.def, weapon: { ...eng.def.weapon, damage: 0 } };
    expect(w.orderResume([eng], station)).toBeNull();
    for (let i = 0; i < 30 * 15; i++) w.step(1 / 30);
    expect(station.buildProgress).toBe(0);
    z.alive = false;
    let first = false;
    w.events.on('powerRestored', (e) => (first = e.first));
    for (let i = 0; i < 30 * 60 && !station.built; i++) w.step(1 / 30);
    expect(station.built).toBe(true);
    expect(w.powerOnline).toBe(true);
    expect(first).toBe(true);
    w.money = 999;
    w.supplies = 150;
    expect(w.canPlace('vehicleBay', { x: 10, y: 30 })).toBeNull(); // inside the base
    expect(w.canPlace('vehicleBay', { x: 70, y: 30 })).toMatch(/inside the main base/);
  });

  it('a wrecked power station goes offline instead of disappearing', () => {
    const w = new World({ populate: false });
    w.unlockDistrict('railSiding');
    const station = w.structures.find((s) => s.def.id === 'powerStation') as Structure;
    station.built = true;
    station.hp = station.def.hp;
    expect(w.powerOnline).toBe(true);
    w.damageStructure(station, 1e6);
    expect(station.alive).toBe(true);
    expect(station.built).toBe(false);
    expect(w.powerOnline).toBe(false);
  });

  it('a working Med Bay heals resting squads for supplies and soldiers rejoin (no power needed since STATUS #50)', () => {
    const w = new World({ populate: false });
    w.unlockDistrict('railSiding');
    const station = w.structures.find((s) => s.def.id === 'powerStation')!;
    const bay = w.addStructure('medBay', { x: 10, y: 30 }, true);
    const sq = w.spawnSquad('rifle', { x: bay.pos.x + 7, y: bay.pos.y });
    w.issueOrder([sq], { type: 'hold', pos: sq.pos });
    w.damageSquad(sq, sq.poolMax * 0.6, 'melee');
    expect(sq.aliveCount).toBe(2);
    w.supplies = 150;
    const hp0 = sq.hp;
    expect(station.built).toBe(false); // the power is off: it heals anyway
    const before = w.supplies;
    for (let i = 0; i < 30 * 60; i++) w.step(1 / 30);
    expect(sq.hp).toBeGreaterThan(hp0);
    expect(sq.aliveCount).toBeGreaterThan(2);
    // healing costs supplies: less than a minute's income was added (no cap since round 11 #136)
    expect(w.supplies).toBeLessThan(before + BALANCE.economy.baseSuppliesPerMin);
  });
});
