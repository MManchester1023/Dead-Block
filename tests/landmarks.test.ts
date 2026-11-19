import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { BALANCE } from '../src/config/balance';

/** Region 2 open and empty, hives asleep, the hospital's building, and a rifle squad at its door. */
function atHospital() {
  const w = new World({ seed: 9, fixedHives: true });
  w.unlockDistrict('gasStrip');
  for (const z of w.zombies) z.alive = false;
  for (const h of w.hives) (h.spawnTimer = 1e9), (h.pulseTimer = 1e9);
  const b = w.map.buildings.find((x) => x.landmark === 'hospital')!;
  const sq = w.squads.find((s) => s.def.id === 'rifle')!;
  const door = w.grid.nearestFree({ x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h + 2 });
  sq.pos.x = door.x;
  sq.pos.y = door.y;
  for (const m of sq.members) (m.pos.x = door.x), (m.pos.y = door.y);
  return { w, b, sq };
}

describe('significant buildings: the hospital and the Med Bay (STATUS #50, v4.72)', () => {
  it('the hospital is in the Gas Station Strip and never holds a nest', () => {
    const { w, b } = atHospital();
    expect(b).toBeDefined();
    expect(w.districtAt({ x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h / 2 })?.def.id).toBe('gasStrip');
    expect(w.buildingState.get(b.id)!.nest).toBe(0);
  });

  it('the Med Bay is in the base from the start, run down, and does nothing yet', () => {
    const { w } = atHospital();
    const bay = w.structures.find((s) => s.def.id === 'medBay')!;
    expect(bay.built).toBe(false);
    expect(w.districtAt(bay.pos)?.def.id).toBe('base');
  });

  it('searching it takes longer, always pays out, unlocks the Med Bay repair and says so once', () => {
    const { w, b, sq } = atHospital();
    const m0 = w.money, s0 = w.supplies;
    const looted: { first: boolean }[] = [];
    w.events.on('landmarkLooted', (e) => looted.push(e));
    expect(w.orderSearch([sq], b)).toBeNull();
    for (let i = 0; i < 30 * (BALANCE.search.timeSec + 3); i++) w.step(1 / 30);
    expect(w.buildingState.get(b.id)!.searched).toBe(false); // an ordinary house would be done by now
    for (let i = 0; i < 30 * 20 && !w.buildingState.get(b.id)!.searched; i++) w.step(1 / 30);
    expect(w.buildingState.get(b.id)!.searched).toBe(true);
    const L = BALANCE.landmarks.hospital;
    expect(w.money - m0).toBeGreaterThanOrEqual(L.money[0]);
    expect(w.supplies - s0).toBeGreaterThanOrEqual(L.supplies[0]);
    expect(w.unlocked.has('medBay')).toBe(true);
    expect(looted).toHaveLength(1);
    expect(looted[0].first).toBe(true);
  });

  it('a repaired Med Bay that gets wrecked is run down again, not gone', () => {
    const { w } = atHospital();
    const bay = w.structures.find((s) => s.def.id === 'medBay')!;
    bay.built = true;
    bay.hp = bay.def.hp;
    w.damageStructure(bay, 1e6);
    expect(bay.alive).toBe(true);
    expect(bay.built).toBe(false);
  });

  it('the Vehicle Bay is locked until the power comes on, then engineers can build it in the base', () => {
    const { w } = atHospital();
    const b = w.map.baseCells;
    expect(w.canPlace('vehicleBay', { x: b.x + 15, y: b.y + 10 })).toBe('Not unlocked yet');
    w.unlocked.add('vehicleBay');
    w.money = 999;
    w.supplies = 999;
    let spot: { x: number; y: number } | null = null;
    for (let y = b.y; y < b.y + b.h && !spot; y++) for (let x = b.x; x < b.x + b.w && !spot; x++) if (!w.canPlace('vehicleBay', { x, y })) spot = { x, y };
    expect(spot, 'room for a Vehicle Bay in the base').not.toBeNull();
  });
});
