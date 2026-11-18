import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { BALANCE, HORDE } from '../src/config/balance';
import { ZOMBIES } from '../src/config/units';

/** v4.49: "more zombies, but weaker" (moderate: twice the dead, 60% health, 75% damage per hit). */
describe('the horde setting (v4.49)', () => {
  it('is the moderate starting point', () => {
    expect(HORDE).toEqual({ count: 2, toughness: 0.6, damage: 0.75 });
  });

  it('zombies have 60% of their health (before the region tier)', () => {
    const w = new World({ populate: false });
    const z = w.spawnZombie('walker', { x: 5, y: 5 })!; // outside any district: no tier multiplier
    expect(z.maxHp).toBeCloseTo(ZOMBIES.walker.hp * HORDE.toughness);
  });

  it('a kill pays and clears half as much, so twice the dead give the same totals', () => {
    const w = new World({ populate: false });
    const d = w.districts.get('motel')!;
    const r = d.def.rect;
    const z = w.spawnZombie('walker', { x: r.x + r.w / 2, y: r.y + r.h / 2 })!;
    const m0 = w.money;
    const i0 = d.infestation;
    w.damageZombie(z, 999, 'bullet');
    expect(w.money - m0).toBeCloseTo(ZOMBIES.walker.bounty.money / HORDE.count);
    expect(i0 - d.infestation).toBeCloseTo(BALANCE.infestation.perKill.walker / HORDE.count);
  });

  it('a zombie hit does 75% of its listed damage', () => {
    const w = new World({ populate: false });
    const sq = w.spawnSquad('rifle', { x: 60, y: 30 });
    const z = w.spawnZombie('walker', { x: 61, y: 30 })!;
    z.def = { ...z.def, speed: 0 };
    const p0 = sq.pool;
    for (let i = 0; i < 30 * 3 && sq.pool === p0; i++) w.step(1 / 30);
    expect(p0 - sq.pool).toBeCloseTo(ZOMBIES.walker.damage * HORDE.damage, 5);
  });
});
