import { describe, expect, it } from 'vitest';
import starter from '../src/data/maps/starter.json';
import { buildMap, type MapData } from '../src/sim/map';

/**
 * Map data checks (v4.45): the map lives in src/data/maps/*.json now, edited in dev-map.html. These
 * catch the mistakes an edit can make: things off the map, buildings on top of each other, districts
 * pointing at districts that don't exist, hives outside their district.
 */
const data = starter as unknown as MapData;
const inside = (r: { x: number; y: number; w: number; h: number }) => r.x >= 0 && r.y >= 0 && r.x + r.w <= data.cols && r.y + r.h <= data.rows && r.w > 0 && r.h > 0;
const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('starter map data', () => {
  it('everything is on the map', () => {
    for (const b of data.buildings) expect(inside(b.rect), JSON.stringify(b)).toBe(true);
    for (const d of data.districts) expect(inside(d.rect), d.id).toBe(true);
    for (const g of data.ground) {
      const r = 'paint' in g ? g.rect : 'road' in g ? g.road : g.rail;
      expect(inside(r), JSON.stringify(g)).toBe(true);
    }
    expect(inside(data.base.rect)).toBe(true);
  });

  it('no two buildings overlap', () => {
    const B = data.buildings;
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) expect(overlap(B[i].rect, B[j].rect), `${JSON.stringify(B[i].rect)} / ${JSON.stringify(B[j].rect)}`).toBe(false);
  });

  it('districts: unique ids, unlock chains point at real districts, hives inside their district', () => {
    const ids = new Set(data.districts.map((d) => d.id));
    expect(ids.size).toBe(data.districts.length);
    expect(ids.has('base')).toBe(true);
    for (const d of data.districts) {
      if (d.unlockAfter) expect(ids.has(d.unlockAfter), d.id).toBe(true);
      for (const h of d.hiveSites) expect(h.x >= d.rect.x && h.y >= d.rect.y && h.x < d.rect.x + d.rect.w && h.y < d.rect.y + d.rect.h, `${d.id} hive`).toBe(true);
    }
  });

  it('every car and pump in the file makes it onto the map (none sits on a building or another car)', () => {
    const m = buildMap(data);
    expect(m.props.length).toBe(data.props.length);
  });
});
