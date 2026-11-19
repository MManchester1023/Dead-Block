// STATUS #51 (v4.77): the Humvee in the real game: the Vehicle Bay's panel builds one, it's drawn with the owner's
// model, a rifle squad right-clicks it and climbs in (hidden, out of the forces' way), U unloads it, and its gun
// fires. Prints ok/FAIL per check.
//   node tools/browser/humvee.cjs
const { launch, watchErrors, startGame } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = watchErrors(p);
  await startGame(p);
  await p.waitForTimeout(1000);
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    for (const z of w.zombies) z.alive = false;
    for (const h of w.hives) (h.spawnTimer = 1e9), (h.pulseTimer = 1e9);
    w.money = 5000;
    w.supplies = 5000;
    w.unlocked.add('vehicleBay');
    const bc = w.map.baseCells;
    let bay = null;
    for (let y = bc.y; y < bc.y + bc.h && !bay; y++) for (let x = bc.x; x < bc.x + bc.w && !bay; x++) if (!w.canPlace('vehicleBay', { x, y })) bay = w.addStructure('vehicleBay', { x, y }, true);
    g.selectStructure(bay.id);
    g.renderer.rig.focus(bay.pos);
  });
  await p.waitForTimeout(500);
  const panel = await p.evaluate(() => document.body.innerText.match(/Vehicle Bay · Build vehicles[\s\S]{0,120}/i)?.[0] ?? '');
  ok(/Humvee/.test(panel), `the Vehicle Bay's panel offers the Humvee ("${panel.replace(/\n/g, ' ').slice(0, 70)}")`);
  await p.click('[data-act="produce:humvee"]');
  await p.evaluate(() => (window.game.speed = 4));
  await p.waitForFunction(() => window.game.world.squads.some((s) => s.def.id === 'humvee'), null, { timeout: 60000 });
  await p.evaluate(() => (window.game.speed = 1));
  await p.waitForTimeout(600);
  const drawn = await p.evaluate(() => {
    const g = window.game;
    const hv = g.world.squads.find((s) => s.def.id === 'humvee');
    const o = g.renderer.vehicles.views.get(hv.id);
    let tris = 0;
    o?.traverse((m) => m.isMesh && (tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3));
    return { name: hv.name, tris };
  });
  ok(drawn.tris > 1000, `"${drawn.name}" is built and drawn with the owner's Humvee (${drawn.tris} triangles)`);

  // a rifle squad right-clicks it and climbs in
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    const hv = w.squads.find((s) => s.def.id === 'humvee');
    const r = w.squads.find((s) => s.def.id === 'rifle');
    window.__r = r.id;
    window.__hv = hv.id;
    r.pos.x = hv.pos.x + 8;
    r.pos.y = hv.pos.y;
    for (const m of r.members) (m.pos.x = r.pos.x), (m.pos.y = r.pos.y);
    g.select([r.id]);
    g.commandAt(hv.pos, false);
  });
  const order = await p.evaluate(() => window.game.world.squads.find((s) => s.id === window.__r).currentOrder?.type);
  ok(order === 'board', `right-clicking the Humvee with a rifle squad: they go to board (${order})`);
  await p.waitForFunction(() => window.game.world.squads.find((s) => s.id === window.__r).inVehicle != null, null, { timeout: 20000 });
  await p.waitForTimeout(500);
  const inside = await p.evaluate(() => {
    const g = window.game;
    const r = g.world.squads.find((s) => s.id === window.__r);
    const crowd = g.renderer.crowds;
    const label = [...document.querySelectorAll('.squad-label')].some((e) => e.style.display !== 'none' && e.innerText.includes(r.name));
    g.select([window.__hv]);
    return { label, card: '' };
  });
  ok(!inside.label, 'the squad inside has no label on the map (hidden while riding)');
  await p.waitForTimeout(400);
  const card = await p.evaluate(() => document.body.innerText.match(/Aboard: [^\n]*/)?.[0] ?? '');
  ok(/Aboard/.test(card), `the Humvee's card says who's aboard ("${card}")`);
  ok(!!(await p.$('[data-act="unload"]')), 'an Unload button');
  ok(!(await p.$('[data-act="crouch"]')), 'no Crouch button for a vehicle');
  await p.keyboard.press('u');
  const out = await p.evaluate(() => {
    const w = window.game.world;
    const r = w.squads.find((s) => s.id === window.__r);
    const hv = w.squads.find((s) => s.id === window.__hv);
    return { rider: r.inVehicle, cargo: hv.cargo, d: Math.hypot(r.pos.x - hv.pos.x, r.pos.y - hv.pos.y) };
  });
  ok(out.rider == null && out.cargo == null && out.d > 1, `U unloads them beside it (${out.d.toFixed(1)} m away)`);

  // its gun
  const shots = await p.evaluate(async () => {
    const g = window.game, w = g.world;
    const hv = w.squads.find((s) => s.id === window.__hv);
    w.issueOrder([hv], { type: 'hold', pos: { ...hv.pos } });
    const z = w.spawnZombie('walker', { x: hv.pos.x - 20, y: hv.pos.y + 4 });
    z.hp = z.maxHp = 1e6;
    let n = 0;
    w.events.on('shot', (e) => e.shooter === hv.id && n++);
    // (round 19 #231: the turret comes round first; the headless game runs slower than real time)
    await new Promise((r) => setTimeout(r, 5000));
    return n;
  });
  ok(shots > 3, `its mounted MG fires (${shots} shots in 5 s, after its turret comes round)`);
  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' / ') : ''}`);
  await b.close();
})();
