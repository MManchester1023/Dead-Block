// Roaming packs vs. an outpost (STATUS #11): a motel outpost, bare or with an MG nest + sandbags facing
// Rail Siding, gets 4 packs of 6 sent straight at it, one every 225 s, with horde pulses switched off.
// Prints whether it held, 4 seeds per setup. (v4.29: bare 0/4, MG + sandbags 4/4, both with the then built-in garrison;
// v4.34, garrison now an upgrade: bare 0/4, MG + sandbags 1/4, MG + sandbags + garrison see tools/README.md.)
import { it } from 'vitest';
import { World } from '../../src/sim/World';
import { BALANCE } from '../../src/config/balance';
import { CELL } from '../../src/config/world';
import { sendPack } from '../../src/sim/systems/roaming';

const inRect = (r: { x: number; y: number; w: number; h: number }, p: { x: number; y: number }) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

for (const fort of ['none', 'mg+bags', 'mg+bags+garrison'])
  it(`roaming vs outpost: ${fort}`, () => {
    let held = 0;
    const N = 4;
    const bias = BALANCE.roaming.outpostBias;
    for (let seed = 1; seed <= N; seed++) {
      const w = new World({ seed, fixedHives: true });
      const d = w.districts.get('motel')!;
      for (const z of w.zombies) if (inRect(d.def.rect, z.pos)) z.alive = false;
      for (const h of w.hives) if (h.districtId === 'motel') h.alive = false;
      const r = d.def.rect;
      const c = { x: Math.floor((r.x + r.w / 2) / CELL), y: Math.floor((r.y + r.h * 0.8) / CELL) };
      const op = w.addStructure('outpost', c, true);
      if (fort.endsWith('garrison')) op.upgraded = true; // round 11 #129: the garrison is now an upgrade
      if (fort !== 'none') {
        w.addStructure('mgNest', { x: c.x, y: c.y + 3 }, true, false, Math.PI / 2); // facing south (+y)
        for (const dx of [-3, 0, 3]) w.addStructure('sandbags', { x: c.x + dx, y: c.y + 6 }, true);
      }
      for (let i = 0; i < 10; i++) w.step(1 / 30);
      w.unlockDistrict('railSiding');
      for (const x of w.districts.values()) x.roamTimer = Infinity;
      for (const x of w.hives) x.pulseTimer = 1e9; // roaming only
      (BALANCE.roaming as { outpostBias: number }).outpostBias = 1;
      for (let k = 0; k < 4; k++) {
        sendPack(w, w.districts.get('railSiding')!, [6, 6]);
        for (let i = 0; i < 30 * 225; i++) w.step(1 / 30);
      }
      (BALANCE.roaming as { outpostBias: number }).outpostBias = bias;
      if (op.alive) held++;
      console.log(`${fort} seed ${seed}: outpost ${op.alive ? Math.round(op.hp) + ' hp' : 'LOST'}, zombies in motel ${w.zombies.filter((z) => z.alive && inRect(d.def.rect, z.pos)).length}`);
    }
    console.log(`${fort}: held ${held}/${N}`);
  }, 600000);
