import { describe, expect, it } from 'vitest';
import { pickTarget } from '../src/sim/targeting';
import { ThreatClass, type Targetable } from '../src/sim/types';
import { World } from '../src/sim/World';
import { BALANCE } from '../src/config/balance';
import { findPath } from '../src/sim/pathfinding';

const T = (id: number, x: number, y: number, threat = ThreatClass.Normal, alive = true): Targetable => ({
  id, faction: 'zombie', pos: { x, y }, alive, threat, radius: 0,
});

describe('threat-priority targeting (doc §5)', () => {
  const base = { pos: { x: 0, y: 0 }, range: 10, dangerClose: 3 };

  it('keeps shooting the locked target instead of switching to a nearer one', () => {
    const locked = T(1, 8, 0);
    const nearer = T(2, 5, 0);
    expect(pickTarget({ ...base, current: locked, candidates: [locked, nearer] })).toBe(locked);
  });

  it('breaks the lock for anything danger-close', () => {
    const locked = T(1, 8, 0);
    const inFace = T(2, 2, 0);
    expect(pickTarget({ ...base, current: locked, candidates: [locked, inFace] })).toBe(inFace);
  });

  it('prefers higher threat when nothing is danger-close', () => {
    const walker = T(1, 4, 0);
    const special = T(2, 9, 0, ThreatClass.Special);
    const boss = T(3, 9.5, 0, ThreatClass.Boss);
    expect(pickTarget({ ...base, current: null, candidates: [walker, special, boss] })).toBe(boss);
  });

  it('drops dead or out-of-range locks', () => {
    const dead = T(1, 5, 0, ThreatClass.Normal, false);
    const far = T(2, 20, 0);
    const ok = T(3, 6, 0);
    expect(pickTarget({ ...base, current: dead, candidates: [dead, far, ok] })).toBe(ok);
  });
});

describe('world rules', () => {
  it('starts with the doc §11 economy and force', () => {
    const w = new World();
    expect(w.money).toBe(250);
    expect(w.supplies).toBe(100);
    expect(w.commandCap).toBe(8);
    expect(w.squads.map((s) => s.def.id).sort()).toEqual(['engineer', 'rifle', 'rifle']);
  });

  it('loses members individually and wipes permanently', () => {
    const w = new World({ populate: false });
    const sq = w.spawnSquad('rifle', { x: 10, y: 36 });
    w.damageSquad(sq, 1000, 'melee');
    expect(sq.aliveCount).toBe(3);
    for (let i = 0; i < 3; i++) w.damageSquad(sq, 1000, 'melee');
    expect(sq.alive).toBe(false);
    w.step(1 / 30);
    expect(w.squads.includes(sq)).toBe(false);
  });

  it('bullets cannot destroy hives; explosives can (doc §9)', () => {
    const w = new World();
    const h = w.hives[0];
    w.damageHive(h, 99999, 'bullet');
    expect(h.alive).toBe(true);
    w.damageHive(h, 99999, 'explosive');
    expect(h.alive).toBe(false);
  });

  it('an engineer can plant a charge even when parked cars crowd the hive, and it kills a stage-1 hive', () => {
    const w = new World({ seed: 1 });
    for (const z of w.zombies) z.alive = false;
    w.step(1 / 30);
    const hive = w.hives[0];
    hive.spawnTimer = 1e9;
    const eng = w.squads.find((s) => s.def.id === 'engineer')!;
    eng.pos = { x: 92, y: 55 }; // approach from the side where cars block the closest tiles
    expect(w.orderCharge([eng], hive)).toBeNull();
    for (let i = 0; i < 30 * 15 && hive.alive; i++) w.step(1 / 30);
    expect(hive.alive).toBe(false);
    expect(eng.alive).toBe(true); // it ran from its own blast
  });

  describe('gunfire is heard beyond sight (doc §9 noise)', () => {
    // squad on the main road, zombie tucked behind the building at x42–49, y20–29 (19 tiles away, no line of sight)
    const setup = (shoot: boolean) => {
      const w = new World({ populate: false, seed: 5 });
      const sq = w.spawnSquad('rifle', { x: 45.5, y: 36.5 });
      w.issueOrder([sq], { type: 'hold', pos: sq.pos });
      const hidden = w.spawnZombie('runner', { x: 45.5, y: 17.5 })!;
      if (shoot) w.spawnZombie('walker', { x: 52, y: 36.5 }); // something to shoot at
      let closest = Infinity;
      for (let i = 0; i < 30 * 15; i++) {
        w.step(1 / 30);
        if (hidden.alive) closest = Math.min(closest, Math.hypot(hidden.pos.x - sq.pos.x, hidden.pos.y - sq.pos.y));
        else closest = 0; // it came close enough to be shot
      }
      return { closest, sees: w.grid.lineClear(sq.pos, { x: 45.5, y: 17.5 }) };
    };

    it('the hidden zombie really is out of sight', () => {
      expect(setup(false).sees).toBe(false);
    });
    it('stays put when nobody shoots', () => {
      expect(setup(false).closest).toBeGreaterThan(12);
    });
    it('comes around the building toward the shots', () => {
      expect(setup(true).closest).toBeLessThan(9);
    });
  });

  it('hives get tougher as they mature and never regress (doc §9)', () => {
    const w = new World({ populate: true });
    const h = w.hives[0];
    const hp1 = h.hp;
    for (let i = 0; i < 30 * (BALANCE.hive.stageDurationSec[0] + 1); i++) w.step(1 / 30);
    expect(h.stage).toBe(2);
    expect(h.hp).toBeGreaterThan(hp1);
  });

  it('infestation cannot reach zero while a hive lives', () => {
    const w = new World();
    const d = w.districts.get('motel')!;
    d.infestation = 0;
    w.step(1 / 30);
    expect(d.infestation).toBeGreaterThan(0);
  });

  it('outposts require 0% infestation', () => {
    const w = new World();
    const d = w.districts.get('motel')!;
    expect(w.canPlace('outpost', { x: 45, y: 31 })).toMatch(/Infestation/);
    d.infestation = 0;
    for (const z of w.zombies) z.alive = false;
    w.step(1 / 30);
    d.infestation = 0;
    w.money = 999;
    w.supplies = 999;
    expect(w.canPlace('outpost', { x: 45, y: 30 })).toBeNull();
  });

  it('charges daily upkeep', () => {
    const w = new World({ populate: false });
    w.spawnSquad('rifle', { x: 10, y: 36 });
    const before = w.supplies;
    for (let t = 0; t < BALANCE.economy.dayLengthSec * 30 + 2; t++) w.step(1 / 30);
    expect(w.day).toBe(2);
    expect(w.supplies).toBe(Math.min(BALANCE.economy.supplyCap, before + BALANCE.economy.baseSuppliesPerDay) - 4);
  });

  it('finds a path from the base out to the motel', () => {
    const w = new World();
    const p = findPath(w.grid, { x: 20, y: 36 }, { x: 70, y: 22 });
    expect(p).not.toBeNull();
    const end = p![p!.length - 1];
    expect(Math.hypot(end.x - 70, end.y - 22)).toBeLessThan(1.5);
  });

  it('a held street with rifle squads kills an approaching walker horde (the doc §15 fun check)', () => {
    const w = new World({ populate: false, seed: 3 });
    // dig in: sandbags across the road, squads behind them
    w.addStructure('sandbags', { x: 42, y: 34 }, true, true);
    w.addStructure('sandbags', { x: 42, y: 37 }, true, true);
    const squads = [w.spawnSquad('rifle', { x: 40.5, y: 35 }), w.spawnSquad('rifle', { x: 40.5, y: 37.5 })];
    w.issueOrder(squads, { type: 'hold', pos: { x: 40, y: 36 } });
    for (let i = 0; i < 16; i++) {
      const z = w.spawnZombie('walker', { x: 50 + (i % 4), y: 34.5 + Math.floor(i / 4) })!;
      z.goal = { x: 40, y: 36 };
      z.state = 'pulse';
    }
    for (let t = 0; t < 30 * 40; t++) w.step(1 / 30);
    expect(w.zombies.filter((z) => z.alive).length).toBe(0);
    expect(w.squads.length).toBe(2);
  });
});
