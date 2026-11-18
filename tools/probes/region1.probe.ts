// Balance bot, region 1 (Roadside Motel): the starting force bounds forward (moves only when it's quiet)
// vs. charges straight at the hive, 6 seeds each. Prints per-seed results and a win count.
// (v4.53: hives sit at the map sites here, fixedHives: the bots follow scripted routes to them)
import { it } from 'vitest';
import { World } from '../../src/sim/World';
import { CELL } from '../../src/config/world';

const M = (x: number, y: number) => ({ x: x * CELL, y: y * CELL });

it('region 1', () => {
  for (const naive of [false, true]) {
    let wins = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const w = new World({ seed, fixedHives: true });
      let boom = -1;
      w.events.on('hiveDestroyed', () => (boom = w.time));
      const bounds = naive ? [M(90, 53)] : [M(40, 36), M(48, 36), M(56, 37), M(64, 37), M(72, 37), M(80, 37), M(88, 40), M(88, 47), M(90, 53)];
      let b = 0;
      let quiet = 0;
      let charged = false;
      w.queueProduction('rifle');
      for (let i = 0; i < 30 * 900 && boom < 0; i++) {
        w.step(1 / 30);
        const sq = w.squads;
        if (!sq.length) break;
        const threats = w.zombieHash.query(sq[0].pos, 26).filter((z) => z.alive).length;
        quiet = threats === 0 ? quiet + 1 / 30 : 0;
        const idle = sq.every((s) => !s.orders.length);
        if (idle && (naive || quiet > 4) && b < bounds.length) {
          w.issueOrder(sq, { type: 'attackMove', pos: bounds[b++] });
          quiet = 0;
        }
        const eng = sq.filter((s) => s.def.id === 'engineer');
        if (b >= bounds.length && !charged && eng.length && idle && (naive || quiet > 2)) {
          w.orderCharge(eng, w.hives[0]);
          charged = true;
        }
        if (!eng.length && !w.structures.find((s) => s.def.id === 'barracks')!.queue.length) w.queueProduction('engineer');
      }
      if (boom > 0) wins++;
      console.log(`${naive ? 'naive' : 'bound'} seed ${seed}: hive ${boom > 0 ? `down @${boom.toFixed(0)}s` : 'alive'}, squads ${w.squads.map((s) => `${s.name}:${s.aliveCount}`).join(' ')}, $${w.money.toFixed(0)} sup ${w.supplies.toFixed(0)}`);
    }
    console.log(`${naive ? 'NAIVE' : 'BOUNDING'} wins ${wins}/6`);
  }
}, 240000);
