// STATUS #59 (v4.81): the dev menu in the real game, through the keyboard and mouse: ` opens it, pick Runners ×10
// and click the map (they appear there, hunting), Shift+click keeps placing, a stage 2 hive by click, clear all
// zombies, +$1000, ` closes it. Round 18 #221 (v4.86): units (a Humvee, Shift+click Mortar Teams) and buildings
// (a finished Vehicle Bay, free, with nobody selected). Prints ok/FAIL per check.
//   node tools/browser/devmenu.cjs
const { launch, watchErrors, startGame } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = watchErrors(p);
  await startGame(p);
  await p.waitForTimeout(1200);
  const spot = await p.evaluate(() => {
    const g = window.game, w = g.world;
    for (const z of w.zombies) z.alive = false;
    for (const h of w.hives) (h.spawnTimer = 1e9), (h.pulseTimer = 1e9);
    // nobody shoots during the check (they'd kill the new arrivals and earn bounties, muddying the counts)
    for (const q of w.squads) q.def = { ...q.def, weapon: { ...q.def.weapon, damage: 0 } };
    const sq = w.squads.find((s) => s.def.id === 'rifle');
    const at = w.grid.nearestFree({ x: sq.pos.x + 25, y: sq.pos.y });
    g.renderer.rig.focus(at);
    window.__at = at;
    return at;
  });
  await p.waitForTimeout(500);
  const screen = await p.evaluate((at) => window.game.renderer.worldToScreen(at), spot);
  await p.mouse.move(700, 450);
  await p.keyboard.press('Backquote');
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => !!document.querySelector('.dev-panel') && document.querySelector('.dev-panel').style.display !== 'none'), 'the ` key opens the dev menu');
  await p.click('[data-act="devz:runner"]');
  await p.click('[data-act="devn:10"]');
  await p.click('[data-act="devplace:zombies"]');
  ok(await p.evaluate(() => window.game.mode.kind === 'dev'), 'Drop Runners: click-to-place mode');
  await p.mouse.click(screen.x, screen.y);
  const first = await p.evaluate(() => {
    const w = window.game.world, at = window.__at;
    const z = w.zombies.filter((x) => x.alive);
    return { n: z.length, runners: z.every((x) => x.def.id === 'runner'), near: z.every((x) => Math.hypot(x.pos.x - at.x, x.pos.y - at.y) < 8), hunting: z.every((x) => x.state === 'chase'), mode: window.game.mode.kind };
  });
  ok(first.n === 10 && first.runners && first.near, `a click drops 10 Runners where it was clicked (${first.n})`);
  ok(first.hunting, 'they hunt your squads (the default)');
  ok(first.mode === 'normal', 'a plain click places once and stops');
  await p.evaluate(() => {
    for (const z of window.game.world.zombies) z.alive = false;
  });
  await p.click('[data-act="devplace:zombies"]');
  await p.keyboard.down('Shift');
  await p.mouse.click(screen.x, screen.y);
  await p.mouse.click(screen.x + 40, screen.y);
  await p.keyboard.up('Shift');
  const shift = await p.evaluate(() => ({ n: window.game.world.zombies.filter((x) => x.alive).length, mode: window.game.mode.kind }));
  ok(shift.n === 20 && shift.mode === 'dev', `Shift+click keeps placing (${shift.n} after two clicks, still placing)`);
  await p.mouse.click(screen.x, screen.y, { button: 'right' });
  ok(await p.evaluate(() => window.game.mode.kind === 'normal'), 'right-click stops placing');

  // a hive
  await p.click('[data-act="devstage:2"]');
  await p.click('[data-act="devplace:hive"]');
  const hives0 = await p.evaluate(() => window.game.world.hives.length);
  await p.mouse.click(screen.x, screen.y + 60);
  const hive = await p.evaluate((n) => {
    const w = window.game.world;
    const h = w.hives[w.hives.length - 1];
    return { added: w.hives.length - n, stage: h.stage, district: h.districtId };
  }, hives0);
  ok(hive.added === 1 && hive.stage === 2, `a click places a stage 2 hive (in ${hive.district})`);

  // round 18 #221: units (free, placed as yours), including one that's not in the game yet
  const units = await p.$$eval('[data-act^="devunit:"]', (b) => b.map((x) => x.dataset.act.slice(8)));
  ok(units.includes('humvee') && units.includes('medic') && units.includes('mortar'), `a button for every friendly unit (${units.length})`);
  const money1 = await p.evaluate(() => window.game.world.money);
  await p.click('[data-act="devunit:humvee"]');
  ok(await p.evaluate(() => window.game.mode.kind === 'dev' && window.game.mode.what === 'unit'), 'Humvee: click-to-place mode');
  const n0 = await p.evaluate(() => window.game.world.squads.length);
  await p.mouse.click(screen.x - 60, screen.y + 30);
  const hv = await p.evaluate((n0) => {
    const w = window.game.world;
    const s = w.squads[w.squads.length - 1];
    return { added: w.squads.length - n0, id: s.def.id, mode: window.game.mode.kind };
  }, n0);
  ok(hv.added === 1 && hv.id === 'humvee' && hv.mode === 'normal', `a click drops a Humvee there (${hv.id})`);
  await p.click('[data-act="devunit:mortar"]');
  await p.keyboard.down('Shift');
  await p.mouse.click(screen.x - 90, screen.y - 30);
  await p.mouse.click(screen.x - 120, screen.y - 30);
  await p.keyboard.up('Shift');
  const mortars = await p.evaluate(() => window.game.world.squads.filter((s) => s.def.id === 'mortar').length);
  ok(mortars === 2, `Shift+click keeps placing (${mortars} Mortar Teams, a stand-in for now)`);
  await p.mouse.click(screen.x, screen.y, { button: 'right' });
  const money2 = await p.evaluate(() => window.game.world.money);
  ok(money2 > money1 - 50, `units are free ($${money1} → $${money2}: no $160 Humvee or $150 mortars taken; kill bounties and upkeep move it a little)`);

  // buildings: finished, free, locked or not, with nobody selected; the ghost and R work as in a normal build
  await p.evaluate(() => {
    const w = window.game.world;
    window.game.select([]);
    w.money = 0;
    w.supplies = 0;
    window.__bayLocked = !w.unlocked.has('vehicleBay');
    const b = w.map.baseCells, c = w.grid.cell;
    window.game.renderer.rig.focus({ x: (b.x + b.w / 2) * c, y: (b.y + b.h / 2) * c });
  });
  const builds = await p.$$eval('[data-act^="devbuild:"]', (b) => b.map((x) => x.dataset.act.slice(9)));
  ok(['sandbags', 'wire', 'mgNest', 'guardTower', 'vehicleBay', 'outpost'].every((id) => builds.includes(id)), `a button for every buildable structure (${builds.join(', ')})`);
  await p.click('[data-act="devbuild:vehicleBay"]');
  // find a spot in the base the Bay fits, on screen
  const spotB = await p.evaluate(() => {
    const g = window.game, w = g.world, b = w.map.baseCells, c = w.grid.cell;
    for (let y = b.y; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++) {
        const fp = w.footprint('vehicleBay', false);
        const pos = { x: (x + fp.w / 2) * c, y: (y + fp.h / 2) * c };
        const t = g.buildTile(pos, 'vehicleBay', false);
        if (w.canPlace('vehicleBay', t, false, true)) continue;
        g.renderer.rig.focus(pos);
        return pos;
      }
    return null;
  });
  await p.waitForTimeout(300);
  const sb = await p.evaluate((pos) => window.game.renderer.worldToScreen(pos), spotB);
  await p.mouse.move(sb.x, sb.y);
  await p.waitForTimeout(200);
  const ghost = await p.evaluate(() => ({ mode: window.game.mode, vis: window.game.renderer.ghost.group?.visible ?? window.game.renderer.ghost.aim.visible }));
  ok(ghost.mode.kind === 'build' && ghost.mode.dev, 'Vehicle Bay: placing with the ghost, no engineers selected, locked and no money');
  const s0 = await p.evaluate(() => window.game.world.structures.length);
  await p.mouse.click(sb.x, sb.y);
  const bay = await p.evaluate((s0) => {
    const w = window.game.world;
    const st = w.structures[w.structures.length - 1];
    return { added: w.structures.length - s0, id: st.def.id, built: st.built, money: w.money, mode: window.game.mode.kind, locked: window.__bayLocked };
  }, s0);
  ok(bay.added === 1 && bay.id === 'vehicleBay' && bay.built && bay.money <= 5 && bay.mode === 'normal', `a click places a finished Vehicle Bay, free${bay.locked ? ' (while still locked)' : ''}`);
  if (!(bay.added === 1 && bay.built)) console.log('     ', JSON.stringify({ bay, spotB, sb }));

  // the extras
  const m0 = await p.evaluate(() => window.game.world.money);
  await p.click('[data-act="devcash"]');
  ok((await p.evaluate(() => window.game.world.money)) - m0 === 1000, '+$1000');
  await p.click('[data-act="devclear"]');
  ok((await p.evaluate(() => window.game.world.zombies.filter((x) => x.alive).length)) === 0, 'Clear all zombies');
  await p.mouse.move(700, 450);
  await p.keyboard.press('Backquote');
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => document.querySelector('.dev-panel').style.display === 'none'), '` closes it again');
  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' / ') : ''}`);
  await b.close();
})();
