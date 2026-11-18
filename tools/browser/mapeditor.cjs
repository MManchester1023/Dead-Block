// Map editor (dev-map.html, v4.45): loads with no page errors and no problems in the starter map, saves
// byte-identical to src/data/maps/starter.json when nothing changed, a drag moves a building, and Play
// starts the game on the edited map. Prints checks and page errors.
//   node tools/browser/mapeditor.cjs
const fs = require('fs');
const path = require('path');
const { launch, watchErrors, URL, ROOT } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const p = await ctx.newPage();
  const errs = watchErrors(p);
  await p.goto(URL + '/dev-map.html');
  await p.evaluate(() => localStorage.removeItem('dbc.mapEdit'));
  await p.reload();
  await p.waitForFunction(() => window.mapEditor, null, { timeout: 120000 });
  const probs = await p.evaluate(() => window.mapEditor.problems().map((x) => x.msg));
  ok(probs.length === 0, `no problems in the starter map (${probs.join('; ') || 'none'})`);
  const saved = await p.evaluate(() => window.mapEditor.format(window.mapEditor.data));
  const file = fs.readFileSync(path.join(ROOT, 'src/data/maps/starter.json'), 'utf8');
  ok(saved === file, 'Save with no edits gives exactly the repo file');

  // drag the first building 3 cells right
  const r0 = await p.evaluate(() => ({ ...window.mapEditor.data.buildings[0].rect }));
  const pos = await p.evaluate(([x, y]) => {
    const cv = document.getElementById('c');
    const r = cv.getBoundingClientRect();
    // the editor fits the map to the window; recover its scale/offset from the canvas draw math
    return { left: r.left, top: r.top };
  }, [r0.x, r0.y]);
  const sc = await p.evaluate(() => Math.max(2, Math.min((innerWidth - 320) / window.mapEditor.data.cols, (innerHeight - 55) / window.mapEditor.data.rows)));
  const at = (cx, cy) => ({ x: pos.left + 10 + cx * sc, y: pos.top + 10 + cy * sc });
  const a = at(r0.x + 1.5, r0.y + 1.5);
  const bpt = at(r0.x + 4.5, r0.y + 1.5);
  await p.mouse.move(a.x, a.y);
  await p.mouse.down();
  await p.mouse.move(bpt.x, bpt.y, { steps: 5 });
  await p.mouse.up();
  const r1 = await p.evaluate(() => ({ ...window.mapEditor.data.buildings[0].rect }));
  ok(r1.x === r0.x + 3 && r1.y === r0.y, `dragging moved the building 3 cells (${r0.x},${r0.y} → ${r1.x},${r1.y})`);

  // Play: the game starts on the edit
  await p.evaluate(() => localStorage.setItem('dbc.mapOverride', JSON.stringify(window.mapEditor.data)));
  const g = await ctx.newPage();
  const gerrs = watchErrors(g);
  await g.goto(URL + '/index.html?map=edited');
  await g.waitForSelector('[data-act=start]', { timeout: 300000 });
  await g.click('[data-act=start]');
  await g.waitForFunction(() => window.game, null, { timeout: 120000 });
  const gx = await g.evaluate(() => window.game.world.map.buildings[0].rect.x / 3);
  ok(gx === r1.x, `Play starts the game on the edited map (building at x ${gx})`);

  console.log([...errs, ...gerrs].join('\n') || 'no page errors');
  await b.close();
})();
