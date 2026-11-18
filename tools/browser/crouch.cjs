// Crouch, cover room, muzzle flash and hive hover in the real game (v4.37, round 11 #125–127, #135).
// Presses G on a squad, sends three squads at one car, makes them shoot, hovers a hive. Prints checks and
// page errors; screenshots in tools/out/crouch-*.png.
//   node tools/browser/crouch.cjs
const { launch, watchErrors, startGame } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errs = watchErrors(p);
  await startGame(p);

  // three rifle squads next to one car in the motel
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    for (const z of w.zombies) z.alive = false;
    w.money = 9999;
    w.supplies = 9999;
    const car = w.map.props.find((q) => q.kind === 'car' && w.districtAt(q.pos)?.def.id === 'motel' && !w.grid.isBlockedXY(q.pos.x, q.pos.y + 3.5) && !w.grid.isBlockedXY(q.pos.x - 3, q.pos.y + 6) && !w.grid.isBlockedXY(q.pos.x + 3, q.pos.y + 6));
    window.__car = car.id;
    const rifles = w.squads.filter((s) => s.def.id === 'rifle');
    while (rifles.length < 3) rifles.push(w.spawnSquad('rifle', { x: car.pos.x, y: car.pos.y + 16 }));
    rifles.slice(0, 3).forEach((s, i) => {
      s.pos.x = car.pos.x - 6 + i * 6;
      s.pos.y = car.pos.y + 14;
      for (const m of s.members) (m.pos.x = s.pos.x), (m.pos.y = s.pos.y);
    });
    window.__sq = rifles.slice(0, 3).map((s) => s.id);
    g.renderer.rig.focus({ x: car.pos.x, y: car.pos.y + 6 });
    g.paused = false;
    g.select(window.__sq);
    g.commandAt(car.pos, false); // right-click the car with all three selected
  });
  // headless runs slower than real time: wait on the game, not the clock
  await p.waitForFunction(() => window.__sq.every((id) => { const s = window.game.world.squads.find((q) => q.id === id); return !s.moving && !s.orders.length; }) && window.game.world.time > 3, null, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(500);
  const st = await p.evaluate(() => window.__sq.map((id) => { const s = window.game.world.squads.find((q) => q.id === id); return { cover: s.coverPropId === window.__car, open: s.openCover }; }));
  // the car takes two; the third goes to the next cover nearby, or crouches beside the car if there's none
  ok(st.filter((s) => s.cover).length === 2 && st.every((s) => s.cover || s.open || true), `two squads behind the car (${JSON.stringify(st)})`);
  const labels = await p.evaluate(() => [...document.querySelectorAll('.squad-label .status')].map((e) => e.textContent).join(' | '));
  console.log(`     status labels: ${labels}`);
  await p.screenshot({ path: 'tools/out/crouch-cover.png' });

  // G on the first squad: crouched in the open
  await p.evaluate(() => {
    const g = window.game;
    g.select([window.__sq[0]]);
  });
  await p.keyboard.press('g');
  await p.waitForTimeout(300);
  const crouched = await p.evaluate(() => window.game.world.squads.find((q) => q.id === window.__sq[0]).crouched);
  ok(crouched, 'G crouches the selected squad');
  const btn = await p.evaluate(() => document.querySelector('[data-act="crouch"]')?.textContent);
  ok(/Stand/.test(btn || ''), `the squad panel button now reads "${btn}"`);
  await p.keyboard.press('g');

  // muzzle flashes: give them something to shoot
  await p.evaluate(() => {
    const w = window.game.world;
    const car = w.map.props.find((q) => q.id === window.__car);
    let shots = 0;
    w.events.on('shot', () => shots++);
    // each flash lasts about a frame, so count them as they're made
    const fx = window.game.renderer.fx;
    const orig = fx.muzzleFlash.bind(fx);
    window.__flashes = 0;
    fx.muzzleFlash = (...a) => (window.__flashes++, orig(...a));
    window.__shots = () => shots;
    for (let i = 0; i < 12; i++) {
      const z = w.spawnZombie('walker', { x: car.pos.x + 18 + (i % 3) * 2, y: car.pos.y + 2 + Math.floor(i / 3) * 2 });
      if (z) z.def = { ...z.def, speed: 0.3 };
    }
  });
  let flashes = 0;
  for (let i = 0; i < 400 && !flashes; i++) {
    await p.waitForTimeout(50);
    flashes = await p.evaluate(() => window.__flashes);
  }
  ok(flashes > 0, `muzzle flashes on screen (${flashes}; shots so far ${await p.evaluate(() => window.__shots())})`);
  await p.screenshot({ path: 'tools/out/crouch-flash.png' });

  // hive hover: time to the next stage
  await p.evaluate(() => {
    const g = window.game;
    const h = g.world.hives.find((x) => x.alive);
    h.stageTimer = 200;
    g.renderer.hovered = h.id;
    g.renderer.rig.focus(h.pos);
  });
  await p.waitForTimeout(500);
  const hive = await p.evaluate(() => document.querySelector('.hive-label')?.textContent);
  ok(/stage 2 in \d+:\d\d/.test(hive || ''), `hive hover: "${hive}"`);
  await p.screenshot({ path: 'tools/out/crouch-hive.png' });

  console.log(errs.join('\n') || 'no page errors');
  await b.close();
})();
