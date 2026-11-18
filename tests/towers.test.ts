import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { CELL } from '../src/config/world';

const M = (x: number, y: number) => ({ x: x * CELL, y: y * CELL });

describe('guard towers (v4.13, introduced by tutorial region 2)', () => {
  it('are locked until region 2 opens', () => {
    const w = new World({ populate: false });
    w.money = 999;
    w.supplies = 150;
    expect(w.canPlace('guardTower', { x: 20, y: 40 })).toBe('Not unlocked yet');
    w.unlockDistrict('gasStrip');
    expect(w.unlocked.has('guardTower')).toBe(true);
    expect(w.canPlace('guardTower', { x: 20, y: 40 })).toBeNull();
  });

  it('a squad mans it, reaches further, and the dead have to tear the tower down', () => {
    const w = new World({ populate: false });
    const tower = w.addStructure('guardTower', { x: 20, y: 40 }, true);
    const sq = w.spawnSquad('rifle', M(26, 41));
    expect(w.orderGarrison([sq], tower)).toBeNull();
    for (let i = 0; i < 30 * 10 && sq.garrisonedIn == null; i++) w.step(1 / 30);
    expect(sq.garrisonedIn).toBe(tower.id);
    // a second squad can't climb up too
    const other = w.spawnSquad('rifle', M(26, 45));
    expect(w.orderGarrison([other], tower)).toMatch(/already up there/);

    // range: a target ~38 m out is beyond a rifle (30 m) on the ground, but in reach from the tower (42 m)
    const far = w.spawnZombie('walker', { x: tower.pos.x + 38, y: tower.pos.y })!;
    far.def = { ...far.def, speed: 0, sight: 0, hearing: 0 };
    for (let i = 0; i < 30 * 8 && far.alive; i++) w.step(1 / 30);
    expect(far.alive).toBe(false);

    // melee hits land on the tower, not the squad
    const hp = sq.hp;
    const t0 = tower.hp;
    w.damage(sq, 20, 'melee');
    expect(sq.hp).toBe(hp);
    expect(tower.hp).toBe(t0 - 20);

    // tower down: the squad drops to the ground
    w.damage(tower, 1e6, 'explosive');
    for (let i = 0; i < 3; i++) w.step(1 / 30);
    expect(sq.garrisonedIn).toBeNull();
    expect(w.grid.isBlockedXY(sq.pos.x, sq.pos.y)).toBe(false);
  });

  it('any other order brings the squad down', () => {
    const w = new World({ populate: false });
    const tower = w.addStructure('guardTower', { x: 20, y: 40 }, true);
    const sq = w.spawnSquad('rifle', M(26, 41));
    w.orderGarrison([sq], tower);
    for (let i = 0; i < 30 * 10 && sq.garrisonedIn == null; i++) w.step(1 / 30);
    w.issueOrder([sq], { type: 'move', pos: M(30, 50) });
    // round 9 #97: down first, then off they go (v4.62: they jump down, 2.5 s with the landing)
    for (let i = 0; i < 30; i++) w.step(1 / 30);
    expect(sq.garrisonedIn).toBe(tower.id);
    expect(sq.climb?.up).toBe(false);
    for (let i = 0; i < 30 * 1.6; i++) w.step(1 / 30);
    expect(sq.garrisonedIn).toBeNull();
  });
});

describe('jumping down from a tower (v4.62)', () => {
  it('stays up while crouching to jump, falls over the airborne stretch, is down by the landing', async () => {
    const { jumpLift } = await import('../src/render/CrowdLayer');
    const h = 5.15;
    expect(jumpLift(0, h)).toBeCloseTo(h - 0.6);
    expect(jumpLift(1.3, h)).toBeCloseTo(h - 0.6);
    expect(jumpLift(1.6, h)).toBeLessThan(jumpLift(1.4, h));
    expect(jumpLift(1.85, h)).toBe(0);
    expect(jumpLift(2.4, h)).toBe(0);
  });
});
