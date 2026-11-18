import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';

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
});
