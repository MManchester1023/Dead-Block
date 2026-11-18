// Round 14 in the real game (v4.51): every squad under the cursor shows its label, stacked (#178); the
// Barracks queue groups "Rifle Squad ×3" (#173); the Districts panel has no pulse countdown or "cooling
// down" (#165, #179); the radio says "Horde wave" (#168). Prints checks and page errors.
//   node tools/browser/round14.cjs
const { launch, watchErrors, startGame } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = watchErrors(p);
  await startGame(p);

  // two squads on the same spot: hovering shows both labels, one above the other
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    const [a, b2] = w.squads.filter((s) => s.def.id === 'rifle');
    b2.pos.x = a.pos.x + 0.5;
    b2.pos.y = a.pos.y;
    for (const m of b2.members) (m.pos.x = b2.pos.x), (m.pos.y = b2.pos.y);
    g.renderer.rig.focus(a.pos);
    window.__a = a.id;
  });
  await p.waitForTimeout(400);
  const at = await p.evaluate(() => window.game.renderer.worldToScreen(window.game.world.squads.find((s) => s.id === window.__a).pos));
  await p.mouse.move(at.x, at.y);
  await p.waitForTimeout(500);
  const labels = await p.evaluate(() => [...document.querySelectorAll('.squad-label')].filter((e) => e.style.display !== 'none').map((e) => ({ t: e.querySelector('.sname')?.textContent, top: e.getBoundingClientRect().top })));
  const tops = labels.map((l) => Math.round(l.top));
  ok(labels.length === 2 && Math.abs(tops[0] - tops[1]) >= 20, `two squads on one spot both show their labels, stacked (${labels.map((l) => l.t).join(', ')}; tops ${tops.join(', ')})`);

  // Barracks queue: three rifle squads → one line "×3"
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    w.money = 9999;
    w.supplies = 9999;
    w.commandCap = 99;
    for (let i = 0; i < 3; i++) w.queueProduction('rifle');
    g.selectStructure(w.structures.find((s) => s.def.id === 'barracks').id);
  });
  await p.waitForTimeout(500);
  const q = await p.evaluate(() => [...document.querySelectorAll('.qitem')].map((e) => e.textContent.trim()));
  ok(q.length === 1 && /×3/.test(q[0]), `Barracks queue: ${JSON.stringify(q)}`);

  // Districts panel: no pulse countdown, no "cooling down"
  await p.evaluate(() => {
    const d = window.game.world.districts.get('motel');
    d.noiseLockUntil = window.game.world.time + 40;
  });
  await p.waitForTimeout(500);
  const panel = await p.evaluate(() => document.body.innerText);
  ok(!/next pulse/i.test(panel) && !/cooling down/i.test(panel), 'no pulse countdown or "cooling down" in the HUD');

  // radio naming
  const said = await p.evaluate(() => {
    const out = [];
    const w = window.game.world;
    w.events.on('radio', (e) => out.push(e.text));
    w.events.emit('hordePulse', { districtId: 'motel', size: 12, target: { x: 0, y: 0 } });
    return window.hud.radio.lines.slice(-1)[0]?.text ?? '';
  });
  ok(/Horde wave/.test(said), `radio: "${said}"`);

  console.log(errs.join('\n') || 'no page errors');
  await b.close();
})();
