// Round 16 fixes (v4.74) in the real game: no flash for a Bloater bursting (#192), duller cars (#193), hive
// labels only on hover (#195), the power card instead of a pausing dialog (#194). Prints ok/FAIL per check.
//   node tools/browser/round16.cjs
const { launch, watchErrors, startGame } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 850 } });
  const errs = watchErrors(p);
  await startGame(p);
  await p.waitForTimeout(1500);

  // #192: toxic burst = no flash sprite; a real explosion still flashes
  const fx = await p.evaluate(async () => {
    const g = window.game;
    const sprites = () => {
      let n = 0;
      g.renderer.scene.traverse((o) => o.isSprite && n++);
      return n;
    };
    const s0 = sprites();
    g.world.events.emit('explosion', { pos: { x: 100, y: 100 }, radius: 3, type: 'toxic' });
    await new Promise((r) => requestAnimationFrame(r));
    const toxic = sprites() - s0;
    g.world.events.emit('explosion', { pos: { x: 110, y: 100 }, radius: 3, type: 'blast' });
    await new Promise((r) => requestAnimationFrame(r));
    return { toxic, blast: sprites() - s0 - toxic };
  });
  ok(fx.toxic === 0, `a Bloater bursting makes no flash (${fx.toxic} flash sprites)`);
  ok(fx.blast >= 1, `a real explosion still flashes (${fx.blast})`);

  // #193: cars toned down: compare a drawn car's colours with a freshly loaded copy of its model
  const cars = await p.evaluate(async () => {
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const man = await (await fetch('/models/manifest.json')).json();
    const fresh = (await new GLTFLoader().loadAsync('/models/' + man.car1.url)).scene;
    let a = null;
    fresh.traverse((o) => o.isMesh && !a && (a = o.geometry.attributes.color));
    let drawn = null;
    window.game.renderer.scene.traverse((o) => {
      if (o.isMesh && !drawn && o.geometry.attributes.color && o.geometry.attributes.color.count === a.count) drawn = o.geometry.attributes.color;
    });
    const stats = (c) => {
      let sat = 0, lum = 0;
      for (let i = 0; i < c.count; i++) {
        const r = c.getX(i), g = c.getY(i), bb = c.getZ(i);
        sat += Math.max(r, g, bb) - Math.min(r, g, bb);
        lum += (r + g + bb) / 3;
      }
      return { sat: sat / c.count, lum: lum / c.count };
    };
    return drawn ? { before: stats(a), after: stats(drawn) } : null;
  });
  ok(!!cars && cars.after.sat < cars.before.sat * 0.75 && cars.after.lum < cars.before.lum * 0.9,
    cars ? `cars are duller (saturation ${cars.before.sat.toFixed(3)} → ${cars.after.sat.toFixed(3)}, brightness ${cars.before.lum.toFixed(3)} → ${cars.after.lum.toFixed(3)})` : 'cars: no drawn car found');

  // #195: hive label only on hover (moving the mouse over it)
  const sp = await p.evaluate(async () => {
    const g = window.game, w = g.world;
    const h = w.hives.find((x) => x.alive);
    g.renderer.rig.focus(h.pos);
    await new Promise((r) => setTimeout(r, 600));
    return g.renderer.worldToScreen(h.pos);
  });
  await p.mouse.move(20, 450);
  await p.waitForTimeout(400);
  const vis = () => p.evaluate(() => ({ n: [...document.querySelectorAll('.hive-label')].filter((e) => e.style.display !== 'none' && e.innerText.trim()).length, txt: [...document.querySelectorAll('.hive-label')].map((e) => e.innerText).join(' ') }));
  const idle = (await vis()).n;
  await p.mouse.move(sp.x, sp.y);
  await p.waitForTimeout(500);
  const hv = await vis();
  const hive = { idle, hovered: hv.n, txt: hv.txt };
  await p.mouse.move(20, 450);
  ok(hive.idle === 0, 'no hive label until hovered');
  ok(hive.hovered === 1 && /stage/.test(hive.txt), `hovering shows it ("${hive.txt.replace(/\n/g, ' ').slice(0, 60)}")`);

  // #194: the power card, no pause
  const power = await p.evaluate(async () => {
    const g = window.game;
    g.world.events.emit('powerRestored', { id: 0, first: true });
    await new Promise((r) => setTimeout(r, 300));
    return { card: document.querySelector('.hud-card')?.innerText ?? '', paused: g.paused, modal: !!document.querySelector('.modal.open') };
  });
  ok(/POWER RESTORED/.test(power.card) && /Vehicle Bay/.test(power.card) && !power.paused && !power.modal, 'power on: a card (Vehicle Bay, Y), no pause');
  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' / ') : ''}`);
  await b.close();
})();
