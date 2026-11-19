// STATUS #50 (v4.72) in the real game: the run-down Med Bay (the owner's tent, dark, labelled), the hospital in
// region 2 (label, roof cross), searching it through a right-click, the significant-buildings briefing,
// engineers repairing the Med Bay (medics unlock), and the Vehicle Bay after the power (Y, placed, built,
// the owner's garage). Prints ok/FAIL per check.
//   node tools/browser/landmarks.cjs
const { launch, watchErrors, startGame } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = watchErrors(p);
  await startGame(p);
  await p.waitForTimeout(1500);

  const bayInfo = await p.evaluate(() => {
    const g = window.game, w = g.world;
    const bay = w.structures.find((s) => s.def.id === 'medBay');
    g.renderer.rig.focus(bay.pos);
    const view = g.renderer.structures.views.get(bay.id);
    let tris = 0, dark = 1;
    view.traverse((o) => {
      if (o.isMesh) {
        tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
        dark = Math.min(dark, o.material.color.r);
      }
    });
    return { built: bay.built, tris, dark, model: window.game.renderer && tris > 1000 };
  });
  ok(!bayInfo.built, 'the Med Bay is in the base, run down');
  ok(bayInfo.model, `it's the owner's tent model (${bayInfo.tris} triangles)`);
  ok(bayInfo.dark < 0.5, `drawn dark while run down (colour ×${bayInfo.dark.toFixed(2)})`);
  await p.waitForTimeout(600);
  const lab = await p.evaluate(() => [...document.querySelectorAll('.struct-label')].map((e) => e.innerText).join(' | '));
  ok(/MED BAY · OUT OF ACTION/.test(lab) && /hospital/i.test(lab), `its label: "${lab.replace(/\n/g, ' ')}"`);

  await p.evaluate(() => {
    const g = window.game, w = g.world;
    w.unlockDistrict('gasStrip');
    for (const z of w.zombies) z.alive = false;
    for (const h of w.hives) (h.spawnTimer = 1e9), (h.pulseTimer = 1e9);
    const hb = w.map.buildings.find((x) => x.landmark === 'hospital');
    g.renderer.rig.focus({ x: hb.rect.x + hb.rect.w / 2, y: hb.rect.y + hb.rect.h / 2 });
    // a rifle squad at its door
    const sq = w.squads.find((s) => s.def.id === 'rifle');
    const door = w.grid.nearestFree({ x: hb.rect.x + hb.rect.w / 2, y: hb.rect.y + hb.rect.h + 2 });
    sq.pos.x = door.x;
    sq.pos.y = door.y;
    for (const m of sq.members) (m.pos.x = door.x), (m.pos.y = door.y);
    window.__sq = sq.id;
  });
  await p.waitForTimeout(800);
  // round 16 #194: a card at the side of the HUD, not a pausing dialog
  const regionBrief = await p.evaluate(() => ({ card: document.querySelector('.hud-card')?.innerText ?? '', modal: !!document.querySelector('.modal.open'), paused: window.game.paused }));
  ok(/NEW REGION OPEN/.test(regionBrief.card) && /Hospital/.test(regionBrief.card) && /red cross/.test(regionBrief.card), 'the region 2 card mentions the hospital (red cross on the roof)');
  ok(!regionBrief.modal && !regionBrief.paused, 'no pausing dialog: the game keeps running');
  await p.click('.hud-card [data-act="card-close"]');
  ok(!(await p.$('.hud-card')), '"Got it" closes the card');
  await p.waitForTimeout(800);
  ok(!(await p.$('.landmark-label')), 'no floating hospital label (round 16 #196)');
  const cross = await p.evaluate(() => {
    const w = window.game.world;
    const hb = w.map.buildings.find((x) => x.landmark === 'hospital');
    const ys = [];
    window.game.renderer.scene.traverse((o) => {
      if (o.isMesh && o.material?.color?.getHex?.() === 0xc8302a && Math.abs(o.position.x - (hb.rect.x + hb.rect.w / 2)) < 1 && o.position.y > 2) ys.push(o.position.y);
    });
    return { n: ys.length, y: Math.max(...ys), roof: hb.floors * 3.2 };
  });
  ok(cross.n === 2 && cross.y - cross.roof < 0.3, `a red cross on the roof itself (${cross.n} bars, ${(cross.y - cross.roof).toFixed(2)} m above the roof surface)`);
  const obj0 = await p.evaluate(() => document.querySelector('.objectives, #objectives, [class*=objectives]')?.innerText ?? document.body.innerText);

  // right-click the hospital with the squad selected → search; wait for the briefing
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    const hb = w.map.buildings.find((x) => x.landmark === 'hospital');
    g.select([window.__sq]);
    g.commandAt({ x: hb.rect.x + hb.rect.w / 2, y: hb.rect.y + hb.rect.h / 2 }, false);
    g.speed = 4;
  });
  const order = await p.evaluate(() => window.game.world.squads.find((s) => s.id === window.__sq).currentOrder?.type);
  ok(order === 'search', `right-clicking the hospital orders a search (${order})`);
  await p.waitForFunction(() => document.querySelector('.hud-card')?.innerText.includes('SIGNIFICANT BUILDING'), null, { timeout: 90000 });
  const brief = await p.evaluate(() => ({ text: document.querySelector('.hud-card').innerText, paused: window.game.paused, unlocked: window.game.world.unlocked.has('medBay') }));
  ok(/Hospital looted/i.test(brief.text) && /police and fire stations/i.test(brief.text) && /Med Bay/.test(brief.text), 'the significant-buildings card pops up (hospital → repair the Med Bay)');
  ok(!brief.paused && brief.unlocked, "it doesn't pause the game; the Med Bay can be repaired now");
  await p.click('.hud-card [data-act="card-close"]');
  await p.waitForTimeout(800);
  const after = await p.evaluate(() => ({ obj: document.body.innerText }));
  ok(/Repair the Med Bay/.test(after.obj), 'a new objective: repair the Med Bay');
  void obj0;

  // engineers right-click the Med Bay → repair → medics
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    const bay = w.structures.find((s) => s.def.id === 'medBay');
    const eng = w.squads.find((s) => s.def.id === 'engineer');
    g.select([eng.id]);
    g.commandAt(bay.pos, false);
    g.speed = 4;
  });
  await p.waitForFunction(() => window.game.world.structures.find((s) => s.def.id === 'medBay').built, null, { timeout: 120000 });
  const fixed = await p.evaluate(() => {
    const g = window.game, w = g.world;
    const bay = w.structures.find((s) => s.def.id === 'medBay');
    let c = 0;
    g.renderer.structures.views.get(bay.id).traverse((o) => o.isMesh && (c = Math.max(c, o.material.color.r)));
    return { medic: w.unlocked.has('medic'), colour: c };
  });
  ok(fixed.medic, 'engineers repaired the Med Bay: Medic Teams unlocked');
  await p.waitForTimeout(500);
  const fixedColour = await p.evaluate(() => {
    const g = window.game, w = g.world;
    const bay = w.structures.find((s) => s.def.id === 'medBay');
    let c = 0;
    g.renderer.structures.views.get(bay.id).traverse((o) => o.isMesh && (c = Math.max(c, o.material.color.r)));
    return c;
  });
  ok(fixedColour > 0.9, `full colour once repaired (×${fixedColour.toFixed(2)})`);

  // the Vehicle Bay: locked in the build bar until the power, then Y places it
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    g.speed = 1;
    const eng = w.squads.find((s) => s.def.id === 'engineer');
    g.select([eng.id]);
  });
  await p.waitForTimeout(400);
  const locked = await p.evaluate(() => [...document.querySelectorAll('.bb-row button, .build-bar button, [data-act^="build:"]')].map((e) => e.innerText).join(' | '));
  ok(/Vehicle Bay/.test(locked) && !/Med Bay/.test(locked), 'the build bar has the Vehicle Bay (and no Med Bay)');
  await p.evaluate(() => {
    const w = window.game.world;
    w.unlocked.add('vehicleBay');
    w.money = 5000;
    w.supplies = 5000;
  });
  await p.keyboard.press('y');
  const mode = await p.evaluate(() => window.game.mode);
  ok(mode.kind === 'build' && mode.defId === 'vehicleBay', `Y starts placing a Vehicle Bay (${JSON.stringify(mode)})`);
  const placed = await p.evaluate(() => {
    const g = window.game, w = g.world;
    const b = w.map.baseCells;
    for (let y = b.y; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++)
        if (!w.canPlace('vehicleBay', { x, y })) {
          g.setMode({ kind: 'normal' });
          const eng = w.squads.find((s) => s.def.id === 'engineer');
          const err = w.orderBuild([eng], 'vehicleBay', { x, y });
          g.speed = 4;
          return err;
        }
    return 'no room';
  });
  ok(placed === null, `engineers start a Vehicle Bay in the base (${placed ?? 'ok'})`);
  await p.waitForFunction(() => window.game.world.structures.some((s) => s.def.id === 'vehicleBay' && s.built), null, { timeout: 120000 });
  const vb = await p.evaluate(() => {
    const g = window.game, w = g.world;
    const s = w.structures.find((x) => x.def.id === 'vehicleBay');
    let tris = 0;
    g.renderer.structures.views.get(s.id).traverse((o) => o.isMesh && (tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3));
    return tris;
  });
  ok(vb > 400, `the Vehicle Bay is built, drawn with the owner's garage (${vb} triangles)`);
  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' / ') : ''}`);
  await b.close();
})();
