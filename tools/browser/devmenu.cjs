// STATUS #59 (v4.81): the dev menu in the real game, through the keyboard and mouse: ` opens it, pick Runners ×10
// and click the map (they appear there, hunting), Shift+click keeps placing, a stage 2 hive by click, clear all
// zombies, +$1000, ` closes it. Prints ok/FAIL per check.
//   node tools/browser/devmenu.cjs
const { launch, watchErrors, startGame } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = watchErrors(p);
  await startGame(p);
  await p.waitForTimeout(1200);
  const spot = await p.evaluate(() => {
    const g = window.game, w = g.world;
    for (const z of w.zombies) z.alive = false;
    for (const h of w.hives) (h.spawnTimer = 1e9), (h.pulseTimer = 1e9);
    // nobody shoots during the check (they'd kill the new arrivals and earn bounties, muddying the counts)
    for (const q of w.squads) q.def = { ...q.def, weapon: { ...q.def.weapon, damage: 0 } };
    const sq = w.squads.find((s) => s.def.id === 'rifle');
    const at = w.grid.nearestFree({ x: sq.pos.x + 25, y: sq.pos.y });
    g.renderer.rig.focus(at);
    window.__at = at;
    return at;
  });
  await p.waitForTimeout(500);
  const screen = await p.evaluate((at) => window.game.renderer.worldToScreen(at), spot);
  await p.mouse.move(700, 450);
  await p.keyboard.press('Backquote');
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => !!document.querySelector('.dev-panel') && document.querySelector('.dev-panel').style.display !== 'none'), 'the ` key opens the dev menu');
  await p.click('[data-act="devz:runner"]');
  await p.click('[data-act="devn:10"]');
  await p.click('[data-act="devplace:zombies"]');
  ok(await p.evaluate(() => window.game.mode.kind === 'dev'), 'Drop Runners: click-to-place mode');
  await p.mouse.click(screen.x, screen.y);
  const first = await p.evaluate(() => {
    const w = window.game.world, at = window.__at;
    const z = w.zombies.filter((x) => x.alive);
    return { n: z.length, runners: z.every((x) => x.def.id === 'runner'), near: z.every((x) => Math.hypot(x.pos.x - at.x, x.pos.y - at.y) < 8), hunting: z.every((x) => x.state === 'chase'), mode: window.game.mode.kind };
  });
  ok(first.n === 10 && first.runners && first.near, `a click drops 10 Runners where it was clicked (${first.n})`);
  ok(first.hunting, 'they hunt your squads (the default)');
  ok(first.mode === 'normal', 'a plain click places once and stops');
  await p.evaluate(() => {
    for (const z of window.game.world.zombies) z.alive = false;
  });
  await p.click('[data-act="devplace:zombies"]');
  await p.keyboard.down('Shift');
  await p.mouse.click(screen.x, screen.y);
  await p.mouse.click(screen.x + 40, screen.y);
  await p.keyboard.up('Shift');
  const shift = await p.evaluate(() => ({ n: window.game.world.zombies.filter((x) => x.alive).length, mode: window.game.mode.kind }));
  ok(shift.n === 20 && shift.mode === 'dev', `Shift+click keeps placing (${shift.n} after two clicks, still placing)`);
  await p.mouse.click(screen.x, screen.y, { button: 'right' });
  ok(await p.evaluate(() => window.game.mode.kind === 'normal'), 'right-click stops placing');

  // a hive
  await p.click('[data-act="devstage:2"]');
  await p.click('[data-act="devplace:hive"]');
  const hives0 = await p.evaluate(() => window.game.world.hives.length);
  await p.mouse.click(screen.x, screen.y + 60);
  const hive = await p.evaluate((n) => {
    const w = window.game.world;
    const h = w.hives[w.hives.length - 1];
    return { added: w.hives.length - n, stage: h.stage, district: h.districtId };
  }, hives0);
  ok(hive.added === 1 && hive.stage === 2, `a click places a stage 2 hive (in ${hive.district})`);

  // the extras
  const m0 = await p.evaluate(() => window.game.world.money);
  await p.click('[data-act="devcash"]');
  ok((await p.evaluate(() => window.game.world.money)) - m0 === 1000, '+$1000');
  await p.click('[data-act="devclear"]');
  ok((await p.evaluate(() => window.game.world.zombies.filter((x) => x.alive).length)) === 0, 'Clear all zombies');
  await p.mouse.move(700, 450);
  await p.keyboard.press('Backquote');
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelector('.dev-panel').style.display === 'none'), '` closes it again');
  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' / ') : ''}`);
  await b.close();
})();
