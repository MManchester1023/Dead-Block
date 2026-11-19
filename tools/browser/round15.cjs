// Round 15 quick fixes (#48, v4.71) in the real game: no "Hive stage" on the HUD (#187); muzzle flashes are
// drawn and last at least two frames, explosions show a flash (#188); finished effects free their GPU memory.
// Prints ok/FAIL per check.
//   node tools/browser/round15.cjs
const { launch, watchErrors, startGame } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 850 } });
  const errs = watchErrors(p);
  await startGame(p);
  await p.waitForTimeout(800);
  const hud = await p.evaluate(() => document.body.innerText);
  ok(!/Hive stage/i.test(hud), 'the Districts panel no longer shows the hive stage');

  // muzzle flashes: a squad shooting at a zombie; record the flash count every frame
  const flashes = await p.evaluate(async () => {
    const g = window.game, w = g.world;
    const sq = w.squads.find((s) => s.def.id === 'rifle');
    g.renderer.rig.focus(sq.pos);
    for (let i = 0; i < 6; i++) w.spawnZombie('walker', { x: sq.pos.x + 14 + i, y: sq.pos.y + 2 });
    const fx = g.renderer.fx;
    // watch each flash leave: how many frames had it been drawn by then?
    const runs = [];
    const seen = new Set();
    const update = fx.update.bind(fx);
    fx.update = (...args) => {
      const before = [...fx.flashes];
      update(...args);
      for (const fl of before) {
        seen.add(fl);
        if (!fx.flashes.includes(fl)) runs.push(fl.shown);
      }
    };
    for (let f = 0; f < 90; f++) await new Promise((r) => requestAnimationFrame(r));
    fx.update = update;
    const drawn = fx.flashSets.reduce((n, s) => n + s.geo.drawRange.count, 0);
    return { flashes: seen.size, minFrames: runs.length ? Math.min(...runs) : 0, drawnNow: drawn, size: fx.flashSets[0].pts.material.size };
  });
  ok(flashes.flashes > 0, `muzzle flashes while firing (${flashes.flashes} in 90 frames, sprite ${flashes.size} m)`);
  ok(flashes.minFrames >= 2, `every flash stays on screen at least 2 frames (shortest: ${flashes.minFrames})`);

  // explosion flash
  const ex = await p.evaluate(async () => {
    const g = window.game, w = g.world;
    const sq = w.squads.find((s) => s.def.id === 'rifle');
    const fx = g.renderer.fx;
    const geoBefore = g.renderer.gl.info.memory.geometries;
    for (let i = 0; i < 20; i++) fx.explosion({ x: sq.pos.x + 20, y: sq.pos.y + i }, 3, 0xffa040);
    await new Promise((r) => requestAnimationFrame(r));
    const sprites = [];
    g.renderer.scene.traverse((o) => o.isSprite && sprites.push(o.material.blending));
    const geoPeak = g.renderer.gl.info.memory.geometries;
    // let them all finish (effects run on game time; scorch marks last 60 s, so speed the game up)
    g.speed = 4;
    await new Promise((r) => setTimeout(r, 2500));
    return { sprites: sprites.length, additive: sprites.every((bl) => bl === 2), geoBefore, geoPeak };
  });
  ok(ex.sprites >= 20 && ex.additive, `explosions show a bright additive flash (${ex.sprites} flashes for 20 blasts)`);
  const geoAfter = await p.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 15000)); // the scorch marks (60 s of game time at 4x) are gone too
    return window.game.renderer.gl.info.memory.geometries;
  });
  ok(geoAfter < ex.geoPeak, `finished effects free their geometry (GPU geometries ${ex.geoBefore} → ${ex.geoPeak} at the blasts → ${geoAfter})`);
  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' / ') : ''}`);
  await b.close();
})();
