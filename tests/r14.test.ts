import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { BALANCE } from '../src/config/balance';
import { ABILITIES, ZOMBIES } from '../src/config/units';

describe('round 14 playtest (v4.51)', () => {
  it('Runners 9.5 m/s, demo charges plant in 2 s (#162, #171)', () => {
    expect(ZOMBIES.runner.speed).toBe(9.5);
    expect(ABILITIES.demoCharge.plantTime).toBe(2);
  });

  it('a hive never spawns faster than every 5 s (#172)', () => {
    const w = new World({ seed: 4 });
    for (const z of w.zombies) z.alive = false;
    const h = w.hives[0];
    h.stage = 4; // the fastest stage
    h.spawnTimer = 0;
    w.step(1 / 30);
    expect(h.spawnTimer).toBeGreaterThanOrEqual(BALANCE.hive.minSpawnIntervalSec - 1 / 30 - 1e-9);
  });

  it('zombies chasing a squad behind the base wall go round to the gate instead of piling on the wall (#167)', () => {
    // the old code left 19 of these 20 pressed against the wall after 30 s (the go-around only started 8 m out)
    const w = new World({ seed: 5 });
    for (const z of w.zombies) z.alive = false;
    for (const h of w.hives) (h.spawnTimer = 1e9), (h.pulseTimer = 1e9);
    const base = w.map.baseRect;
    const sq = w.squads.find((s) => s.def.id === 'rifle')!;
    sq.pos.x = base.x + base.w / 2;
    sq.pos.y = base.y + 6;
    for (const m of sq.members) (m.pos.x = sq.pos.x), (m.pos.y = sq.pos.y);
    w.issueOrder([sq], { type: 'hold', pos: sq.pos });
    sq.def = { ...sq.def, weapon: { ...sq.def.weapon, damage: 0 } }; // don't shoot them
    const crowd = [];
    for (let i = 0; i < 20; i++) {
      const z = w.spawnZombie('walker', { x: base.x + base.w / 2 - 10 + i, y: base.y - 6 })!;
      z.targetId = sq.id;
      z.state = 'chase';
      z.aggro = 60;
      crowd.push(z);
    }
    for (let i = 0; i < 30 * 30; i++) w.step(1 / 30);
    const piled = crowd.filter((z) => z.alive && z.pos.y < base.y).length;
    expect(piled).toBeLessThanOrEqual(3);
  });

  it('patrol: the squad loops from where it stood through the points, again and again (#174)', () => {
    const w = new World({ populate: false });
    const sq = w.spawnSquad('rifle', { x: 60, y: 108 });
    const start = { ...sq.pos };
    w.orderPatrol([sq], { x: 60, y: 140 });
    w.orderPatrol([sq], { x: 90, y: 140 }, true);
    expect(sq.currentOrder?.type).toBe('patrol');
    expect(sq.currentOrder?.route?.length).toBe(3);
    let nearStart = 0;
    let wasAway = false;
    for (let i = 0; i < 30 * 90; i++) {
      w.step(1 / 30);
      const d = Math.hypot(sq.pos.x - start.x, sq.pos.y - start.y);
      if (d > 20) wasAway = true;
      if (wasAway && d < 4) {
        nearStart++;
        wasAway = false;
      }
    }
    expect(nearStart).toBeGreaterThanOrEqual(2); // back at the start at least twice: it loops
    expect(sq.currentOrder?.type).toBe('patrol'); // and keeps going
  });

  it('a new order ends the patrol; Shift+right-click waypoints stop at the last one (#174, #175)', () => {
    const w = new World({ populate: false });
    const sq = w.spawnSquad('rifle', { x: 60, y: 108 });
    w.orderPatrol([sq], { x: 60, y: 140 });
    w.issueOrder([sq], { type: 'move', pos: { x: 70, y: 108 } });
    w.issueOrder([sq], { type: 'move', pos: { x: 70, y: 125 } }, true);
    expect(sq.orders.map((o) => o.type)).toEqual(['move', 'move']);
    for (let i = 0; i < 30 * 20; i++) w.step(1 / 30);
    expect(sq.orders.length).toBe(0);
    expect(Math.hypot(sq.pos.x - 70, sq.pos.y - 125)).toBeLessThan(4);
  });

  it('hives go to random open spots each game, away from the fence and base, apart, eastern one last (#163)', () => {
    const spots = new Set<string>();
    for (const seed of [1, 2, 3, 4]) {
      const w = new World({ seed });
      w.unlockDistrict('gasStrip');
      w.unlockDistrict('railSiding');
      const rail = w.hives.filter((h) => h.districtId === 'railSiding');
      expect(rail.length).toBe(2);
      expect(rail[0].pos.x).toBeLessThan(rail[1].pos.x);
      expect(rail.map((h) => h.stage)).toEqual([1, 2]);
      const d = w.districts.get('railSiding')!.def;
      expect(Math.hypot(rail[0].pos.x - rail[1].pos.x, rail[0].pos.y - rail[1].pos.y)).toBeGreaterThan(Math.min(d.rect.w, d.rect.h) * 0.4 - 1);
      for (const h of w.hives) {
        const r = w.districts.get(h.districtId)!.def.rect;
        expect(h.pos.x > r.x && h.pos.x < r.x + r.w && h.pos.y > r.y && h.pos.y < r.y + r.h).toBe(true);
        spots.add(`${h.districtId}:${Math.round(h.pos.x)},${Math.round(h.pos.y)}`);
      }
    }
    expect(spots.size).toBeGreaterThan(8); // different places in different games
  });
});
