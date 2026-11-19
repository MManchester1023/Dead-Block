// Round 18 (v4.83) in the real game, through mouse and keyboard where it matters: clicking a Humvee with a
// squad inside selects it, medics board a damaged one, its tracers start at the gun, one drive-off sound at a
// time, seamless WAV loops, the right-drag ghost (with the facing it sends), N to repair, engineers' right-click
// boards, the XP bar, the Vehicle Bay ghost's door arrow. Prints ok/FAIL per check.
//   node tools/browser/round18.cjs
const { launch, watchErrors, startGame } = require('./lib.cjs');

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
    w.supplies = 5000;
    const r = w.squads.find((s) => s.def.id === 'rifle');
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ x: r.pos.x + 10, y: r.pos.y }));
    hv.facing = 0;
    w.issueOrder([hv], { type: 'hold', pos: { ...hv.pos } });
    window.__hv = hv.id;
    window.__r = r.id;
    g.renderer.rig.focus(hv.pos);
    g.renderer.rig.zoom = 3;
  });
  await p.waitForTimeout(700);
  const at = async (id) => p.evaluate((id) => window.game.renderer.worldToScreen(window.game.world.squads.find((s) => s.id === id).pos), id);

  // #219: a rider inside, then click the Humvee
  await p.evaluate(() => {
    const w = window.game.world;
    const r = w.squads.find((s) => s.id === window.__r);
    const hv = w.squads.find((s) => s.id === window.__hv);
    r.pos.x = hv.pos.x + 3;
    r.pos.y = hv.pos.y;
    w.orderBoard([r], hv);
  });
  await p.waitForFunction(() => window.game.world.squads.find((s) => s.id === window.__r).inVehicle != null, null, { timeout: 15000 });
  let sp = await at(await p.evaluate(() => window.__hv));
  await p.mouse.click(sp.x, sp.y);
  ok(await p.evaluate(() => window.game.selected.has(window.__hv)), 'clicking a Humvee with a squad inside selects it (#219)');
  await p.keyboard.press('u');

  // #218: medics right-click a damaged Humvee: they board
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    const hv = w.squads.find((s) => s.id === window.__hv);
    hv.pool = hv.poolMax * 0.5;
    const m = w.spawnSquad('medic', w.grid.nearestFree({ x: hv.pos.x - 8, y: hv.pos.y + 4 }));
    window.__m = m.id;
    g.select([m.id]);
  });
  sp = await at(await p.evaluate(() => window.__hv));
  await p.mouse.click(sp.x, sp.y, { button: 'right' });
  ok(await p.evaluate(() => window.game.world.squads.find((s) => s.id === window.__m).currentOrder?.type === 'board'), 'medics right-clicking a damaged Humvee go to board it (#218)');
  await p.evaluate(() => window.game.world.issueOrder([window.game.world.squads.find((s) => s.id === window.__m)], { type: 'hold', pos: { x: 0, y: 0 } }));

  // #210: tracers start at the gun
  const tr = await p.evaluate(async () => {
    const g = window.game, w = g.world;
    const hv = w.squads.find((s) => s.id === window.__hv);
    // everyone else well out of the way, so the only shots are the Humvee's
    for (const q of w.squads) if (q !== hv) for (const m of [q.pos, ...q.members.map((mm) => mm.pos)]) (m.x = hv.pos.x - 80), (m.y = hv.pos.y);
    const fx = g.renderer.fx;
    const orig = fx.tracer.bind(fx);
    let seen = null;
    fx.tracer = (from, to, heavy, h) => {
      // (only the Humvee's: other squads nearby shoot too)
      const d = Math.hypot(from.x - hv.pos.x, from.y - hv.pos.y);
      if (!seen && d < 3) seen = { d, h: h ?? 1.3 };
      return orig(from, to, heavy, h);
    };
    const z = w.spawnZombie('walker', { x: hv.pos.x + 20, y: hv.pos.y });
    z.hp = z.maxHp = 1e6;
    for (let i = 0; i < 60 && !seen; i++) await new Promise((r) => setTimeout(r, 100));
    fx.tracer = orig;
    z.alive = false;
    return seen;
  });
  ok(!!tr && tr.h > 1.4 && tr.d > 0.5, tr ? `the Humvee's tracers start at the gun (${tr.d.toFixed(2)} m from the centre, ${tr.h.toFixed(2)} m up) (#210)` : 'no tracer seen');

  // #211: one drive-off at a time; #212/#216: WAV loops
  const snd = await p.evaluate(async () => {
    const g = window.game, w = g.world, s = window.sound;
    const hv = w.squads.find((x) => x.id === window.__hv);
    g.renderer.rig.zoom = 4;
    g.renderer.rig.focus(hv.pos);
    await new Promise((r) => setTimeout(r, 300));
    for (let i = 0; i < 4; i++) {
      w.issueOrder([hv], { type: 'move', pos: w.grid.nearestFree({ x: hv.pos.x + 10 + i * 3, y: hv.pos.y }) });
      await new Promise((r) => setTimeout(r, 120));
    }
    const playing = s.playing.drive;
    const loops = { mg: s.loops.mg_loop?.duration ?? 0, idle: s.loops.humvee_idle?.duration ?? 0 };
    return { playing, tracked: s.driving.size, loops };
  });
  ok(snd.tracked === 1, `four quick orders: one drive-off sound for the Humvee (${snd.tracked} tracked, ${snd.playing} still fading/playing) (#211)`);
  ok(Math.abs(snd.loops.mg - 1.58) < 0.02 && Math.abs(snd.loops.idle - 10) < 0.02, `seamless WAV loops loaded (MG ${snd.loops.mg.toFixed(2)} s, idle ${snd.loops.idle.toFixed(2)} s) (#212, #216)`);

  // #214: right-drag shows a ghost with an arrow and parks facing the drag
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    const hv = w.squads.find((x) => x.id === window.__hv);
    w.issueOrder([hv], { type: 'hold', pos: { ...hv.pos } });
    g.select([hv.id]);
    g.renderer.rig.zoom = 2.2;
    g.renderer.rig.focus(hv.pos);
  });
  await p.waitForTimeout(400);
  sp = await at(await p.evaluate(() => window.__hv));
  const a = { x: sp.x + 120, y: sp.y + 40 };
  await p.mouse.move(a.x, a.y);
  await p.mouse.down({ button: 'right' });
  await p.mouse.move(a.x + 30, a.y + 60, { steps: 6 });
  await p.mouse.move(a.x + 60, a.y + 120, { steps: 6 });
  const ghost = await p.evaluate(() => {
    const g = window.game;
    const gh = g.renderer.vehicleGhosts;
    const vis = g.renderer.vehicles.ghosts.filter((x) => x.visible).length;
    return { n: gh.length, face: gh[0]?.face, vis };
  });
  await p.mouse.up({ button: 'right' });
  const face = await p.evaluate(() => window.game.world.squads.find((x) => x.id === window.__hv).currentOrder?.face);
  ok(ghost.n === 1 && ghost.vis === 1, `right-dragging a Humvee shows its ghost with an arrow (${ghost.vis} shown) (#214)`);
  ok(face !== undefined && Math.abs(face - ghost.face) < 1e-6, `the move it gets carries that facing (${face?.toFixed(2)} rad)`);
  ok(await p.evaluate(() => window.game.renderer.vehicles.ghosts.every((x) => !x.visible)), 'the ghost goes when you let go');

  // #220: engineers: right-click boards; N + click repairs
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    const hv = w.squads.find((x) => x.id === window.__hv);
    w.issueOrder([hv], { type: 'hold', pos: { ...hv.pos } });
    hv.pool = hv.poolMax * 0.5;
    const eng = w.squads.find((s) => s.def.id === 'engineer');
    eng.pos.x = hv.pos.x - 8;
    eng.pos.y = hv.pos.y;
    window.__e = eng.id;
    g.select([eng.id]);
    g.renderer.rig.focus(hv.pos);
  });
  await p.waitForTimeout(300);
  sp = await at(await p.evaluate(() => window.__hv));
  await p.mouse.click(sp.x, sp.y, { button: 'right' });
  ok(await p.evaluate(() => window.game.world.squads.find((s) => s.id === window.__e).currentOrder?.type === 'board'), "engineers right-clicking a damaged Humvee board it (owner: repairs are by button)");
  await p.keyboard.press('n');
  ok(await p.evaluate(() => window.game.mode.kind === 'repair'), 'N: repair mode');
  await p.mouse.click(sp.x, sp.y);
  const rep = await p.evaluate(() => window.game.world.squads.find((s) => s.id === window.__e).currentOrder);
  ok(rep?.type === 'repair' && rep.targetId === (await p.evaluate(() => window.__hv)), 'N + click on the Humvee: the engineers go to repair it (#220)');

  // #217: XP bar under the health bar
  await p.evaluate(() => window.game.select([window.__r]));
  await p.waitForTimeout(400);
  ok(await p.evaluate(() => !!document.querySelector('.squad-label .xpbar')), 'a selected squad shows an XP bar under its health (#217)');

  // the Vehicle Bay ghost's door arrow
  const door = await p.evaluate(async () => {
    const g = window.game, w = g.world;
    w.unlocked.add('vehicleBay');
    w.money = 5000;
    g.select([w.squads.find((s) => s.def.id === 'engineer').id]);
    g.startBuild('vehicleBay');
    await new Promise((r) => setTimeout(r, 400));
    return g.renderer.ghost.aim.visible;
  });
  await p.mouse.move(700, 450);
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => window.game.renderer.ghost.aim.visible), 'placing a Vehicle Bay: the ghost shows an arrow at the door');
  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' / ') : ''}`);
  await b.close();
})();
