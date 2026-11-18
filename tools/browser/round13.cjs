// Round 13 in the real game (v4.43): squad labels only while hovered (#158), MG nests turned to their aim
// with the opening at the back (#160). Prints checks and page errors.
//   node tools/browser/round13.cjs
const { launch, watchErrors, startGame } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = watchErrors(p);
  await startGame(p);
  await p.evaluate(() => window.game.renderer.rig.focus(window.game.world.squads[0].pos));
  await p.mouse.move(400, 300); // away from the squads (not the screen edge: that pans the camera)
  await p.waitForTimeout(500);
  const shown = await p.evaluate(() => [...document.querySelectorAll('.squad-label')].filter((e) => e.style.display !== 'none').length);
  ok(shown === 0, `no squad labels without hovering (${shown} shown)`);
  const at = await p.evaluate(() => window.game.renderer.worldToScreen(window.game.world.squads[0].pos));
  await p.mouse.move(at.x, at.y);
  await p.waitForTimeout(500);
  const hov = await p.evaluate(() => [...document.querySelectorAll('.squad-label')].filter((e) => e.style.display !== 'none').map((e) => e.textContent));
  ok(hov.length === 1, `hovering a squad shows its label (${hov.join(' | ')})`);

  const rot = await p.evaluate(async () => {
    const g = window.game, w = g.world;
    const st = w.addStructure('mgNest', { x: 20, y: 6 }, true, false, Math.PI / 2);
    await new Promise((r) => setTimeout(r, 400));
    return g.renderer.structures.views.get(st.id).rotation.y;
  });
  ok(Math.abs(rot + Math.PI / 2) < 1e-6, `an MG nest aimed south is turned to face south (rotation ${rot.toFixed(3)})`);

  console.log(errs.join('\n') || 'no page errors');
  await b.close();
})();
