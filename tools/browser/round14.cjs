// Round 14 in the real game (v4.51): every squad under the cursor shows its label, stacked (#178); the
// Barracks queue groups "Rifle Squad ×3" (#173); the Districts panel has no pulse countdown or "cooling
// down" (#165, #179); the radio says "Horde wave" (#168). Prints checks and page errors.
//   node tools/browser/round14.cjs
const { launch, watchErrors, startGame } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = watchErrors(p);
  await startGame(p);

  // two squads on the same spot: hovering shows both labels, one above the other
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    const [a, b2] = w.squads.filter((s) => s.def.id === 'rifle');
    b2.pos.x = a.pos.x + 0.5;
    b2.pos.y = a.pos.y;
    for (const m of b2.members) (m.pos.x = b2.pos.x), (m.pos.y = b2.pos.y);
    g.renderer.rig.focus(a.pos);
    window.__a = a.id;
  });
  await p.waitForTimeout(400);
  const at = await p.evaluate(() => window.game.renderer.worldToScreen(window.game.world.squads.find((s) => s.id === window.__a).pos));
  await p.mouse.move(at.x, at.y);
  await p.waitForTimeout(500);
  const labels = await p.evaluate(() => [...document.querySelectorAll('.squad-label')].filter((e) => e.style.display !== 'none').map((e) => ({ t: e.querySelector('.sname')?.textContent, top: e.getBoundingClientRect().top })));
  const tops = labels.map((l) => Math.round(l.top));
  ok(labels.length === 2 && Math.abs(tops[0] - tops[1]) >= 20, `two squads on one spot both show their labels, stacked (${labels.map((l) => l.t).join(', ')}; tops ${tops.join(', ')})`);

  // Barracks queue: three rifle squads → one line "×3"
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    w.money = 9999;
    w.supplies = 9999;
    w.commandCap = 99;
    for (let i = 0; i < 3; i++) w.queueProduction('rifle');
    g.selectStructure(w.structures.find((s) => s.def.id === 'barracks').id);
  });
  await p.waitForTimeout(500);
  const q = await p.evaluate(() => [...document.querySelectorAll('.qitem')].map((e) => e.textContent.trim()));
  ok(q.length === 1 && /×3/.test(q[0]), `Barracks queue: ${JSON.stringify(q)}`);

  // Districts panel: no pulse countdown, no "cooling down"
  await p.evaluate(() => {
    const d = window.game.world.districts.get('motel');
    d.noiseLockUntil = window.game.world.time + 40;
  });
  await p.waitForTimeout(500);
  const panel = await p.evaluate(() => document.body.innerText);
  ok(!/next pulse/i.test(panel) && !/cooling down/i.test(panel), 'no pulse countdown or "cooling down" in the HUD');

  // radio naming
  const said = await p.evaluate(() => {
    const out = [];
    const w = window.game.world;
    w.events.on('radio', (e) => out.push(e.text));
    w.events.emit('hordePulse', { districtId: 'motel', size: 12, target: { x: 0, y: 0 } });
    return window.hud.radio.lines.slice(-1)[0]?.text ?? '';
  });
  ok(/Horde wave/.test(said), `radio: "${said}"`);

  // patrol (#174) with P and clicks, drawn as an amber loop (#176); waypoints drawn green and numbered
  await p.mouse.move(400, 300);
  await p.evaluate(() => {
    const g = window.game;
    g.select([window.__a]);
    g.renderer.rig.focus(g.world.squads.find((s) => s.id === window.__a).pos);
  });
  await p.waitForTimeout(400);
  await p.keyboard.press('p');
  const mode = await p.evaluate(() => window.game.mode.kind);
  await p.keyboard.down('Shift');
  await p.mouse.click(600, 300);
  await p.keyboard.up('Shift');
  await p.mouse.click(800, 450);
  await p.waitForTimeout(400);
  const pat = await p.evaluate(() => {
    const s = window.game.world.squads.find((q) => q.id === window.__a);
    const o = s.orders[0];
    return { mode: window.game.mode.kind, type: o?.type, points: o?.route?.length, segs: window.game.renderer.routes.geo.drawRange.count / 2, markers: window.game.renderer.routes.markers.filter((m) => m.visible).length };
  });
  ok(mode === 'patrol' && pat.type === 'patrol' && pat.points === 3 && pat.mode === 'normal', `P + two clicks: a 3-point patrol loop (${JSON.stringify(pat)})`);
  ok(pat.segs >= 3 && pat.markers === 3, 'the loop is drawn for the selected squad');
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    const s = w.squads.find((q) => q.id === window.__a);
    w.issueOrder([s], { type: 'move', pos: { x: s.pos.x + 20, y: s.pos.y } });
    w.issueOrder([s], { type: 'move', pos: { x: s.pos.x + 20, y: s.pos.y + 20 } }, true);
    w.issueOrder([s], { type: 'move', pos: { x: s.pos.x, y: s.pos.y + 20 } }, true);
  });
  await p.waitForTimeout(400);
  const nums = await p.evaluate(() => [...document.querySelectorAll('.wp-num')].filter((e) => e.style.display !== 'none').map((e) => e.textContent).join(','));
  ok(nums === '1,2,3', `waypoints numbered 1–3 (${nums})`);

  // formations (#177): buttons with 2+ squads, a preview while right-dragging, the move on release
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    const ids = w.squads.filter((s) => s.def.category !== 'civilian').slice(0, 3).map((s) => s.id);
    for (const s of w.squads) s.orders = [];
    g.select(ids);
    g.renderer.rig.focus(w.squads.find((s) => s.id === ids[0]).pos);
    window.__ids = ids;
  });
  await p.waitForTimeout(500);
  const buttons = await p.evaluate(() => [...document.querySelectorAll('[data-act^="formation:"]')].map((e) => e.textContent.trim()));
  ok(buttons.join(',') === 'Line,Column,Wedge,Box,Spread', `formation buttons: ${buttons.join(', ')}`);
  const wb = await p.evaluate(() => { const r = document.querySelector('[data-act="formation:wedge"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.click(wb.x, wb.y);
  await p.mouse.move(700, 350);
  await p.mouse.down({ button: 'right' });
  await p.mouse.move(760, 330, { steps: 4 });
  await p.mouse.move(820, 310, { steps: 4 });
  const preview = await p.evaluate(() => window.game.renderer.formationPreview.length);
  await p.mouse.up({ button: 'right' });
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => ({ shape: window.game.formation, orders: window.__ids.map((id) => window.game.world.squads.find((s) => s.id === id).orders[0]).map((o) => o && o.type + (o.face !== undefined ? ':faced' : '')) }));
  ok(preview === 3, `right-drag shows where the 3 squads will stand (${preview})`);
  ok(after.shape === 'wedge' && after.orders.every((o) => o === 'move:faced'), `on release they move into the wedge, facing as dragged (${JSON.stringify(after)})`);
  await p.mouse.click(650, 420, { button: 'right' });
  await p.waitForTimeout(300);
  const plain = await p.evaluate(() => window.__ids.map((id) => window.game.world.squads.find((s) => s.id === id).orders[0]).map((o) => o && o.type + (o.face !== undefined ? ':faced' : '')));
  ok(plain.every((o) => o === 'move'), `a plain right-click is a normal move (${plain.join(',')})`);

  console.log(errs.join('\n') || 'no page errors');
  await b.close();
})();
