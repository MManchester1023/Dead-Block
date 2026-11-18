import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { BALANCE } from '../src/config/balance';
import { STRUCTURES } from '../src/config/units';

const step = (w: World, sec: number) => {
  for (let i = 0; i < Math.round(sec * 30); i++) w.step(1 / 30);
};

describe('round 12 playtest (v4.36)', () => {
  it('after a noise pulse the district meter stays empty for 45 s (#149)', () => {
    const w = new World({ seed: 2 });
    const d = w.districts.get('motel')!;
    d.noise = BALANCE.noise.pulseThreshold;
    w.step(1 / 30); // the hive pulses and empties the meter
    expect(d.noise).toBe(0);
    expect(d.noiseLockUntil).toBeGreaterThan(w.time + 44);
    w.makeNoise({ x: d.def.rect.x + 20, y: d.def.rect.y + 20 }, 50);
    expect(d.noise).toBe(0);
    d.noiseLockUntil = w.time; // cooldown over
    w.makeNoise({ x: d.def.rect.x + 20, y: d.def.rect.y + 20 }, 50);
    expect(d.noise).toBeGreaterThan(0);
  });

  it('every house is its own building: rows are split, nothing overlaps, one search marks one house (#141)', () => {
    const w = new World();
    const houses = w.map.buildings.filter((b) => b.kind === 'houses');
    for (const b of houses) expect(Math.max(b.rect.w, b.rect.h) <= 30 && Math.min(b.rect.w, b.rect.h) <= 20).toBe(true);
    const B = w.map.buildings;
    for (let i = 0; i < B.length; i++)
      for (let j = i + 1; j < B.length; j++) {
        const a = B[i].rect, b = B[j].rect;
        const overlap = a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;
        expect(overlap).toBe(false);
      }
    expect(new Set(B.map((b) => b.id)).size).toBe(B.length);
    // two houses split from one row: searching one leaves the other unsearched
    const row = houses.filter((h) => houses.some((o) => o !== h && Math.abs(o.rect.y - h.rect.y) < 0.01 && Math.abs(o.rect.x + o.rect.w - h.rect.x) < 0.01));
    expect(row.length).toBeGreaterThan(0);
    const right = row[0];
    const left = houses.find((o) => Math.abs(o.rect.y - right.rect.y) < 0.01 && Math.abs(o.rect.x + o.rect.w - right.rect.x) < 0.01)!;
    for (const b of [left, right]) w.buildingState.set(b.id, { searched: false, nest: 0 });
    w.finishSearch(w.squads[0], left);
    expect(w.buildingState.get(left.id)!.searched).toBe(true);
    expect(w.buildingState.get(right.id)!.searched).toBe(false);
  });

  it('a click picks the structure whose footprint holds it, not a neighbour (#148)', () => {
    const w = new World({ populate: false });
    const a = w.addStructure('sandbags', { x: 20, y: 10 }, true); // 3 x 1 cells
    const b = w.addStructure('sandbags', { x: 23, y: 10 }, true); // right next to it
    const c = w.grid.cell;
    expect(w.structureAt({ x: 22.8 * c, y: 10.5 * c })).toBe(a);
    expect(w.structureAt({ x: 23.2 * c, y: 10.5 * c })).toBe(b);
    expect(w.structureAt({ x: 30 * c, y: 30 * c })).toBeUndefined();
  });

  it('a structure placed on a squad pushes the squad off it (#147)', () => {
    const w = new World({ populate: false });
    const sq = w.spawnSquad('engineer', { x: 21.5 * 3, y: 10.5 * 3 });
    w.addStructure('sandbags', { x: 20, y: 10 }, false);
    expect(w.grid.isBlockedXY(sq.pos.x, sq.pos.y)).toBe(false);
    for (const m of sq.members) expect(w.grid.isBlockedXY(m.pos.x, m.pos.y)).toBe(false);
  });

  it("engineers at work don't shoot (#140)", () => {
    const w = new World({ populate: false });
    const eng = w.spawnSquad('engineer', { x: 60, y: 30 });
    w.money = 999;
    w.supplies = 999;
    expect(w.orderBuild([eng], 'mgNest', { x: 21, y: 9 })).toBeNull();
    step(w, 8); // walk over and start
    const z = w.spawnZombie('walker', { x: eng.pos.x + 12, y: eng.pos.y })!;
    z.def = { ...z.def, speed: 0 };
    let shots = 0;
    w.events.on('shot', () => shots++);
    step(w, 3);
    expect(eng.currentOrder?.type).toBe('build');
    expect(shots).toBe(0);
  });

  it('the Garrison is installed by engineers in ~6 s and paid when done (#138)', () => {
    const w = new World({ populate: false });
    const op = w.addStructure('outpost', { x: 20, y: 10 }, true);
    expect(w.orderUpgrade([], op)).toBe('Needs an engineer team');
    const eng = w.spawnSquad('engineer', { x: op.pos.x + 9, y: op.pos.y });
    w.money = 500;
    w.supplies = 100;
    expect(w.orderUpgrade([], op)).toBeNull();
    expect(eng.currentOrder?.type).toBe('upgrade');
    step(w, 3);
    expect(op.upgraded).toBe(false);
    expect(w.money).toBe(500);
    step(w, 8);
    expect(op.upgraded).toBe(true);
    expect(w.money).toBe(500 - STRUCTURES.outpost.upgrade!.cost.money);
  });

  it('leftover dead idle for 2 minutes in a hive-less district head for your structures (#144)', () => {
    const w = new World({ populate: false });
    for (const h of w.hives) h.alive = false;
    const d = w.districts.get('motel')!;
    const r = d.def.rect;
    const bags = w.addStructure('sandbags', { x: Math.floor((r.x + 10) / 3), y: Math.floor((r.y + r.h - 12) / 3) }, true);
    const z = w.spawnZombie('walker', { x: r.x + r.w / 2 + 20, y: r.y + r.h / 2 - 20 })!;
    step(w, 60);
    expect(z.state === 'idle' || z.state === 'wander').toBe(true);
    step(w, 65);
    expect(z.state).toBe('roam');
    const d0 = Math.hypot(z.pos.x - bags.pos.x, z.pos.y - bags.pos.y);
    step(w, 30);
    expect(Math.hypot(z.pos.x - bags.pos.x, z.pos.y - bags.pos.y)).toBeLessThan(d0);
  });

  it('no command cap once Rail Siding is open (#143)', () => {
    const w = new World({ seed: 2 });
    expect(w.hasCommandCap).toBe(true);
    w.money = 99999;
    w.supplies = 99999;
    w.commandCap = 0;
    expect(w.queueProduction('rifle')).toMatch(/Command cap/);
    w.unlockDistrict('railSiding');
    expect(w.hasCommandCap).toBe(false);
    expect(w.queueProduction('rifle')).toBeNull();
  });

  it('resting soldiers stand still or walk to their spot; they never slide slowly (#137)', () => {
    const w = new World({ populate: false });
    const sq = w.spawnSquad('rifle', { x: 60, y: 30 });
    w.issueOrder([sq], { type: 'move', pos: { x: 75, y: 30 } });
    step(w, 6);
    // a target off to the side makes the resting squad turn
    const z = w.spawnZombie('walker', { x: sq.pos.x, y: sq.pos.y + 20 })!;
    z.def = { ...z.def, speed: 0 };
    const prev = sq.members.map((m) => ({ ...m.pos }));
    let slow = 0;
    for (let i = 0; i < 30 * 4; i++) {
      w.step(1 / 30);
      sq.members.forEach((m, k) => {
        const v = Math.hypot(m.pos.x - prev[k].x, m.pos.y - prev[k].y) * 30;
        if (!sq.moving && v > 0.05 && v < 1.5) slow++;
        prev[k] = { ...m.pos };
      });
    }
    expect(slow).toBe(0);
  });
});
