import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { findPath } from '../src/sim/pathfinding';
import { BALANCE } from '../src/config/balance';
import { CELL } from '../src/config/world';

const M = (x: number, y: number) => ({ x: x * CELL, y: y * CELL });

describe('v4.15 playtest round 7', () => {
  it('a rifle is heard about 60 m away (#76)', () => {
    expect(2.2 * BALANCE.noise.hearingRadiusPerLoudness).toBeGreaterThan(55);
    expect(2.2 * BALANCE.noise.hearingRadiusPerLoudness).toBeLessThan(65);
  });

  it('squads path around Bloater gas instead of through it (#83)', () => {
    const w = new World({ populate: false });
    const from = M(36, 35.5);
    const to = M(52, 35.5);
    const mid = M(44, 35.5);
    w.clouds.push({ id: 999, pos: mid, radius: 5, remaining: 20, dps: 6 });
    w.step(1 / 30); // hazard map refresh
    const path = findPath(w.grid, from, to, 6000, w.hazard)!;
    expect(path).not.toBeNull();
    // densely sample the route: no point inside the cloud
    let prev = from;
    for (const p of path) {
      for (let t = 0; t <= 1; t += 0.05) {
        const x = prev.x + (p.x - prev.x) * t;
        const y = prev.y + (p.y - prev.y) * t;
        expect(Math.hypot(x - mid.x, y - mid.y)).toBeGreaterThan(4);
      }
      prev = p;
    }
  });

  it('an idle squad caught in fresh gas steps out of it (#83)', () => {
    const w = new World({ populate: false });
    const sq = w.spawnSquad('rifle', M(44, 35.5));
    w.clouds.push({ id: 998, pos: { ...sq.pos }, radius: 5, remaining: 20, dps: 0 });
    for (let i = 0; i < 30 * 5; i++) w.step(1 / 30);
    expect(Math.hypot(sq.pos.x - M(44, 35.5).x, sq.pos.y - M(44, 35.5).y)).toBeGreaterThan(5);
  });

  it('opening region 2 does not start a fight at the fence (#77)', () => {
    const w = new World({ seed: 4 });
    // squads waiting at the fence on the main road
    const waiting = [w.spawnSquad('rifle', M(100, 35)), w.spawnSquad('rifle', M(100, 37))];
    w.unlockDistrict('gasStrip');
    const d = w.districts.get('gasStrip')!;
    const inside = w.zombies.filter((z) => z.alive && z.pos.x >= d.def.rect.x);
    expect(inside.length).toBeGreaterThan(20);
    // nobody seeded within 50 m of the fence or 40 m of a squad
    expect(inside.every((z) => z.pos.x > d.def.rect.x + 45)).toBe(true);
    expect(inside.every((z) => waiting.every((s) => Math.hypot(s.pos.x - z.pos.x, s.pos.y - z.pos.y) > 38))).toBe(true);
    // and for the opening seconds nothing in region 2 is hunting them
    for (let i = 0; i < 30 * 5; i++) w.step(1 / 30);
    const hunting = w.zombies.filter((z) => z.alive && z.pos.x >= d.def.rect.x && waiting.some((s) => z.targetId === s.id));
    expect(hunting.length).toBe(0);
  });
});
