// End-to-end smoke test in the real game: survivors found and evacuated at the Command Post, then a save to
// slot 1, a change, a load (page reload) that restores it, and the start screen's Continue button.
// Prints what it checked and any page errors. Uses the browser's storage for this test only.
//   node tools/browser/smoke.cjs
const { URL, launch, watchErrors, startGame } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = watchErrors(p);
  await startGame(p);

  // survivors: spawn a group near the base, walk them in
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    const cp = w.structures.find((s) => s.def.id === 'commandPost');
    const c = w.findCivilians(w.squads[0], w.map.buildings[0], { x: cp.pos.x + 30, y: cp.pos.y + 8 });
    window.__c = c.id;
    window.__m0 = w.money;
    g.select([c.id]);
    g.commandAt(cp.pos, false);
  });
  await p.waitForFunction(() => !window.game.world.squads.some((s) => s.id === window.__c), null, { timeout: 60000 });
  const gained = await p.evaluate(() => window.game.world.money - window.__m0);
  ok(gained > 0, `survivors evacuated (+$${gained})`);

  // save → change → load
  await p.evaluate(() => {
    window.game.speed = 4;
    window.game.world.issueOrder([window.game.world.squads[0]], { type: 'move', pos: { x: 130, y: 110 } });
  });
  await p.waitForFunction(() => window.game.world.time > 20, null, { timeout: 120000 });
  await p.keyboard.press('Escape');
  if (!(await p.evaluate(() => window.game.menuOpen))) await p.keyboard.press('Escape');
  await p.click('[data-act="menu-page:saves"]');
  await p.click('[data-act="save-to:1"]');
  await p.waitForTimeout(800);
  const snap = () => p.evaluate(() => ({ t: window.game.world.time, money: window.game.world.money, squads: window.game.world.squads.map((s) => [s.name, Math.round(s.pos.x), Math.round(s.pos.y)]) }));
  const before = await snap();
  await p.evaluate(() => (window.game.world.money = 1));
  await p.click('[data-act="load-ask:1"]');
  await p.click('[data-act="load-go:1"]');
  await p.waitForFunction(() => window.game && window.game.loadedFrom, null, { timeout: 300000 });
  const after = await snap();
  ok(JSON.stringify(after) === JSON.stringify(before), 'save to slot 1 and load it back: same time, money and squad positions');
  ok(await p.evaluate(() => window.game.paused), 'loaded game starts paused');

  await p.goto(URL + '/');
  await p.waitForSelector('[data-act=start]', { timeout: 300000 });
  const cont = await p.evaluate(() => document.querySelector('[data-act^="continue-save"]')?.textContent?.trim());
  ok(!!cont, `start screen offers Continue (${cont})`);
  // leave the browser as it was
  await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('dbc.save.')).forEach((k) => localStorage.removeItem(k)));

  console.log(errs.join('\n') || 'no page errors');
  await b.close();
})();
