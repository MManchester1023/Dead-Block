// "Did the picture change?" A fixed, paused scene (squads, structures in different states, a build
// preview with a field of fire, then a wide view) screenshotted to tools/out/<tag>-street.png and
// <tag>-wide.png. Run before and after a change, then compare with pngdiff.py. A few things animate on
// real time even while paused (rally flag, hive pulse), so two runs of the same code differ by ~0.04%.
//   node tools/browser/screens.cjs before   …change…   node tools/browser/screens.cjs after
//   python3 tools/browser/pngdiff.py tools/out/before-street.png tools/out/after-street.png
const path = require('path');
const { OUT, launch, watchErrors, startGame } = require('./lib.cjs');

(async () => {
  const tag = process.argv[2] || 'latest';
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } });
  const errs = watchErrors(p);
  await startGame(p);
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    g.paused = true;
    const e = w.squads.find((s) => s.def.id === 'engineer');
    w.addStructure('sandbags', { x: 40, y: 30 }, true);
    w.addStructure('mgNest', { x: 44, y: 34 }, false, false, 0.7).buildProgress = 5;
    w.addStructure('guardTower', { x: 36, y: 40 }, true);
    w.addStructure('outpost', { x: 46, y: 40 }, true);
    w.addStructure('wire', { x: 40, y: 44 }, true, true);
    g.renderer.setGhost({ x: 50, y: 30 }, { w: 2, h: 2 }, true, 35, { aim: 1.2, deg: 120 });
    g.renderer.rig.target.set(130, 0, 110);
    g.renderer.rig.zoom = 1.2;
    g.renderer.rig.yaw = Math.PI / 4;
    g.select([e.id]);
    document.getElementById('hud').style.display = 'none';
  });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(OUT, `${tag}-street.png`) });
  await p.evaluate(() => {
    const g = window.game;
    g.renderer.setGhost(null);
    g.renderer.rig.target.set(280, 0, 160);
    g.renderer.rig.zoom = 0.6;
  });
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(OUT, `${tag}-wide.png`) });
  console.log(`saved tools/out/${tag}-street.png and ${tag}-wide.png`);
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
