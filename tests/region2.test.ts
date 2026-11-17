import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { findPath } from '../src/sim/pathfinding';

const inRect = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

describe('tutorial region 2: Gas Station Strip (doc §17, v4.10)', () => {
  it('starts fenced off, empty and quiet', () => {
    const w = new World({ seed: 3 });
    const d = w.districts.get('gasStrip')!;
    expect(d.locked).toBe(true);
    expect(w.zombies.filter((z) => inRect(z.pos, d.def.rect)).length).toBe(0);
    expect(w.hives.some((h) => h.districtId === 'gasStrip')).toBe(false);
    // the border column is solid from top to bottom
    const c = w.grid.cell;
    const bx = Math.round(d.def.border!.x / c);
    for (let y = 0; y < w.map.rows; y++) expect(w.grid.isBlocked(bx, y)).toBe(true);
    w.makeNoise({ x: d.def.rect.x + 30, y: d.def.rect.y + 30 }, 5);
    expect(d.noise).toBe(0);
  });

  it('opens when Roadside Motel is secured: wire cut, dead seeded, hive awake, reachable from HQ', () => {
    const w = new World({ seed: 3 });
    let opened = '';
    let won = false;
    w.events.on('districtUnlocked', (e) => (opened = e.districtId));
    w.events.on('victory', () => (won = true));
    // secure the motel: kill its hive and population, then an outpost
    for (const h of w.hives) h.alive = false;
    for (const z of w.zombies) z.alive = false;
    const motel = w.districts.get('motel')!;
    motel.infestation = 0;
    const r = motel.def.rect;
    const c = w.grid.cell;
    w.addStructure('outpost', { x: Math.round((r.x + 60) / c), y: Math.round((r.y + 100) / c) }, true);
    for (let i = 0; i < 30 * 2 && !opened; i++) w.step(1 / 30);
    expect(motel.secured).toBe(true);
    expect(opened).toBe('gasStrip');

    const d = w.districts.get('gasStrip')!;
    expect(d.locked).toBe(false);
    expect(w.zombies.filter((z) => z.alive && inRect(z.pos, d.def.rect)).length).toBeGreaterThan(20);
    expect(w.hives.filter((h) => h.alive && h.districtId === 'gasStrip').length).toBe(1);
    // the main road now runs from the base gate into region 2
    const g = w.map.baseGate;
    const path = findPath(w.grid, { x: g.x + g.w + 4, y: g.y + g.h / 2 }, { x: d.def.rect.x + 40, y: 108 });
    expect(path).not.toBeNull();
    // the tutorial isn't over until region 2 is secured too
    expect(won).toBe(false);
    expect(w.over).toBeFalsy();
  });
});
