// Round 17 (v4.80) in the real game: trees drawn in batches (draw calls), the Humvee's turret turning to a
// target, its drive-off sound only zoomed in and close, its idle only up close, and the ground under a shop
// matching what's around it. Prints ok/FAIL per check.
//   node tools/browser/round17.cjs
const { launch, watchErrors, startGame } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = watchErrors(p);
  await startGame(p);
  await p.waitForTimeout(2500);

  // #209: trees in batches
  const trees = await p.evaluate(() => {
    const r = window.game.renderer;
    let batches = 0, instances = 0, single = 0;
    r.scene.traverse((o) => {
      if (o.isInstancedMesh && o.userData.instancedShared) (batches++, (instances += o.count));
      else if (o.isMesh && o.material?.alphaTest > 0) single++;
    });
    return { batches, instances, single, calls: r.drawInfo.calls };
  });
  ok(trees.batches > 0 && trees.single === 0, `trees drawn in batches: ${trees.batches} batched meshes holding ${trees.instances} tree parts, ${trees.single} single ones`);
  ok(trees.calls < trees.instances / 2, `draw calls in the opening view: ${trees.calls} for everything, with ${trees.instances} tree parts in view (one by one they'd be ${trees.instances}+ on their own, more with shadows)`);

  // a Humvee in the base, camera on it, zoomed in
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    for (const z of w.zombies) z.alive = false;
    for (const h of w.hives) (h.spawnTimer = 1e9), (h.pulseTimer = 1e9);
    const r = w.squads.find((s) => s.def.id === 'rifle');
    const hv = w.spawnSquad('humvee', w.grid.nearestFree({ x: r.pos.x + 6, y: r.pos.y }));
    hv.facing = 0;
    w.issueOrder([hv], { type: 'hold', pos: { ...hv.pos } });
    window.__hv = hv.id;
    g.renderer.rig.focus(hv.pos);
    g.renderer.rig.zoom = 4;
  });
  await p.waitForTimeout(1200);

  // #202: the turret turns to a target behind it, then back to the front
  const tur = await p.evaluate(async () => {
    const g = window.game, w = g.world;
    const hv = w.squads.find((s) => s.id === window.__hv);
    const t = g.renderer.vehicles.turrets.get(hv.id);
    if (!t) return null;
    const a0 = t.angle;
    const z = w.spawnZombie('walker', { x: hv.pos.x - 15, y: hv.pos.y + 2 });
    z.hp = z.maxHp = 1e6;
    z.def = { ...z.def, speed: 0, sight: 0, hearing: 0 };
    // (headless frames are slow and each is capped at 0.1 s, so wait for it to settle rather than a fixed time)
    for (let i = 0; i < 100 && Math.abs(Math.abs(t.angle) - Math.PI) > 0.3; i++) await new Promise((r) => setTimeout(r, 100));
    const aimed = t.angle;
    z.alive = false;
    for (let i = 0; i < 100 && Math.abs(t.angle) > 0.05; i++) await new Promise((r) => setTimeout(r, 100));
    return { a0, aimed, back: t.angle };
  });
  ok(!!tur, 'the Humvee has a separate turret');
  if (tur) {
    ok(Math.abs(Math.abs(tur.aimed) - Math.PI) < 0.35, `it turns to a target behind it (${tur.a0.toFixed(2)} → ${tur.aimed.toFixed(2)} rad, the hull stays put)`);
    ok(Math.abs(tur.back) < 0.1, `and back to the front when there's nothing (${tur.back.toFixed(2)} rad)`);
  }

  // #207: drive-off sound zoomed in and close; nothing zoomed out
  const drive = await p.evaluate(async () => {
    const g = window.game, w = g.world;
    const s = window.sound;
    const hv = w.squads.find((x) => x.id === window.__hv);
    const send = async (zoom) => {
      g.renderer.rig.zoom = zoom;
      g.renderer.rig.focus(hv.pos);
      await new Promise((r) => setTimeout(r, 400));
      const before = s.playing.drive;
      w.issueOrder([hv], { type: 'move', pos: w.grid.nearestFree({ x: hv.pos.x + 12, y: hv.pos.y }) });
      await new Promise((r) => setTimeout(r, 150));
      return s.playing.drive - before;
    };
    const far = await send(1.6);
    await new Promise((r) => setTimeout(r, 4500));
    const near = await send(4);
    return { far, near };
  });
  ok(drive.near > 0, 'telling it where to go, zoomed in: the drive-off sound plays');
  ok(drive.far === 0, 'zoomed out (the default view): no drive-off sound');

  // #201: idle loop only up close
  const idle = await p.evaluate(async () => {
    const g = window.game, s = window.sound;
    const hv = g.world.squads.find((x) => x.id === window.__hv);
    g.renderer.rig.zoom = 4;
    g.renderer.rig.focus(hv.pos);
    await new Promise((r) => setTimeout(r, 1500));
    const near = s.idles.get(hv.id)?.g.gain.value ?? -1;
    g.renderer.rig.focus({ x: hv.pos.x + 80, y: hv.pos.y });
    await new Promise((r) => setTimeout(r, 1500));
    const far = s.idles.get(hv.id)?.g.gain.value ?? -1;
    return { near, far };
  });
  ok(idle.near > 0.1 && idle.far < 0.02, `engine idle heard up close (${idle.near.toFixed(2)}), not 80 m away (${idle.far.toFixed(3)})`);

  // #205: ground under a non-house building is painted like its surroundings
  const ground = await p.evaluate(async () => {
    const { paintGround } = await import('/src/render/procgen/ground.ts');
    const w = window.game.world, m = w.map;
    const b = m.buildings.find((x) => x.kind === 'shop');
    const cell = m.cell;
    const win = { x: b.rect.x - cell * 2, y: b.rect.y - cell * 2, w: b.rect.w + cell * 4, h: b.rect.h + cell * 4 };
    const cv = paintGround(m, win, 2);
    const g = cv.getContext('2d');
    const at = (x, y) => Array.from(g.getImageData(Math.round((x - win.x) * 2), Math.round((y - win.y) * 2), 1, 1).data.slice(0, 3));
    const inside = at(b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h / 2);
    return { inside, grey: inside.every((v, i) => Math.abs(v - [96, 96, 92][i]) < 12) };
  });
  ok(!ground.grey, `ground under a shop isn't the old flat grey (rgb ${ground.inside.join(', ')})`);
  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' / ') : ''}`);
  await b.close();
})();
