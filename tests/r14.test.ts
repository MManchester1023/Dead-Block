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
});
