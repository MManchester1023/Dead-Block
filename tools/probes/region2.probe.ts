// Balance bot, region 2 (Gas Station Strip): motel already secured, 4 rifle squads + 1 engineer bound
// along the road vs. charge straight at the hive, 6 seeds each.
import { it } from 'vitest';
import { World } from '../../src/sim/World';
import { CELL } from '../../src/config/world';
const M = (x: number, y: number) => ({ x: x * CELL, y: y * CELL });
it('region 2', () => {
  for (const naive of [false, true]) {
    let wins = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const w = new World({ seed, fixedHives: true });
      for (const h of w.hives) h.alive = false;
      for (const z of w.zombies) z.alive = false;
      w.districts.get('motel')!.infestation = 0;
      w.addStructure('outpost', { x: 48, y: 37 }, true);
      w.step(1 / 30);
      for (const s of [...w.squads]) w.standDown(s);
      const sq = [w.spawnSquad('rifle', M(98, 35)), w.spawnSquad('rifle', M(98, 37)), w.spawnSquad('rifle', M(96, 35)), w.spawnSquad('rifle', M(96, 37)), w.spawnSquad('engineer', M(94, 36))];
      let boom = -1;
      w.events.on('hiveDestroyed', () => (boom = w.time));
      const bounds = naive ? [M(157, 59)] : [M(108, 36), M(116, 36), M(124, 37), M(131, 38), M(133, 44), M(134, 51), M(140, 54), M(148, 55), M(154, 57), M(157, 59)];
      let b = 0, quiet = 0, charged = false;
      for (let i = 0; i < 30 * 900 && boom < 0; i++) {
        w.step(1 / 30);
        const live = w.squads;
        if (!live.length) break;
        const threats = w.zombieHash.query(live[0].pos, 26).filter((z) => z.alive).length;
        quiet = threats === 0 ? quiet + 1 / 30 : 0;
        const idle = live.every((s) => !s.orders.length);
        if (idle && (naive || quiet > 4) && b < bounds.length) { w.issueOrder(live, { type: 'attackMove', pos: bounds[b++] }); quiet = 0; }
        const eng = live.filter((s) => s.def.id === 'engineer');
        if (b >= bounds.length && !charged && eng.length && idle && (naive || quiet > 2)) { w.orderCharge(eng, w.hives.find((h) => h.alive && h.districtId === 'gasStrip')!); charged = true; }
        if (charged && eng.length && !eng[0].orders.length && boom < 0 && quiet > 3) charged = false;
      }
      if (boom > 0) wins++;
      console.log(`${naive ? 'naive' : 'bound'} seed ${seed}: hive ${boom > 0 ? `down @${boom.toFixed(0)}s` : 'alive'}, squads ${w.squads.map((s) => `${s.name}:${s.aliveCount}`).join(' ')} zombies ${w.zombies.length}`);
    }
    console.log(`${naive ? 'NAIVE' : 'BOUNDING'} wins ${wins}/6`);
  }
}, 600000);
