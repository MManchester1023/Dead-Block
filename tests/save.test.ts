import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { SAVE_VERSION, loadWorld, saveWorld } from '../src/sim/save';
import { CELL } from '../src/config/world';

/** A compact fingerprint of the simulation: what a player would notice if a load went wrong. */
function snapshot(w: World) {
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    time: r(w.time),
    money: r(w.money),
    supplies: r(w.supplies),
    squads: w.squads.filter((s) => s.alive).map((s) => [s.id, s.name, r(s.pos.x), r(s.pos.y), r(s.pool), s.aliveCount, s.kills, s.currentOrder?.type ?? '-']),
    zombies: w.zombies.filter((z) => z.alive).map((z) => [z.id, z.def.id, r(z.pos.x), r(z.pos.y), r(z.hp), z.state]),
    hives: w.hives.filter((h) => h.alive).map((h) => [h.id, h.stage, r(h.hp), r(h.pulseTimer)]),
    structures: w.structures.filter((s) => s.alive).map((s) => [s.id, s.def.id, r(s.hp), s.built]),
    districts: [...w.districts.values()].map((d) => [d.def.id, r(d.infestation), d.locked, d.secured]),
  };
}

describe('save / load (STATUS #16)', () => {
  it('a loaded game is the same game, and plays on exactly as the original would', () => {
    const a = new World({ seed: 7 });
    // give it some history: a squad moving, a sandbag wall going up, a fight
    const sq = a.squads[0];
    a.issueOrder([sq], { type: 'attackMove', pos: { x: 190, y: 110 } });
    const eng = a.squads.find((s) => s.def.id === 'engineer')!;
    a.orderBuild([eng], 'sandbags', { x: Math.floor(eng.pos.x / CELL) + 3, y: Math.floor(eng.pos.y / CELL) });
    for (let i = 0; i < 30 * 45; i++) a.step(1 / 30);

    const data = saveWorld(a);
    expect(data.v).toBe(SAVE_VERSION);
    const b = loadWorld(JSON.parse(JSON.stringify(data)), 7);
    // same state now (positions to the centimetre: the save rounds to the millimetre)…
    // (numbers within 2 cm / 0.02: the save keeps millimetres)
    const close = (x: unknown, y: unknown): boolean =>
      typeof x === 'number' && typeof y === 'number' ? Math.abs(x - y) <= 0.02
      : Array.isArray(x) && Array.isArray(y) ? x.length === y.length && x.every((v, i) => close(v, y[i]))
      : x && y && typeof x === 'object' && typeof y === 'object' ? Object.keys(x).every((k) => close((x as never)[k], (y as never)[k]))
      : x === y;
    expect(close(snapshot(b), snapshot(a))).toBe(true);
    // …and a minute later, step for step. (Entity ids come from one global counter, so the two worlds
    // can't run interleaved in one process: run the original on, then reload the save and run the copy.)
    for (let i = 0; i < 30 * 60; i++) a.step(1 / 30);
    const after = snapshot(a);
    const c = loadWorld(JSON.parse(JSON.stringify(data)), 7);
    for (let i = 0; i < 30 * 60; i++) c.step(1 / 30);
    expect(snapshot(c)).toEqual(after);
  }, 60000);

  it('opened regions stay open (fences down), secured ones stay secured', () => {
    const a = new World({ seed: 3 });
    a.unlockDistrict('gasStrip');
    a.districts.get('motel')!.secured = true;
    const b = loadWorld(saveWorld(a), 3);
    expect(b.districts.get('gasStrip')!.locked).toBe(false);
    expect(b.districts.get('railSiding')!.locked).toBe(true);
    expect(b.districts.get('motel')!.secured).toBe(true);
    // the cut fence no longer blocks the road
    const fence = b.districts.get('gasStrip')!.def.borders![0];
    const cx = Math.floor((fence.x + fence.w / 2) / CELL);
    const cy = Math.floor((fence.y + fence.h / 2) / CELL);
    expect(b.grid.isBlocked(cx, cy)).toBe(a.grid.isBlocked(cx, cy));
  });

  it('refuses a save from another format version', () => {
    const data = saveWorld(new World({ populate: false }));
    expect(() => loadWorld({ ...data, v: SAVE_VERSION + 1 })).toThrow(/version/);
  });
});
