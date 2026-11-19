// STATUS #47: where the frame time goes in a busy scene. Spawns a crowd heading for the base in view, runs a
// few seconds with Chrome's CPU profiler on, and prints the game's own readout (sim / scene / draw / hud per
// frame) plus the hottest functions. No GPU here (software rendering), so `draw` is not representative;
// sim and scene are real CPU work.
//   node tools/browser/perf.cjs [zombies=400] [seconds=8]
const { launch, startGame } = require('./lib.cjs');

(async () => {
  const n = Number(process.argv[2] ?? 400);
  const secs = Number(process.argv[3] ?? 8);
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await startGame(p);
  await p.evaluate((n) => {
    const g = window.game, w = g.world;
    const sq = w.squads.find((s) => s.def.id === 'rifle');
    g.renderer.rig.focus(sq.pos);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 35 + (i % 7) * 4;
      const z = w.spawnZombie(i % 5 ? 'walker' : 'runner', { x: sq.pos.x + Math.cos(a) * r, y: sq.pos.y + Math.sin(a) * r });
      if (z) {
        z.targetId = sq.id;
        z.state = 'chase';
        z.aggro = 60;
      }
    }
    for (const s of w.squads) s.pool = s.poolMax = 1e6; // nobody dies: keep the fight going
  }, n);
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await p.waitForTimeout(1500);
  await cdp.send('Profiler.start');
  const frames = await p.evaluate(async (secs) => {
    const out = [];
    const t0 = performance.now();
    while (performance.now() - t0 < secs * 1000) {
      await new Promise((r) => setTimeout(r, 250));
      const P = window.game.perf;
      out.push({ ...P });
    }
    return out;
  }, secs);
  const { profile } = await cdp.send('Profiler.stop');
  const avg = (k) => frames.reduce((a, f) => a + f[k], 0) / frames.length;
  const alive = await p.evaluate(() => window.game.world.zombies.filter((z) => z.alive).length);
  const d = await p.evaluate(() => window.game.renderer.drawInfo);
  console.log(`${alive} zombies alive · ${d.calls} draw calls · ${(d.triangles / 1000).toFixed(0)}k triangles`);
  console.log(`per frame (ms): sim ${avg('sim').toFixed(1)} · scene ${avg('scene').toFixed(1)} · draw ${avg('draw').toFixed(1)} · hud ${avg('hud').toFixed(1)} · frame ${avg('frame').toFixed(1)} (${avg('fps').toFixed(0)} fps here)`);
  // self time per function
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const dt = profile.timeDeltas;
  profile.samples.forEach((id, i) => {
    const node = byId.get(id);
    const f = node.callFrame;
    if (!f.url || /chrome-extension|node_modules\/\.vite\/deps\/three/.test(f.url) && false) return;
    const key = `${f.functionName || '(anon)'} ${f.url.replace(/^.*\/(src|node_modules)\//, '$1/').replace(/\?.*$/, '')}:${f.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0));
  });
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  console.log('hottest (self time):');
  for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 22)) console.log(`  ${((v / total) * 100).toFixed(1).padStart(5)}%  ${k}`);
  await b.close();
})();
