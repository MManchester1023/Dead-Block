// Round 19 (v4.85) in the real game: the turret is the game's (the drawn one matches, and the first shot waits
// for it to come round), "REPAIRING" on a vehicle's label, the drive-off sound follows zoom and distance while it
// plays, the Humvee's MG is quieter zoomed out, a queued route is driven through, and the tuning page has the
// weapons. Prints ok/FAIL per check.
//   node tools/browser/round19.cjs
const { launch, watchErrors, startGame, URL } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = watchErrors(p);
  await startGame(p);
  await p.waitForTimeout(1200);
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    for (const z of w.zombies) z.alive = false;
    for (const h of w.hives) (h.spawnTimer = 1e9), (h.pulseTimer = 1e9);
    const r = w.squads.find((s) => s.def.id === 'rifle');
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ x: r.pos.x + 10, y: r.pos.y }));
    hv.facing = 0;
    w.issueOrder([hv], { type: 'hold', pos: { ...hv.pos } });
    // everyone else well out of the way, so the only shots are the Humvee's
    for (const q of w.squads) if (q !== hv) for (const m of [q.pos, ...q.members.map((mm) => mm.pos)]) (m.x = hv.pos.x - 80), (m.y = hv.pos.y);
    window.__hv = hv.id;
    g.renderer.rig.focus(hv.pos);
    g.renderer.rig.zoom = 3;
  });
  await p.waitForTimeout(500);

  // #231: a zombie behind it: the turret comes round first, then it fires; the drawn turret is the game's
  const tur = await p.evaluate(async () => {
    const g = window.game, w = g.world;
    const hv = w.squads.find((s) => s.id === window.__hv);
    const z = w.spawnZombie('walker', { x: hv.pos.x - 18, y: hv.pos.y });
    z.def = { ...z.def, speed: 0, sight: 0, hearing: 0 };
    z.hp = z.maxHp = 1e6;
    let first = null;
    const off = w.events.on('shot', (e) => {
      if (e.shooter === hv.id && !first) first = { angle: hv.turretAngle };
    });
    const startAngle = hv.turretAngle;
    for (let i = 0; i < 50 && !first; i++) await new Promise((r) => setTimeout(r, 100));
    off();
    const drawn = g.renderer.vehicles.turrets.get(hv.id)?.obj.rotation.y;
    z.alive = false;
    return { first, startAngle, drawn, sim: hv.turretAngle };
  });
  ok(!!tur.first && Math.abs(Math.abs(tur.first.angle) - Math.PI) < 0.2, tur.first ? `the first shot waits for the turret to come round (turret at ${tur.first.angle.toFixed(2)} rad, target at ±3.14) (#231)` : 'no shot seen');
  ok(tur.drawn !== undefined && Math.abs(tur.drawn + tur.sim) < 0.05, `the drawn turret is the game's (${tur.drawn?.toFixed(2)} vs ${(-tur.sim).toFixed(2)})`);

  // #228: REPAIRING on the label (labels show while the mouse is over a squad)
  await p.evaluate(() => {
    const g = window.game;
    g.select([window.__hv]);
    g.renderer.rig.focus(g.world.squads.find((s) => s.id === window.__hv).pos);
  });
  await p.waitForTimeout(300);
  const sp = await p.evaluate(() => window.game.renderer.worldToScreen(window.game.world.squads.find((s) => s.id === window.__hv).pos));
  await p.mouse.move(sp.x, sp.y);
  const label = await p.evaluate(async () => {
    const w = window.game.world;
    const hv = w.squads.find((s) => s.id === window.__hv);
    const end = performance.now() + 2000;
    let text = '';
    while (performance.now() < end) {
      hv.healing = w.time;
      text = [...document.querySelectorAll('.squad-label')].filter((e) => e.style.display !== 'none').map((e) => e.innerText).join(' | ');
      if (/repairing/i.test(text)) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    return text;
  });
  ok(/repairing/i.test(label) && !/treating/i.test(label), `a vehicle being fixed reads "REPAIRING" (${label.replace(/\s+/g, ' ').slice(0, 60)}) (#228)`);
  await p.mouse.move(5, 5);

  // #224: the drive-off fades when you zoom out while it plays
  const drive = await p.evaluate(async () => {
    const g = window.game, w = g.world, s = window.sound;
    const hv = w.squads.find((x) => x.id === window.__hv);
    if (!s.ctx) return { skipped: 'no audio context' };
    await s.ctx.resume?.();
    g.renderer.rig.zoom = 4;
    g.renderer.rig.focus(hv.pos);
    await new Promise((r) => setTimeout(r, 300));
    w.issueOrder([hv], { type: 'move', pos: w.grid.nearestFree({ x: hv.pos.x + 30, y: hv.pos.y }) });
    await new Promise((r) => setTimeout(r, 400));
    const n = s.driving.get(hv.id);
    if (!n) return { started: false };
    const close = n.g.gain.value;
    g.renderer.rig.zoom = 1.4;
    await new Promise((r) => setTimeout(r, 700));
    return { started: true, close, far: n.g.gain.value, running: s.ctx.state };
  });
  if (drive.skipped) ok(true, `drive-off fade not checked: ${drive.skipped}`);
  else ok(drive.started && drive.close > 0.1 && drive.far < drive.close * 0.2, `the drive-off fades as you zoom out while it plays (${drive.close?.toFixed(2)} → ${drive.far?.toFixed(3)}, audio ${drive.running}) (#224)`);

  // #230: the Humvee's MG is quieter zoomed out (the emplacement's isn't touched): steady shots fed to the sound
  const mg = await p.evaluate(async () => {
    const g = window.game, w = g.world, s = window.sound;
    const hv = w.squads.find((x) => x.id === window.__hv);
    w.issueOrder([hv], { type: 'hold', pos: { ...hv.pos } });
    const nest = { x: hv.pos.x + 3, y: hv.pos.y };
    // the volume the sound system aims each loop at, right after a shot (the headless page is too slow to
    // keep a loop going by firing in real time)
    const aimed = (m) => {
      let v = null;
      const orig = m.g.gain.setTargetAtTime;
      m.g.gain.setTargetAtTime = (x, ...r) => ((v = x), orig.call(m.g.gain, x, ...r));
      s.updateMgs();
      m.g.gain.setTargetAtTime = orig;
      return v;
    };
    const level = async (zoom) => {
      g.renderer.rig.zoom = zoom;
      g.renderer.rig.focus(hv.pos);
      await new Promise((r) => setTimeout(r, 100));
      s.mgFiring({ ...hv.pos }, hv.id);
      s.mgFiring(nest); // an emplacement-style shot (no shooter): placed by where it is
      const m = s.mgs.get(`id${hv.id}`);
      const e = s.mgs.get(`${Math.round(nest.x)},${Math.round(nest.y)}`);
      return { gain: aimed(m), vehicle: m.vehicle, nest: aimed(e) };
    };
    const near = await level(3);
    const out = await level(1.6);
    return { near, out };
  });
  ok(mg.near.vehicle && mg.out.gain < mg.near.gain * 0.7 && mg.out.gain > 0.05, `the Humvee's MG is quieter zoomed out (${mg.near.gain.toFixed(2)} at zoom 3 → ${mg.out.gain.toFixed(2)} at 1.6) (#230)`);
  ok(Math.abs(mg.out.nest - mg.near.nest) < 0.05, `an emplacement's isn't changed by zoom (${mg.near.nest.toFixed(2)} → ${mg.out.nest.toFixed(2)})`);

  // #229: a queued route: no stop at the middle waypoint
  const route = await p.evaluate(async () => {
    const g = window.game, w = g.world;
    const hv = w.squads.find((x) => x.id === window.__hv);
    // the longest straight stretch of street from here, east or west, clear for a Humvee's width (parked cars too)
    const clear = (x, y) => [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]].every(([ox, oy]) => !w.grid.isBlockedXY(x + ox, y + oy));
    let best = null;
    for (const y of [hv.pos.y, hv.pos.y - 1.5, hv.pos.y + 1.5])
      for (const dir of [1, -1]) {
        let len = 0;
        while (len < 60 && clear(hv.pos.x + dir * (len + 0.75), y)) len += 0.75;
        if (clear(hv.pos.x, y) && (!best || len > best.len)) best = { dir, len, y };
      }
    hv.pos.y = best.y;
    hv.facing = best.dir > 0 ? 0 : Math.PI;
    const a = { x: hv.pos.x + best.dir * best.len * 0.45, y: hv.pos.y };
    const c = { x: hv.pos.x + best.dir * best.len * 0.9, y: hv.pos.y };
    w.issueOrder([hv], { type: 'move', pos: a });
    w.issueOrder([hv], { type: 'move', pos: c }, true);
    let slowest = Infinity;
    const end = performance.now() + 40000;
    while (hv.currentOrder && performance.now() < end) {
      if (Math.hypot(hv.pos.x - a.x, hv.pos.y - a.y) < 4) slowest = Math.min(slowest, Math.abs(hv.vel));
      await new Promise((r) => setTimeout(r, 30));
    }
    return { len: best.len, slowest, done: !hv.currentOrder, at: { x: hv.pos.x, y: hv.pos.y }, a, c, orders: hv.orders.length, bumps: hv.bumps };
  });
  if (!route.done) console.log('     ', JSON.stringify(route));
  ok(route.len > 25 && route.done && route.slowest > 3, `a queued route is driven through: slowest ${route.slowest.toFixed(1)} m/s at the middle waypoint (${route.len.toFixed(0)} m of street) (#229)`);
  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' / ') : ''}`);

  // #222: the tuning page has the weapons
  const p2 = await b.newPage({ viewport: { width: 1300, height: 900 } });
  const errs2 = watchErrors(p2);
  await p2.goto(`${URL}/dev-balance.html`);
  await p2.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  const weapons = await p2.$$eval('details', (d) => {
    const x = d.find((e) => /Weapons/.test(e.querySelector('summary').textContent));
    return x ? x.textContent : '';
  });
  ok(/Humvee/.test(weapons) && /Heavy MG Nest/.test(weapons), `the tuning page has a Weapons group with the Humvee and the Heavy MG Nest (#222)`);
  ok(errs2.length === 0, `no tuning page errors${errs2.length ? ': ' + errs2.join(' / ') : ''}`);
  await b.close();
})();
