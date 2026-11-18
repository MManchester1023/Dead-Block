import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { ZOMBIES } from '../src/config/units';

const step = (w: World, sec: number) => {
  for (let i = 0; i < Math.round(sec * 30); i++) w.step(1 / 30);
};

describe('round 13 playtest (v4.43)', () => {
  it('Walkers attack every 2 s, Runners every 1 s, same damage per hit (#153)', () => {
    expect(ZOMBIES.walker.attackCooldown).toBe(2);
    expect(ZOMBIES.runner.attackCooldown).toBe(1);
    expect(ZOMBIES.walker.damage).toBe(7);
    expect(ZOMBIES.runner.damage).toBe(5);
  });

  it('the power station starting up draws the dead from far off (#156)', () => {
    const w = new World({ populate: false });
    w.unlockDistrict('railSiding');
    for (const z of w.zombies) z.alive = false;
    w.districts.get('railSiding')!.quietUntil = 0; // past the just-opened quiet spell (v4.15 #77)
    const st = w.structures.find((s) => s.def.id === 'powerStation')!;
    const z = w.spawnZombie('walker', { x: st.pos.x - 70, y: st.pos.y + 20 })!; // well outside the 30 m work zone
    const eng = w.spawnSquad('engineer', { x: st.pos.x + 12, y: st.pos.y + 12 });
    st.buildProgress = st.def.buildTime - 0.5;
    expect(w.orderResume([eng], st)).toBeNull();
    let heard = false;
    for (let i = 0; i < 30 * 10 && !heard; i++) {
      w.step(1 / 30);
      heard = st.built && z.state === 'investigate';
    }
    expect(st.built).toBe(true);
    expect(heard).toBe(true);
  });

  it('a soldier walled off from their spot rejoins the squad instead of standing at the wall (#154)', () => {
    const w = new World({ populate: false });
    const sq = w.spawnSquad('rifle', { x: 60, y: 30 });
    step(w, 0.5);
    // put one soldier on the far side of a building from the squad
    const b = w.map.buildings.find((x) => x.kind === 'houses' && w.districtAt({ x: x.rect.x, y: x.rect.y })?.def.id === 'motel')!;
    const m = sq.members[1];
    m.pos.x = b.rect.x + b.rect.w / 2;
    m.pos.y = b.rect.y - 2;
    sq.pos.x = b.rect.x + b.rect.w / 2;
    sq.pos.y = b.rect.y + b.rect.h + 4;
    step(w, 2);
    expect(Math.hypot(m.pos.x - sq.pos.x, m.pos.y - sq.pos.y)).toBeLessThan(6);
    expect(w.grid.isBlockedXY(m.pos.x, m.pos.y)).toBe(false);
  });
});
