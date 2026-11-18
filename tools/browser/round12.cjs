// Round 12 checks in the real game (v4.36): a search shows a pop-up over the house (#142), the outpost
// panel sends the nearest engineers to install the Garrison (#138), clicking a district's name moves the
// camera (#150), and screenshots of a split row of houses (#141). Prints what it checked and any page errors.
//   node tools/browser/round12.cjs   (screenshots in tools/out/round12-*.png)
const { launch, watchErrors, startGame } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = watchErrors(p);
  await startGame(p);

  // #141 / #142: search a house that used to share a building with its neighbour
  const info = await p.evaluate(() => {
    const g = window.game, w = g.world;
    for (const z of w.zombies) z.alive = false;
    const H = w.map.buildings.filter((b) => b.kind === 'houses' && w.districtAt({ x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h / 2 })?.def.id === 'motel');
    const pair = H.map((h) => [h, H.find((o) => o !== h && Math.abs(o.rect.y - h.rect.y) < 0.01 && Math.abs(o.rect.x + o.rect.w - h.rect.x) < 0.01)]).find(([, o]) => o);
    const [right, left] = pair;
    for (const x of [left, right]) w.buildingState.set(x.id, { searched: false, nest: 0 });
    const s = w.squads.find((q) => q.def.id === 'rifle');
    s.pos.x = left.rect.x + left.rect.w / 2;
    s.pos.y = left.rect.y + left.rect.h + 4;
    for (const m of s.members) (m.pos.x = s.pos.x), (m.pos.y = s.pos.y);
    g.renderer.rig.focus({ x: left.rect.x + left.rect.w, y: left.rect.y + left.rect.h / 2 });
    g.paused = false;
    w.orderSearch([s], left);
    window.__pair = [left.id, right.id];
    return { left: left.rect, right: right.rect };
  });
  await p.waitForFunction(() => window.game.world.buildingState.get(window.__pair[0]).searched, null, { timeout: 30000 });
  await p.waitForTimeout(500);
  const popup = await p.evaluate(() => [...document.querySelectorAll('.popup')].map((e) => e.textContent).join(' | '));
  const other = await p.evaluate(() => window.game.world.buildingState.get(window.__pair[1]).searched);
  ok(!!popup, `pop-up over the searched house: "${popup}"`);
  ok(!other, 'the house next door is still unsearched');
  await p.screenshot({ path: 'tools/out/round12-search.png' });

  // #138: outpost panel → nearest engineers walk over and install the Garrison
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    g.speed = 4;
    w.money = 5000;
    w.supplies = 5000;
    const eng = w.squads.find((s) => s.def.id === 'engineer');
    const op = w.addStructure('outpost', { x: Math.floor(eng.pos.x / 3) + 4, y: Math.floor(eng.pos.y / 3) }, true);
    window.__op = op.id;
    g.selectStructure(op.id);
  });
  await p.waitForSelector('[data-act="upgrade"]', { timeout: 10000 });
  await p.click('[data-act="upgrade"]');
  await p.waitForTimeout(400);
  const going = await p.evaluate(() => window.game.world.squads.some((s) => s.currentOrder?.type === 'upgrade'));
  ok(going, 'the Install Garrison button sends engineers');
  await p.waitForFunction(() => window.game.world.structures.find((s) => s.id === window.__op).upgraded, null, { timeout: 60000 });
  ok(true, 'engineers installed the Garrison');

  // #150: click a district name → camera moves
  const before = await p.evaluate(() => ({ x: window.game.renderer.rig.target.x, z: window.game.renderer.rig.target.z }));
  // the districts panel re-renders every frame, so click its spot rather than a (soon detached) element
  const box = await p.evaluate(() => { const r = document.querySelector('[data-act="goto-district:motel"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.click(box.x, box.y);
  const after = await p.evaluate(() => ({ x: window.game.renderer.rig.target.x, z: window.game.renderer.rig.target.z }));
  ok(Math.hypot(after.x - before.x, after.z - before.z) > 5, `clicking "Roadside Motel" moves the camera (${before.x.toFixed(0)},${before.z.toFixed(0)} → ${after.x.toFixed(0)},${after.z.toFixed(0)})`);

  // #141: a look at a row of houses after the split
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    const b = w.map.buildings.find((x) => x.id === window.__pair[0]);
    g.renderer.rig.focus({ x: b.rect.x + b.rect.w, y: b.rect.y + b.rect.h / 2 });
    g.paused = true;
  });
  await p.waitForTimeout(600);
  await p.screenshot({ path: 'tools/out/round12-houses.png' });

  console.log(errs.join('\n') || 'no page errors');
  await b.close();
})();
