// STATUS #20 (v4.61): the Medic Team in the real game. The Barracks lists it as locked until a Med Bay
// stands; recruited medics show a Heal button; K + clicking a hurt squad sends them to treat it; it heals
// and the button then shows its cooldown. Prints what it checked and any page errors.
//   node tools/browser/medic.cjs
const { launch, watchErrors, startGame } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = watchErrors(p);
  await startGame(p);

  // Barracks panel before the Med Bay: medics under the locked roster
  const before = await p.evaluate(() => {
    const g = window.game, w = g.world;
    w.money = 5000;
    w.supplies = 5000;
    g.selectStructure(w.structures.find((s) => s.def.id === 'barracks').id);
    g.changed();
    return null;
  });
  void before;
  await p.waitForTimeout(400);
  const lockedTxt = await p.evaluate(() => [...document.querySelectorAll('.locked')].map((e) => e.textContent).join(' | '));
  ok(/Medic Team/.test(lockedTxt) && /Med Bay/.test(lockedTxt), `locked roster lists the Medic Team (${lockedTxt.match(/[^|]*Medic[^|]*/)?.[0]?.trim()})`);
  ok(!(await p.$('[data-act="produce:medic"]')), 'no recruit button for medics yet');

  // unlock as the Med Bay does, recruit through the panel button
  await p.evaluate(() => {
    window.game.world.unlocked.add('medic');
    window.game.changed();
  });
  await p.waitForTimeout(400);
  const btn = await p.$('[data-act="produce:medic"]');
  ok(!!btn, 'recruit button appears once unlocked');
  if (btn) await btn.click();
  await p.evaluate(() => (window.game.speed = 4));
  await p.waitForFunction(() => window.game.world.squads.some((s) => s.def.id === 'medic'), null, { timeout: 60000 });
  const name = await p.evaluate(() => window.game.world.squads.find((s) => s.def.id === 'medic').name);
  ok(/^Medic /.test(name), `recruited "${name}"`);

  // a hurt rifle squad near the medics; select the medics; K; click the squad
  const info = await p.evaluate(() => {
    const g = window.game, w = g.world;
    g.speed = 1;
    for (const z of w.zombies) z.alive = false;
    const m = w.squads.find((s) => s.def.id === 'medic');
    const r = w.squads.find((s) => s.def.id === 'rifle');
    r.pos.x = m.pos.x + 10;
    r.pos.y = m.pos.y;
    for (const mm of r.members) (mm.pos.x = r.pos.x), (mm.pos.y = r.pos.y);
    w.issueOrder([r], { type: 'hold', pos: { ...r.pos } });
    r.pool = r.poolMax * 0.3;
    g.select([m.id]);
    g.renderer.rig.focus(r.pos);
    return { mid: m.id, rid: r.id, pool: r.pool, max: r.poolMax };
  });
  await p.waitForTimeout(500);
  ok(!!(await p.$('[data-act="heal"]')), 'Heal button in the squad commands');
  await p.keyboard.press('k');
  const mode = await p.evaluate(() => window.game.mode.kind);
  ok(mode === 'heal', `K enters heal mode (${mode})`);
  const sp = await p.evaluate((rid) => {
    const r = window.game.world.squads.find((s) => s.id === rid);
    return window.game.renderer.worldToScreen(r.pos);
  }, info.rid);
  await p.mouse.click(sp.x, sp.y);
  const order = await p.evaluate((mid) => window.game.world.squads.find((s) => s.id === mid).currentOrder?.type, info.mid);
  ok(order === 'heal', `click on the squad orders the heal (${order})`);
  await p.waitForFunction((rid) => {
    const r = window.game.world.squads.find((s) => s.id === rid);
    return r.pool > r.poolMax * 0.6;
  }, info.rid, { timeout: 30000 });
  const after = await p.evaluate((rid) => window.game.world.squads.find((s) => s.id === rid).pool, info.rid);
  ok(true, `rifle squad healed ${Math.round(info.pool)} → ${Math.round(after)} of ${Math.round(info.max)}`);
  await p.waitForTimeout(500);
  const label = await p.evaluate(() => document.querySelector('[data-act="heal"]')?.textContent ?? '');
  ok(/\d+s/.test(label), `Heal button shows the cooldown ("${label.trim()}")`);

  // right-click a hurt squad: heal again after the cooldown
  await p.evaluate((rid) => {
    const w = window.game.world;
    const m = w.squads.find((s) => s.def.id === 'medic');
    m.healReadyAt = 0;
    w.squads.find((s) => s.id === rid).pool *= 0.5;
  }, info.rid);
  await p.mouse.click(sp.x, sp.y, { button: 'right' });
  const order2 = await p.evaluate((mid) => window.game.world.squads.find((s) => s.id === mid).currentOrder?.type, info.mid);
  ok(order2 === 'heal', `right-click on a hurt squad orders a heal (${order2})`);

  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' / ') : ''}`);
  await b.close();
})();
