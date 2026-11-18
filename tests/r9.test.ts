import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { gainXp } from '../src/sim/systems/combat';

describe('v4.23 playtest round 9', () => {
  it('a district can not read 0% (or count as cleared) while a zombie is still alive in it (#98)', () => {
    const w = new World({ populate: false });
    for (const h of w.hives) h.alive = false;
    const d = w.districts.get('motel')!;
    const r = d.def.rect;
    d.infestation = 0.2; // kills already took it nearly to zero…
    const z = w.spawnZombie('walker', { x: r.x + r.w / 2, y: r.y + r.h / 2 })!; // …but one is still around
    z.def = { ...z.def, speed: 0 };
    for (let i = 0; i < 30 * 5; i++) w.step(1 / 30);
    expect(d.infestation).toBeGreaterThanOrEqual(1);
    expect(d.cleared).toBe(false);
    w.damageZombie(z, 999, 'bullet');
    for (let i = 0; i < 30 * 5 && !d.cleared; i++) w.step(1 / 30);
    expect(d.infestation).toBe(0);
    expect(d.cleared).toBe(true);
  });

  it('Elite squads gain a fifth soldier (round 10 #118)', () => {
    const w = new World({ populate: false });
    const sq = w.spawnSquad('rifle', { x: 60, y: 108 });
    const hp = sq.hp;
    const share = sq.poolMax / sq.members.length;
    gainXp(w, sq, 80); // Veteran: still four
    expect(sq.members.length).toBe(4);
    const poolBefore = sq.pool;
    gainXp(w, sq, 1000); // Elite
    expect(sq.levelName).toBe('Elite');
    expect(sq.members.length).toBe(5);
    expect(sq.aliveCount).toBe(5);
    expect(sq.pool).toBeGreaterThan(poolBefore);
    expect(sq.pool).toBeGreaterThanOrEqual(hp);
    expect(share).toBeGreaterThan(0);
    // the new soldier fights and dies like the others: a hit of one share drops one soldier
    w.damageSquad(sq, sq.poolMax / 5 + 0.01, 'melee');
    expect(sq.aliveCount).toBe(4);
  });
});
