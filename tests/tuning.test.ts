import { afterEach, describe, expect, it } from 'vitest';
import { applyTuning, getKnob, knobs } from '../src/config/tuning';
import { currentMapData } from '../src/sim/map';
import { World } from '../src/sim/World';

const map = currentMapData();
const all = knobs(map);
const saved = new Map(all.map((k) => [k.path, getKnob(k.path, map)!]));
afterEach(() => {
  // back to the defaults for the other tests
  const t: Record<string, unknown> = {};
  for (const [p, v] of saved) t[p] = v;
  applyTuning(t, map);
});

describe('difficulty tuning (round 15 #181, v4.68)', () => {
  it('every knob points at a real number (or list of numbers)', () => {
    expect(all.length).toBeGreaterThan(60);
    for (const k of all) {
      const v = getKnob(k.path, map);
      expect(v, k.path).toBeDefined();
      for (const n of Array.isArray(v) ? v : [v]) expect(Number.isFinite(n), k.path).toBe(true);
      if (k.len) expect(Array.isArray(v) ? v.length : k.len, k.path).toBe(k.len);
    }
  });

  it('covers what the owner asked for: hive starting level, ambient zombies, spawn pools', () => {
    const paths = all.map((k) => k.path);
    expect(paths).toContain('region.motel.hiveStage');
    expect(paths).toContain('region.motel.density');
    expect(paths).toContain('tier.0.normalPool');
    expect(paths).toContain('tier.2.mediumPool');
  });

  it('a tuned game uses the new numbers', () => {
    const before = new World({ seed: 7, fixedHives: true });
    const nBefore = before.zombies.filter((z) => z.alive).length;
    const bad = applyTuning({ 'region.motel.hiveStage': 3, 'HORDE.count': 4, 'zombie.runner.speed': 5, 'BALANCE.economy.startMoney': 999 }, map);
    expect(bad).toEqual([]);
    const w = new World({ seed: 7, fixedHives: true });
    const motelHive = w.hives.find((h) => h.districtId === 'motel')!;
    expect(motelHive.stage).toBe(3);
    expect(w.money).toBe(999);
    expect(w.zombies.filter((z) => z.alive).length).toBeGreaterThan(nBefore);
  });

  it('skips unknown settings, non-numbers and wrong-length lists', () => {
    const bad = applyTuning({ 'BALANCE.tickRate': 60, 'HORDE.count': 'lots', 'tier.0.normalPool': [1, 2], 'nope.x': 1 }, map);
    expect(bad).toHaveLength(4);
    expect(getKnob('HORDE.count', map)).toBe(saved.get('HORDE.count'));
    expect(getKnob('tier.0.normalPool', map)).toEqual(saved.get('tier.0.normalPool'));
  });
});
