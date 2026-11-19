// STATUS #47 (v4.69): Settings → Performance readout and Graphics quality, in the real game. The readout
// appears with numbers; quality cycles High → Medium → Low and changes the pixel ratio, sun shadow map and
// zombie shadows; both survive a reload. Prints ok/FAIL per check.
//   node tools/browser/graphics.cjs
const { launch, watchErrors, startGame } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const ctx = await b.newContext({ viewport: { width: 1300, height: 850 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = watchErrors(p);
  await startGame(p);
  await p.evaluate(() => localStorage.removeItem('dbc.quality'));
  const openSettings = async () => {
    if (!(await p.evaluate(() => window.game.menuOpen))) await p.keyboard.press('Escape');
    await p.click('[data-act="menu-page:settings"]');
  };
  await openSettings();
  await p.click('[data-act="perf"]');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1200);
  const txt = await p.evaluate(() => document.querySelector('.perf-readout')?.innerText ?? '');
  ok(/\d+ FPS/.test(txt) && /sim [\d.]+ · scene [\d.]+ · draw [\d.]+/.test(txt) && /draw calls/.test(txt), `readout shows: ${txt.replace(/\n/g, ' | ')}`);

  const state = () =>
    p.evaluate(() => {
      const r = window.game.renderer;
      return { q: r.quality, ratio: r.gl.getPixelRatio(), shadow: r.sun.shadow.mapSize.x, zs: r.crowds.crowds.zombieM.shadowLimit };
    });
  const s0 = await state();
  ok(s0.q === 'high' && s0.ratio === 2 && s0.shadow === 4096 && s0.zs === 300, `High by default (ratio ${s0.ratio}, shadows ${s0.shadow}, zombie shadows ${s0.zs})`);
  await openSettings();
  await p.click('[data-act="quality"]');
  const s1 = await state();
  ok(s1.q === 'medium' && s1.ratio === 1.25 && s1.shadow === 2048 && s1.zs === 100, `Medium (ratio ${s1.ratio}, shadows ${s1.shadow}, zombie shadows ${s1.zs})`);
  await p.click('[data-act="quality"]');
  const s2 = await state();
  ok(s2.q === 'low' && s2.ratio === 1 && s2.shadow === 1024 && s2.zs === 0, `Low (ratio ${s2.ratio}, shadows ${s2.shadow}, zombie shadows ${s2.zs})`);
  ok((await p.textContent('[data-act="quality"]')).trim() === 'Low', 'the button says Low');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(800);
  ok(await p.evaluate(() => !!window.game.renderer.sun.shadow.map && window.game.renderer.sun.shadow.map.width === 1024), 'the sun shadow map is rebuilt at the new size');

  await p.reload();
  await p.waitForFunction(() => window.game, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  const s3 = await state();
  const shown = await p.evaluate(() => getComputedStyle(document.querySelector('.perf-readout') ?? document.body).display !== 'none' && !!document.querySelector('.perf-readout'));
  ok(s3.q === 'low' && shown, `after a reload: still Low, readout still on`);
  await p.evaluate(() => {
    localStorage.removeItem('dbc.quality');
    localStorage.removeItem('dbc.perf');
  });
  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' / ') : ''}`);
  await b.close();
})();
