// Round 11 checks in the real game (v4.34): the cargo plane's shadow is cleaned up even when a squad
// grabs the crate the moment it lands (#123), the outpost panel sells the Garrison upgrade (#129), and
// the supplies readout has no cap (#136). Prints what it checked and any page errors.
//   node tools/browser/round11.cjs
const { launch, watchErrors, startGame } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = watchErrors(p);
  await startGame(p);

  // #123: drop a crate right on a squad, so it's picked up as soon as it lands
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    g.speed = 4;
    g.paused = false;
    const s = w.squads[0];
    w.money = 5000;
    w.supplies = 5000;
    w.crates.push({ id: 999001, pos: { ...s.pos }, landsAt: w.time + 8, landed: false, supplies: 45 });
    window.__drop = w.time + 8;
  });
  await p.waitForFunction(() => window.game.world.time > window.__drop + 0.5 && !window.game.world.crates.length, null, { timeout: 60000 });
  const midway = await p.evaluate(() => window.game.renderer.drops.flyovers.size);
  await p.waitForFunction(() => window.game.world.time > window.__drop + 4, null, { timeout: 60000 });
  const after = await p.evaluate(() => window.game.renderer.drops.flyovers.size);
  ok(midway === 1 && after === 0, `plane shadow keeps flying after an early pickup, then is removed (${midway} → ${after})`);

  // #136: no "/150" after the supplies
  const res = await p.evaluate(() => [...document.querySelectorAll('.res')].map((e) => e.textContent).join(' | '));
  ok(!/\/\s*150/.test(res) && /5\d{3}/.test(res), `supplies shown without a cap (${res.replace(/\s+/g, ' ').slice(0, 80)})`);

  // #129: select an outpost, buy its garrison from the panel
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    const op = w.addStructure('outpost', { x: 22, y: 8 }, true);
    window.__op = op.id;
    g.selectStructure(op.id);
  });
  await p.waitForSelector('[data-act="upgrade"]', { timeout: 10000 });
  const panel = await p.evaluate(() => document.querySelector('[data-act="upgrade"]').closest('div,section').textContent.replace(/\s+/g, ' ').trim());
  await p.click('[data-act="upgrade"]');
  await p.waitForTimeout(500);
  const bought = await p.evaluate(() => window.game.world.structures.find((s) => s.id === window.__op).upgraded);
  ok(bought, `outpost panel sells the Garrison and the click buys it (${panel.slice(0, 90)})`);
  await p.screenshot({ path: 'tools/out/round11-outpost.png' });

  console.log(errs.join('\n') || 'no page errors');
  await b.close();
})();
