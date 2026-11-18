import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { BALANCE } from '../src/config/balance';
import { CELL } from '../src/config/world';
import { neighbours, sendPack } from '../src/sim/systems/roaming';
import { incomeRates } from '../src/sim/systems/economy';
import { Structure } from '../src/sim/entities';

const inRect = (r: { x: number; y: number; w: number; h: number }, p: { x: number; y: number }) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

/** Secure the motel with an outpost in its middle (cells), the way engineers would. */
function secureMotel(w: World): Structure {
  const d = w.districts.get('motel')!;
  for (const z of w.zombies) if (inRect(d.def.rect, z.pos)) z.alive = false;
  for (const h of w.hives) if (h.districtId === 'motel') h.alive = false;
  const r = d.def.rect;
  const op = w.addStructure('outpost', { x: Math.floor((r.x + r.w / 2) / CELL), y: Math.floor((r.y + r.h / 2) / CELL) }, true);
  for (let i = 0; i < 10 && !d.secured; i++) w.step(1 / 30);
  expect(d.secured).toBe(true);
  return op;
}

describe('roaming packs (STATUS #11)', () => {
  it('the three regions border each other; the base is left out of roaming', () => {
    const w = new World({ populate: false });
    const ids = (id: string) => neighbours(w, w.districts.get(id)!).map((d) => d.def.id);
    expect(ids('motel')).toContain('gasStrip');
    expect(ids('gasStrip')).toContain('motel');
    expect(ids('railSiding')).toEqual(expect.arrayContaining(['motel', 'gasStrip']));
  });

  it('the tutorial region never sends packs; region 2 does, after its first interval', () => {
    const w = new World({ seed: 3 });
    let packs: string[] = [];
    w.events.on('roamers', (e) => packs.push(e.from));
    for (let i = 0; i < 30 * 600; i++) w.step(1 / 30);
    expect(packs).toEqual([]); // motel alone (tutorial tier, and nowhere to go)
    secureMotel(w);
    w.unlockDistrict('gasStrip');
    packs = [];
    const T = w.tier('gasStrip').roam!;
    for (let i = 0; i < 30 * (T.everySec[1] + 20) && !packs.length; i++) w.step(1 / 30);
    expect(packs).toContain('gasStrip');
  }, 120000);

  it('a pack sent at an outpost walks over and tears into it', () => {
    const w = new World({ seed: 5 });
    const op = secureMotel(w);
    w.unlockDistrict('gasStrip');
    w.districts.get('gasStrip')!.quietUntil = Infinity; // no distractions from noise
    const prev = BALANCE.roaming.outpostBias;
    (BALANCE.roaming as { outpostBias: number }).outpostBias = 1;
    let sent = 0;
    try {
      sent = sendPack(w, w.districts.get('gasStrip')!, [6, 6]);
    } finally {
      (BALANCE.roaming as { outpostBias: number }).outpostBias = prev;
    }
    expect(sent).toBe(6);
    const hp0 = op.hp;
    for (let i = 0; i < 30 * 150 && op.hp >= hp0; i++) w.step(1 / 30);
    expect(op.hp).toBeLessThan(hp0);
  }, 120000);

  it('dead loose in a secured district raise its infestation and cut its income, then it recovers', () => {
    const w = new World({ populate: false });
    secureMotel(w); // (this opens region 2: keep its dead at home for this test)
    for (const h of w.hives) h.alive = false;
    for (const z of w.zombies) z.alive = false;
    for (const x of w.districts.values()) x.roamTimer = Infinity;
    const d = w.districts.get('motel')!;
    const full = incomeRates(w).money;
    // three walkers that won't move, inside the district
    const r = d.def.rect;
    const zs = [0, 1, 2].map((i) => w.spawnZombie('walker', { x: r.x + 20 + i * 3, y: r.y + 20 })!);
    for (const z of zs) z.def = { ...z.def, speed: 0, sight: 0 };
    let warned = 0;
    w.events.on('districtContested', () => warned++);
    for (let i = 0; i < 30 * 120; i++) w.step(1 / 30);
    expect(warned).toBe(1);
    expect(d.contested).toBe(true);
    expect(d.infestation).toBeGreaterThan(5);
    expect(incomeRates(w).money).toBeLessThan(full);
    for (const z of zs) z.alive = false;
    for (let i = 0; i < 30 * 60 * 6; i++) w.step(1 / 30);
    expect(d.infestation).toBe(0);
    expect(d.contested).toBe(false);
    expect(incomeRates(w).money).toBe(full);
  }, 120000);
});
