// Round 20 (v4.91) UI in the real game: the dev menu's Settings switch is in devmenu.cjs; here the hospital
// line (vague, no red cross), no X left after a search, no per-soldier dots in a squad's label, and faint region
// borders on the ops map only. Prints ok/FAIL per check.
//   node tools/browser/round20.cjs
const { launch, watchErrors, startGame } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = watchErrors(p);
  await startGame(p);
  await p.waitForTimeout(1200);

  // #235: the hospital's briefing line
  const line = await p.evaluate(() => {
    const w = window.game.world;
    const b = w.map.buildings.find((x) => x.landmark === 'hospital');
    const d = w.districtAt({ x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h / 2 });
    return window.hud.landmarkLine(d.def.id);
  });
  ok(/something important left inside/.test(line) && !/red cross|Med Bay|equipment/i.test(line), `the hospital line is vague: "${line.replace(/<[^>]+>/g, '')}" (#235)`);

  // #236: a search leaves nothing on the ground
  const added = await p.evaluate(() => {
    const g = window.game, w = g.world;
    const b = w.map.buildings.find((x) => !x.landmark);
    const n0 = g.renderer.scene.children.length;
    w.events.emit('buildingSearched', { buildingId: b.id, pos: { x: b.rect.x - 1, y: b.rect.y }, found: 'supplies' });
    w.events.emit('buildingSearched', { buildingId: b.id, pos: { x: b.rect.x - 1, y: b.rect.y }, found: 'zombies' });
    return g.renderer.scene.children.length - n0;
  });
  ok(added === 0, `no X left by a search, either colour (${added} things added) (#236)`);

  // #240: a selected squad's label: health bar, no dots
  await p.evaluate(() => {
    const g = window.game;
    const r = g.world.squads.find((s) => s.def.id === 'rifle');
    g.select([r.id]);
    g.renderer.rig.focus(r.pos);
  });
  await p.waitForTimeout(500);
  // (labels show while the mouse is over the squad)
  const at = await p.evaluate(() => window.game.renderer.worldToScreen(window.game.world.squads.find((s) => s.def.id === 'rifle').pos));
  await p.mouse.move(at.x, at.y);
  await p.waitForTimeout(400);
  const lab = await p.evaluate(() => {
    const el = [...document.querySelectorAll('.squad-label')].find((e) => e.style.display !== 'none' && e.querySelector('.hpbar'));
    return el ? { pips: el.querySelectorAll('.pip').length, bar: !!el.querySelector('.hpbar') } : null;
  });
  ok(!!lab && lab.bar && lab.pips === 0, lab ? `a selected squad's label: health bar, ${lab.pips} dots (#240)` : 'no label seen');

  // #244: region borders on the ops map only
  const edges = await p.evaluate(async () => {
    const g = window.game;
    const find = () => g.renderer.scene.children.find((o) => o.isLineSegments && o.material.opacity < 0.5);
    const street = find()?.visible;
    g.renderer.rig.zoom = 0.4;
    await new Promise((r) => setTimeout(r, 400));
    const ops = find()?.visible;
    const strategic = g.renderer.rig.strategic;
    g.renderer.rig.zoom = 1.6;
    await new Promise((r) => setTimeout(r, 300));
    return { street, ops, strategic, back: find()?.visible, n: find()?.geometry.attributes.position.count / 2 };
  });
  ok(edges.ops === true && edges.strategic && edges.street === false && edges.back === false, `faint region borders on the ops map only (${edges.n} edges; shown zoomed out, hidden at street level) (#244)`);
  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' / ') : ''}`);
  await b.close();
})();
