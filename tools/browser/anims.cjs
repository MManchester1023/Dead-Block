// Which animation the game plays in each situation (v4.55, round 14 uploads): crouch walk, kneeling fire,
// standing up from a crouch, the crouched death, climbing a guard tower up and down, the civilians' idle
// and run; plus the MG emplacement's firing loop. Records every clip the crowds draw. Prints checks.
//   node tools/browser/anims.cjs
const { launch, watchErrors, startGame } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = watchErrors(p);
  await startGame(p);
  await p.keyboard.press('Shift'); // unlock audio
  // record the clips drawn per crowd
  await p.evaluate(() => {
    window.__clips = {};
    const crowds = window.game.renderer.crowds.crowds;
    for (const [k, c] of Object.entries(crowds)) {
      const add = c.add.bind(c);
      c.add = (clip, ...a) => ((window.__clips[`${k}:${clip}`] = (window.__clips[`${k}:${clip}`] || 0) + 1), add(clip, ...a));
    }
    const g = window.game;
    g.paused = false;
    g.speed = 2;
    for (const z of g.world.zombies) z.alive = false;
  });
  const seen = (k) => p.evaluate((k) => (window.__clips[k] || 0) > 0, k);
  const reset = () => p.evaluate(() => (window.__clips = {}));
  const waitFor = (k, ms = 60000) => p.waitForFunction((k) => (window.__clips[k] || 0) > 0, k, { timeout: ms }).then(() => true).catch(() => false);

  // crouch walk
  await p.evaluate(() => {
    const w = window.game.world, s = w.squads.find((q) => q.def.id === 'rifle');
    window.game.renderer.rig.focus(s.pos);
    w.toggleCrouch([s]);
    w.issueOrder([s], { type: 'move', pos: { x: s.pos.x + 25, y: s.pos.y } });
    window.__s = s.id;
  });
  ok(await waitFor('soldier:crouchWalk'), 'a crouched squad on the move crouch-walks');
  // kneeling fire: crouched, a zombie in range
  await p.evaluate(() => {
    const w = window.game.world, s = w.squads.find((q) => q.id === window.__s);
    s.orders = [];
    const z = w.spawnZombie('walker', { x: s.pos.x + 15, y: s.pos.y });
    z.def = { ...z.def, speed: 0, hp: 9999 };
    z.hp = z.maxHp = 9999;
    window.__z = z.id;
  });
  ok(await waitFor('soldier:crouchShoot'), 'a crouched squad fires kneeling');
  // stand up: G again while the zombie is gone
  await reset();
  await p.evaluate(() => {
    const w = window.game.world, s = w.squads.find((q) => q.id === window.__s);
    w.get(window.__z).alive = false;
    w.toggleCrouch([s]);
  });
  ok(await waitFor('soldier:standUp'), 'standing up from the crouch plays the stand-up');
  // crouched death
  await p.evaluate(() => {
    const w = window.game.world, s = w.squads.find((q) => q.id === window.__s);
    w.toggleCrouch([s]);
  });
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    const w = window.game.world, s = w.squads.find((q) => q.id === window.__s);
    w.damageSquad(s, (s.poolMax / s.members.length) * 1.5, 'melee'); // crouching takes 22.5% off
  });
  ok(await waitFor('soldier:deathCrouch'), 'a soldier killed while crouched falls with the crouched death');
  // guard tower climb
  const climbed = await p.evaluate(() => {
    const w = window.game.world, g = window.game;
    w.unlocked.add('guardTower');
    const s = w.squads.filter((q) => q.def.id === 'rifle')[1];
    const t = w.addStructure('guardTower', { x: Math.floor(s.pos.x / 3) + 3, y: Math.floor(s.pos.y / 3) }, true);
    g.renderer.rig.focus(s.pos);
    return !w.orderGarrison || w.orderGarrison([s], t) === null;
  });
  ok(climbed, 'a squad sent up a guard tower');
  ok(await waitFor('soldier:climbUp'), 'climbing up plays the climb');
  // civilians: idle and run
  await p.evaluate(() => {
    const w = window.game.world, s = w.squads[0];
    const cp = w.structures.find((x) => x.def.id === 'commandPost');
    const c = w.findCivilians(s, w.map.buildings[0], { x: cp.pos.x + 40, y: cp.pos.y + 10 });
    window.game.renderer.rig.focus(c.pos);
    window.__c = c.id;
  });
  ok(await waitFor('civilian:idle'), 'survivors stand with the breathing idle');
  await p.evaluate(() => {
    const w = window.game.world, c = w.squads.find((q) => q.id === window.__c);
    w.issueOrder([c], { type: 'move', pos: { x: c.pos.x - 30, y: c.pos.y } });
  });
  ok(await waitFor('civilian:walk'), 'survivors on the move run (Slow Run as their walk)');
  // MG emplacement firing loop
  const mg = await p.evaluate(async () => {
    const w = window.game.world;
    const s = w.squads[0];
    const nest = w.addStructure('mgNest', { x: Math.floor(s.pos.x / 3) + 6, y: Math.floor(s.pos.y / 3) + 6 }, true, false, 0);
    window.game.renderer.rig.focus(nest.pos);
    const z = w.spawnZombie('walker', { x: nest.pos.x + 20, y: nest.pos.y });
    z.def = { ...z.def, speed: 0 };
    z.hp = z.maxHp = 9999;
    await new Promise((r) => setTimeout(r, 4000));
    return window.sound.mgs.size;
  });
  ok(mg > 0, `an MG emplacement firing plays its burst loop (${mg})`);
  console.log(errs.join('\n') || 'no page errors');
  await b.close();
})();
