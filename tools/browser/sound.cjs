// Sound wiring in the real game (v4.38): every clip decodes, the ambience beds start, a working engineer
// crew gets its construction loop (and loses it when done), HUD buttons click, soldier deaths play.
// Can't listen in a headless browser, so it checks the audio graph, not what it sounds like.
//   node tools/browser/sound.cjs
const { launch, watchErrors, startGame } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = watchErrors(p);
  await startGame(p);
  await p.keyboard.press('Shift'); // a key press unlocks audio
  await p.waitForFunction(() => {
    const s = window.sound;
    return s && s.buffers.radio?.length === 8 && s.buffers.human?.length === 3 && s.buffers.click?.length === 1 && s.loops.build_loop && s.loops.footsteps_loop && s.ambience.length >= 2;
  }, null, { timeout: 60000 }).catch(() => {});
  const st = await p.evaluate(() => {
    const s = window.sound;
    return { radio: s.buffers.radio?.length ?? 0, human: s.buffers.human?.length ?? 0, click: s.buffers.click?.length ?? 0, build: !!s.loops.build_loop, ambience: s.ambience.length };
  });
  ok(st.human === 3 && st.click === 1 && st.build && st.radio === 8, `clips decoded: 3 deaths ${st.human}, click ${st.click}, build loop ${st.build}, radio ${st.radio}/8`);
  ok(st.ambience === 2, `ambience beds playing: ${st.ambience} of 2 (suburban + horror)`);

  // footsteps under a squad on the move near the camera (v4.44)
  await p.evaluate(() => {
    const g = window.game, w = g.world, s = w.squads.find((q) => q.def.id === 'rifle');
    g.paused = false;
    g.renderer.rig.focus(s.pos);
    w.issueOrder([s], { type: 'move', pos: { x: s.pos.x, y: s.pos.y + 40 } });
    window.__walker = s.id;
  });
  await p.waitForFunction(() => window.sound.steps.has(window.__walker), null, { timeout: 60000 }).catch(() => {});
  ok(await p.evaluate(() => window.sound.steps.has(window.__walker)), 'a squad on the move near the camera has footsteps');
  await p.waitForFunction(() => !window.sound.steps.has(window.__walker), null, { timeout: 120000 }).catch(() => {});
  ok(await p.evaluate(() => !window.sound.steps.has(window.__walker)), 'the footsteps stop when it does');

  // engineers at a build site get a work loop; it goes away when they stop
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    g.paused = false;
    g.speed = 4;
    w.money = 9999;
    w.supplies = 9999;
    const eng = w.squads.find((s) => s.def.id === 'engineer');
    g.renderer.rig.focus(eng.pos);
    w.orderBuild([eng], 'sandbags', { x: Math.floor(eng.pos.x / 3) + 2, y: Math.floor(eng.pos.y / 3) + 2 });
    window.__eng = eng.id;
  });
  await p.waitForFunction(() => window.sound.work.size > 0, null, { timeout: 60000 }).catch(() => {});
  ok(await p.evaluate(() => window.sound.work.has(window.__eng)), 'a crew at work has its construction loop');
  await p.waitForFunction(() => window.sound.work.size === 0, null, { timeout: 120000 }).catch(() => {});
  ok(await p.evaluate(() => window.sound.work.size === 0), 'the loop stops when the job is done');

  // UI click and a soldier death go through play() (counted by wrapping it)
  await p.evaluate(() => {
    const s = window.sound;
    window.__played = [];
    const orig = s.play.bind(s);
    s.play = (bank, ...a) => (window.__played.push(bank), orig(bank, ...a));
    const g = window.game;
    g.select([g.world.squads[0].id]);
  });
  await p.waitForSelector('[data-act="hold"]');
  const box = await p.evaluate(() => { const r = document.querySelector('[data-act="hold"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.click(box.x, box.y);
  await p.evaluate(() => {
    const s = window.game.world.squads[0];
    window.game.world.damageSquad(s, s.poolMax / s.members.length + 1, 'melee');
  });
  await p.waitForTimeout(300);
  const played = await p.evaluate(() => window.__played);
  ok(played.includes('click'), 'a HUD button clicks');
  ok(played.includes('human'), 'a soldier going down plays a death');
  await p.evaluate(() => window.game.world.events.emit('radio', { speaker: 'Command', text: 'test', tone: 'info' }));
  ok((await p.evaluate(() => window.__played)).includes('radio'), 'a Command radio line plays chatter');

  // supply drop: the jet passes over, the chute opens; a hive dies with a wet blast (v4.39)
  await p.evaluate(() => {
    const g = window.game, w = g.world;
    g.paused = false;
    g.speed = 4;
    w.money = 9999;
    w.supplies = 9999;
    const s = w.squads[0];
    g.renderer.rig.focus(s.pos);
    g.setMode({ kind: 'support', id: 'supplyDrop' });
    g.callSupportAt({ x: s.pos.x + 20, y: s.pos.y });
  });
  await p.waitForFunction(() => window.__played.includes('chute'), null, { timeout: 120000 }).catch(() => {});
  const drop = await p.evaluate(() => window.__played);
  ok(drop.includes('flyby'), 'the supply plane plays its fly-by');
  ok(drop.includes('chute'), "the crate's parachute opens with a sound");
  await p.evaluate(() => {
    const w = window.game.world;
    const h = w.hives.find((x) => x.alive);
    window.game.renderer.rig.focus(h.pos);
    w.damageHive(h, 99999, 'explosive');
  });
  await p.waitForTimeout(300);
  ok((await p.evaluate(() => window.__played)).includes('hive'), 'a destroyed hive plays the mud blast');

  // the barbed wire model replaces the procedural wire
  const tris = await p.evaluate(async () => {
    const g = window.game, w = g.world;
    const st = w.addStructure('wire', { x: 20, y: 12 }, true);
    await new Promise((r) => setTimeout(r, 400));
    const view = g.renderer.structures.views.get(st.id);
    let n = 0;
    view?.traverse((o) => { if (o.isMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
    return n;
  });
  ok(tris > 3000 && tris < 4000, `barbed wire drawn with the model (${tris} triangles)`);

  console.log(errs.join('\n') || 'no page errors');
  await b.close();
})();
