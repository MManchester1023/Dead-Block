// Balance bot, region 3 (Rail Siding): regions 1-2 secured, 6 rifle squads + 2 engineers take both hives
// one after the other (bounding vs. straight charge), 6 seeds each.
import { it } from 'vitest';
import { World } from '../../src/sim/World';
import { CELL } from '../../src/config/world';
const M = (x: number, y: number) => ({ x: x * CELL, y: y * CELL });
const inR = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;
it('region 3', () => {
  for (const naive of [false, true]) {
    let wins = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const w = new World({ seed, fixedHives: true });
      for (const id of ['motel', 'gasStrip']) {
        const d = w.districts.get(id)!;
        for (const h of w.hives) if (h.districtId === id) h.alive = false;
        for (const z of w.zombies) if (inR(z.pos, d.def.rect)) z.alive = false;
        d.infestation = 0;
        const s = w.grid.nearestFree({ x: d.def.rect.x + 90, y: d.def.rect.y + 90 });
        w.addStructure('outpost', { x: Math.round(s.x / CELL) - 1, y: Math.round(s.y / CELL) - 1 }, true);
        for (let i = 0; i < 5; i++) w.step(1 / 30);
      }
      for (const s of [...w.squads]) w.standDown(s);
      const sq = [0, 1, 2, 3, 4, 5].map((i) => w.spawnSquad('rifle', M(52 + (i % 3) * 3, 62 + Math.floor(i / 3) * 3)));
      sq.push(w.spawnSquad('engineer', M(58, 58)), w.spawnSquad('engineer', M(61, 58)));
      let kills = 0;
      w.events.on('hiveDestroyed', () => kills++);
      const routes = [
        naive ? [M(68, 140)] : [M(57, 74), M(57, 84), M(57, 95), M(57, 105), M(57, 116), M(57, 126), M(60, 134), M(66, 139)],
        naive ? [M(152, 139)] : [M(70, 98), M(86, 98), M(104, 98), M(120, 98), M(133, 106), M(134, 116), M(134, 126), M(140, 132), M(148, 136)],
      ];
      let leg = 0, b = 0, quiet = 0, charged = false;
      for (let i = 0; i < 30 * 1500 && kills < 2; i++) {
        w.step(1 / 30);
        const live = w.squads;
        if (!live.length) break;
        const threats = w.zombieHash.query(live[0].pos, 26).filter((z) => z.alive).length;
        quiet = threats === 0 ? quiet + 1 / 30 : 0;
        const idle = live.every((s) => !s.orders.length);
        const route = routes[leg];
        if (idle && (naive || quiet > 4) && b < route.length) { w.issueOrder(live, { type: 'attackMove', pos: route[b++] }); quiet = 0; }
        const eng = live.filter((s) => s.def.id === 'engineer');
        const hive = w.hives.filter((h) => h.alive && h.districtId === 'railSiding').sort((a, c) => Math.hypot(a.pos.x - live[0].pos.x, a.pos.y - live[0].pos.y) - Math.hypot(c.pos.x - live[0].pos.x, c.pos.y - live[0].pos.y))[0];
        if (b >= route.length && !charged && eng.length && idle && (naive || quiet > 2) && hive) { w.orderCharge(eng, hive); charged = true; }
        if (charged && kills > leg) { leg = Math.min(1, kills); b = 0; charged = false; }
        if (charged && eng.length && !eng.some((e) => e.orders.length) && quiet > 3) charged = false;
      }
      if (kills >= 2) wins++;
      console.log(`${naive ? 'naive' : 'bound'} seed ${seed}: hives killed ${kills}/2 @${w.time.toFixed(0)}s, squads ${w.squads.map((s) => `${s.name}:${s.aliveCount}`).join(' ')} zombies ${w.zombies.length}`);
    }
    console.log(`${naive ? 'NAIVE' : 'BOUNDING'} wins ${wins}/6`);
  }
}, 900000);
