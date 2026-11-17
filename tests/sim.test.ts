import { describe, expect, it } from 'vitest';
import { pickTarget } from '../src/sim/targeting';
import { ThreatClass, type Targetable } from '../src/sim/types';
import { World } from '../src/sim/World';
import { BALANCE } from '../src/config/balance';
import { findPath } from '../src/sim/pathfinding';
import { CELL } from '../src/config/world';

/** Positions below are written in nav cells (as on the map sketch) and converted to metres. */
const M = (x: number, y: number) => ({ x: x * CELL, y: y * CELL });

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
    expect(w.commandCap).toBe(16);
    expect(w.squads.map((s) => s.def.id).sort()).toEqual(['engineer', 'rifle', 'rifle']);
  });

  it('shares one health pool, drops soldiers at thresholds and wipes permanently (v4.9)', () => {
    const w = new World({ populate: false });
    const sq = w.spawnSquad('rifle', M(10, 36));
    const share = sq.poolMax / sq.members.length;
    w.damageSquad(sq, share * 0.5, 'melee'); // half a soldier's worth: everyone still standing
    expect(sq.aliveCount).toBe(4);
    w.damageSquad(sq, share * 0.6, 'melee'); // crossed 75%: one drops
    expect(sq.aliveCount).toBe(3);
    w.damageSquad(sq, share * 1.9, 'melee'); // below 25%+: down to one
    expect(sq.aliveCount).toBe(1);
    expect(sq.hp).toBeGreaterThan(0);
    w.damageSquad(sq, 1000, 'melee');
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
    eng.pos = M(92, 55); // approach from the side where cars block the closest tiles
    expect(w.orderCharge([eng], hive)).toBeNull();
    for (let i = 0; i < 30 * 15 && hive.alive; i++) w.step(1 / 30);
    expect(hive.alive).toBe(false);
    expect(eng.alive).toBe(true); // it ran from its own blast
  });

  describe('gunfire is heard beyond sight (doc §9 noise)', () => {
    // squad on the main road, zombie tucked behind the building at x42–49, y20–29 (19 tiles away, no line of sight)
    const setup = (shoot: boolean) => {
      const w = new World({ populate: false, seed: 5 });
      const sq = w.spawnSquad('rifle', M(45.5, 36.5));
      w.issueOrder([sq], { type: 'hold', pos: sq.pos });
      const hidden = w.spawnZombie('runner', M(45.5, 17.5))!;
      if (shoot) w.spawnZombie('walker', M(52, 36.5)); // something to shoot at
      let closest = Infinity;
      for (let i = 0; i < 30 * 15; i++) {
        w.step(1 / 30);
        if (hidden.alive) closest = Math.min(closest, Math.hypot(hidden.pos.x - sq.pos.x, hidden.pos.y - sq.pos.y));
        else closest = 0; // it came close enough to be shot
      }
      return { closest, sees: w.grid.lineClear(sq.pos, M(45.5, 17.5)) };
    };

    it('the hidden zombie really is out of sight', () => {
      expect(setup(false).sees).toBe(false);
    });
    it('stays put when nobody shoots', () => {
      expect(setup(false).closest).toBeGreaterThan(12 * CELL);
    });
    it('comes around the building toward the shots', () => {
      expect(setup(true).closest).toBeLessThan(9 * CELL);
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
    const income = (BALANCE.economy.baseSuppliesPerMin * BALANCE.economy.dayLengthSec) / 60;
    expect(w.supplies).toBeCloseTo(Math.min(BALANCE.economy.supplyCap, before + income) - 4, 0);
  });

  it('finds a path from the base out to the motel', () => {
    const w = new World();
    const p = findPath(w.grid, M(20, 36), M(70, 22));
    expect(p).not.toBeNull();
    const end = p![p!.length - 1];
    expect(Math.hypot(end.x - 70 * CELL, end.y - 22 * CELL)).toBeLessThan(1.5 * CELL);
  });

  it('a held street with rifle squads kills an approaching walker horde (the doc §15 fun check)', () => {
    const w = new World({ populate: false, seed: 3 });
    // dig in: sandbags across the road, squads behind them
    w.addStructure('sandbags', { x: 42, y: 34 }, true, true);
    w.addStructure('sandbags', { x: 42, y: 37 }, true, true);
    const squads = [w.spawnSquad('rifle', M(40.5, 35)), w.spawnSquad('rifle', M(40.5, 37.5))];
    w.issueOrder(squads, { type: 'hold', pos: M(40, 36) });
    for (let i = 0; i < 16; i++) {
      const z = w.spawnZombie('walker', M(50 + (i % 4), 34.5 + Math.floor(i / 4)))!;
      z.goal = M(40, 36);
      z.state = 'pulse';
    }
    for (let t = 0; t < 30 * 40; t++) w.step(1 / 30);
    expect(w.zombies.filter((z) => z.alive).length).toBe(0);
    expect(w.squads.length).toBe(2);
  });

  describe('v4.2 playtest fixes', () => {
    it('right-click attack: the squad kills the chosen zombie before a closer one', () => {
      const w = new World({ populate: false, seed: 9 });
      const sq = w.spawnSquad('rifle', M(20, 36));
      w.issueOrder([sq], { type: 'hold', pos: sq.pos });
      const near = w.spawnZombie('walker', { x: sq.pos.x + 12, y: sq.pos.y })!;
      const chosen = w.spawnZombie('walker', { x: sq.pos.x + 20, y: sq.pos.y + 2 })!;
      near.state = chosen.state = 'idle';
      near.def = { ...near.def, speed: 0, sight: 0 }; // keep both still so only targeting is tested
      chosen.def = { ...chosen.def, speed: 0, sight: 0 };
      w.orderAttack([sq], chosen);
      let chosenDiedFirst = false;
      for (let i = 0; i < 30 * 20 && near.alive; i++) {
        w.step(1 / 30);
        if (!chosen.alive && near.alive) chosenDiedFirst = true;
      }
      expect(chosenDiedFirst).toBe(true);
    });

    it('zombie aggro is time-based: it keeps hunting a squad that runs out of sight', () => {
      const w = new World({ populate: false, seed: 4 });
      const sq = w.spawnSquad('rifle', M(15, 36));
      sq.pool = sq.poolMax = 1e6; // survive the test
      const z = w.spawnZombie('walker', { x: sq.pos.x + 8, y: sq.pos.y })!;
      for (let i = 0; i < 15; i++) w.step(1 / 30); // it spots us
      expect(z.state).toBe('chase');
      // run west, far beyond its 14 m sight, without shooting
      sq.def = { ...sq.def, weapon: { ...sq.def.weapon, range: 0 } };
      w.issueOrder([sq], { type: 'move', pos: M(5, 30) });
      for (let i = 0; i < 30 * 8; i++) w.step(1 / 30);
      expect(Math.hypot(z.pos.x - sq.pos.x, z.pos.y - sq.pos.y)).toBeGreaterThan(z.def.sight);
      expect(z.targetId).toBe(sq.id); // still hunting after 8 s out of sight
    });

    it('engineers deconstruct: full refund before work starts, half once built', () => {
      const w = new World({ populate: false });
      w.money = 500;
      w.supplies = 100;
      const site = w.addStructure('sandbags', { x: 20, y: 40 }, false);
      const m0 = w.money;
      w.dismantle(site);
      expect(w.money).toBe(m0 + 15);
      const built = w.addStructure('mgNest', { x: 20, y: 44 }, true);
      const m1 = w.money;
      w.dismantle(built);
      expect(w.money).toBe(m1 + 70);
      expect(w.grid.isBlocked(20, 44)).toBe(false);
      expect(w.canDeconstruct(w.structures.find((s) => s.def.id === 'barracks') ?? built)).not.toBeNull();
    });

    it('an engineer team walks over and takes down its sandbags', () => {
      const w = new World({ populate: false });
      const eng = w.spawnSquad('engineer', M(20, 36));
      const bags = w.addStructure('sandbags', { x: 24, y: 34 }, true);
      expect(w.orderDeconstruct([eng], bags)).toBeNull();
      for (let i = 0; i < 30 * 15 && bags.alive; i++) w.step(1 / 30);
      expect(bags.alive).toBe(false);
    });
  });
});
