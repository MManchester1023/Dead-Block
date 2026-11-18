// "Did the simulation change?" Plays two scripted 5-minute games (all regions open, a build, an
// attack-move, a search) and fingerprints the complete game state (the save format) at 1, 3 and 5 min.
// Run it before and after a change that should not alter behaviour (a refactor, an optimisation):
//   TAG=before npm run probe -- simhash      … make the change …      TAG=after npm run probe -- simhash
// then compare tools/out/simhash-before.txt and -after.txt: identical files = identical behaviour.
import { it } from 'vitest';
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { World } from '../../src/sim/World';
import { saveWorld } from '../../src/sim/save';
import { CELL } from '../../src/config/world';

it('simulation fingerprint', () => {
  const lines: string[] = [];
  const t0 = performance.now();
  for (const seed of [3, 11]) {
    const w = new World({ seed, fixedHives: true });
    w.unlockDistrict('gasStrip');
    w.unlockDistrict('railSiding');
    const eng = w.squads.find((s) => s.def.id === 'engineer')!;
    w.orderBuild([eng], 'sandbags', { x: Math.floor(eng.pos.x / CELL) + 3, y: Math.floor(eng.pos.y / CELL) });
    w.issueOrder([w.squads[0]], { type: 'attackMove', pos: { x: 200, y: 110 } });
    const b = w.map.buildings.find((x) => w.districtAt({ x: x.rect.x, y: x.rect.y })?.def.id === 'motel')!;
    w.orderSearch([w.squads[1]], b);
    for (const t of [60, 180, 300]) {
      while (w.time < t) w.step(1 / 30);
      const s = saveWorld(w);
      s.savedAt = 0;
      lines.push(`seed ${seed} t ${t}: ${createHash('sha1').update(JSON.stringify(s)).digest('hex')} money ${Math.round(w.money)} zombies ${w.zombies.length}`);
    }
  }
  mkdirSync('tools/out', { recursive: true });
  writeFileSync(`tools/out/simhash-${process.env.TAG ?? 'latest'}.txt`, lines.join('\n') + '\n');
  console.log(lines.join('\n') + `\n(${Math.round(performance.now() - t0)} ms)`);
}, 300000);
