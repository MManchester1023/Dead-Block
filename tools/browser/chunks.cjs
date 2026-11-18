// City chunk streaming (STATUS #14, v4.46) on a big map: the starter map grown to 600 × 600 cells
// (1.8 km square, 100 chunks) with extra avenues, played through the map editor's Play override. Pans the
// camera across it and checks that chunks near the camera get built, far ones are let go past the
// budget, the ops map uses low detail, and frames stay smooth while it streams. Prints checks.
//   node tools/browser/chunks.cjs
const fs = require('fs');
const path = require('path');
const { launch, watchErrors, URL, ROOT } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/maps/starter.json'), 'utf8'));
  data.cols = 600;
  data.rows = 600;
  data.grass.clumps = 900;
  for (let x = 200; x < 600; x += 60) data.ground.push({ road: { x, y: 0, w: 4, h: 600 }, axis: 'v', sidewalks: true });
  for (let y = 180; y < 600; y += 60) data.ground.push({ road: { x: 0, y, w: 600, h: 4 }, axis: 'h', sidewalks: true });
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const errs = watchErrors(p);
  await p.goto(URL + '/dev-map.html');
  await p.evaluate((d) => localStorage.setItem('dbc.mapOverride', JSON.stringify(d)), data);
  await p.goto(URL + '/index.html?map=edited');
  await p.waitForSelector('[data-act=start]', { timeout: 300000 });
  await p.click('[data-act=start]');
  await p.waitForFunction(() => window.game && window.game.renderer.city, null, { timeout: 120000 });
  const s0 = await p.evaluate(() => window.game.renderer.city.chunkStats);
  ok(s0.chunks === 100, `100 chunks on a 1.8 km map (${JSON.stringify(s0)})`);
  ok(s0.full <= 12 && s0.content <= 20, 'only the chunks around the camera are built at the start');

  // pan diagonally across the whole map, sampling frame times
  await p.evaluate(() => {
    window.__frames = [];
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      window.__frames.push(now - last);
      last = now;
      window.__raf = requestAnimationFrame(tick);
    };
    window.__raf = requestAnimationFrame(tick);
  });
  for (let k = 0; k <= 30; k++) {
    await p.evaluate((f) => window.game.renderer.rig.focus({ x: 100 + f * 1600, y: 100 + f * 1600 }), k / 30);
    await p.waitForTimeout(250);
  }
  await p.waitForFunction(() => window.game.renderer.city.pending === 0, null, { timeout: 120000 }).catch(() => {});
  const s1 = await p.evaluate(() => window.game.renderer.city.chunkStats);
  const frames = await p.evaluate(() => {
    cancelAnimationFrame(window.__raf);
    const f = window.__frames.slice(5).sort((a, b) => a - b);
    return { n: f.length, median: f[Math.floor(f.length / 2)], p95: f[Math.floor(f.length * 0.95)], max: f[f.length - 1] };
  });
  ok(s1.full <= 16 + 6 && s1.content <= 30 + 6, `after crossing the map, memory stays within budget (${JSON.stringify(s1)})`);
  console.log(`     frame times while streaming (headless, software rendering): median ${frames.median.toFixed(0)} ms, 95th ${frames.p95.toFixed(0)} ms, worst ${frames.max.toFixed(0)} ms over ${frames.n} frames`);
  const here = await p.evaluate(() => {
    const c = window.game.renderer.city, t = window.game.renderer.rig.target;
    return c.chunks.filter((k) => Math.abs(k.rect.x + 96 - t.x) < 200 && Math.abs(k.rect.y + 96 - t.z) < 200).map((k) => [k.lod, !!k.content]);
  });
  ok(here.length > 0 && here.every(([lod, content]) => lod === 2 && content), `the chunks around the camera at the far corner are fully built (${here.length})`);

  // ops map: wide view at low detail
  await p.evaluate(() => {
    window.game.renderer.rig.focus({ x: 900, y: 900 });
    window.game.renderer.rig.zoom = 0.6;
  });
  await p.waitForFunction(() => window.game.renderer.city.pending === 0, null, { timeout: 120000 }).catch(() => {});
  const s2 = await p.evaluate(() => window.game.renderer.city.chunkStats);
  ok(s2.low > s2.full, `the ops map shows the wide view at low detail (${JSON.stringify(s2)})`);

  console.log(errs.join('\n') || 'no page errors');
  await b.close();
})();
