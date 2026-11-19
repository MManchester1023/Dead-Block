import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { BALANCE, DIFFICULTY } from '../src/config/balance';
import { STRUCTURES } from '../src/config/units';
import { knobs } from '../src/config/tuning';
import { currentMapData } from '../src/sim/map';
import { unlockDistrict } from '../src/sim/rules/campaign';

describe('round 21 quick changes (v4.95)', () => {
  it("region 2's hive starts at stage 1 (#249)", () => {
    const w = new World({ seed: 4 });
    unlockDistrict(w, 'gasStrip');
    const hives = w.hives.filter((h) => h.alive && h.districtId === 'gasStrip');
    expect(hives.length).toBeGreaterThan(0);
    expect(hives.every((h) => h.stage === 1)).toBe(true);
  });

  it('the numbers: noise cooldown 60 s, hive stages 15 / 10.5 / 12 min, "Heavy MG Nest" (#250, #255, #253)', () => {
    expect(BALANCE.noise.pulseCooldownSec).toBe(60);
    expect([...BALANCE.hive.stageDurationSec]).toEqual([900, 630, 720]);
    expect(STRUCTURES.mgNest.name).toBe('Heavy MG Nest');
  });

  it('no horde waves on a timer, only when the noise meter fills (#256)', () => {
    const w = new World({ seed: 4, fixedHives: true });
    for (const z of w.zombies) z.alive = false;
    for (const h of w.hives) h.spawnTimer = 1e9;
    const waves: string[] = [];
    w.events.on('hordePulse', (e) => waves.push(e.districtId));
    // well past the old first wave (7–10 min) with a quiet district
    for (const d of w.districts.values()) d.noise = 0;
    for (let i = 0; i < 30 * 60 * 12; i++) {
      for (const d of w.districts.values()) d.noise = 0;
      w.step(1 / 30);
    }
    expect(waves).toEqual([]);
    // the meter fills: a wave
    const h = w.hives.find((x) => x.alive)!;
    w.districts.get(h.districtId)!.noise = BALANCE.noise.pulseThreshold;
    w.step(1 / 30);
    expect(waves).toEqual([h.districtId]);
    // and the timer settings are gone from the tuning page
    const paths = knobs(currentMapData()).map((k) => k.path);
    expect(paths.some((p) => /pulseIntervalSec|firstPulseDelaySec/.test(p))).toBe(false);
    expect(DIFFICULTY.every((t) => !('pulseIntervalSec' in t))).toBe(true);
  });
});
