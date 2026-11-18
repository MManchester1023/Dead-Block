import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { BALANCE } from '../src/config/balance';

const step = (w: World, sec: number) => {
  for (let i = 0; i < Math.round(sec * 30); i++) w.step(1 / 30);
};

/** A car with free ground on its south side, away from the base. */
function openCar(w: World) {
  return w.map.props.find((p) => p.kind === 'car' && w.districtAt(p.pos)?.def.id === 'motel' && !w.grid.isBlockedXY(p.pos.x, p.pos.y + 3.5) && !w.grid.isBlockedXY(p.pos.x - 3, p.pos.y + 6) && !w.grid.isBlockedXY(p.pos.x + 3, p.pos.y + 6))!;
}

describe('crouching and cover room (round 11 #125, #126; v4.37)', () => {
  it('a crouched squad in the open gets half the cover protection and moves slower; G again stands it up', () => {
    const w = new World({ populate: false });
    const sq = w.spawnSquad('rifle', { x: 60, y: 30 });
    step(w, 0.2);
    expect(sq.inCover).toBe(0);
    expect(w.toggleCrouch([sq])).toBe(true);
    step(w, 0.1);
    expect(sq.openCover).toBe(true);
    expect(sq.inCover).toBeCloseTo(BALANCE.combat.openCoverReduction);
    // damage taken is reduced by that much
    const before = sq.pool;
    w.damageSquad(sq, 10, 'melee');
    expect(before - sq.pool).toBeCloseTo(10 * (1 - BALANCE.combat.openCoverReduction));
    // slower on the move
    const x0 = sq.pos.x;
    w.issueOrder([sq], { type: 'move', pos: { x: 120, y: 30 } });
    step(w, 2);
    const crouchedDist = sq.pos.x - x0;
    w.toggleCrouch([sq]);
    const x1 = sq.pos.x;
    step(w, 2);
    const standingDist = sq.pos.x - x1;
    expect(crouchedDist / standingDist).toBeCloseTo(BALANCE.combat.crouchSpeed, 1);
    expect(sq.crouched).toBe(false);
  });

  it('a car shelters two squads; a third sent there crouches in the open beside it until its next order', () => {
    const w = new World({ populate: false });
    const car = openCar(w);
    const squads = [0, 1, 2].map((i) => w.spawnSquad('rifle', { x: car.pos.x - 6 + i * 6, y: car.pos.y + 14 }));
    w.issueOrder([squads[0]], { type: 'cover', pos: w.grid.nearestFree({ x: car.pos.x - 1.4, y: car.pos.y + 3 }), targetId: car.id });
    w.issueOrder([squads[1]], { type: 'cover', pos: w.grid.nearestFree({ x: car.pos.x + 1.4, y: car.pos.y + 3 }), targetId: car.id });
    step(w, 4);
    w.issueOrder([squads[2]], { type: 'cover', pos: w.grid.nearestFree({ x: car.pos.x, y: car.pos.y + 4 }), targetId: car.id });
    step(w, 5);
    expect(squads[0].coverPropId).toBe(car.id);
    expect(squads[1].coverPropId).toBe(car.id);
    expect(squads[2].coverPropId).not.toBe(car.id);
    expect(squads[2].openCover).toBe(true);
    expect(squads[2].inCover).toBeCloseTo(BALANCE.combat.openCoverReduction);
    // a new order and it stands up and walks normally
    w.issueOrder([squads[2]], { type: 'move', pos: { x: car.pos.x, y: car.pos.y + 30 } });
    step(w, 0.5);
    expect(squads[2].autoCrouch).toBe(false);
    expect(squads[2].openCover).toBe(false);
  });
});
