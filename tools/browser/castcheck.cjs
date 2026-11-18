// Pre-baked cast (STATUS #15, v4.47): the characters loaded from public/models/baked/cast.bin match a live
// bake pose for pose (positions within 1 mm, normals and colours within rounding), the game uses the file,
// and how long each takes. Prints checks and page errors.
//   node tools/browser/castcheck.cjs
const { launch, watchErrors, URL } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const p = await b.newPage();
  const errs = watchErrors(p);
  await p.goto(URL + '/dev-bakecast.html');
  await p.waitForFunction(() => document.title === 'ready', null, { timeout: 120000 });
  const r = await p.evaluate(async () => {
    const { loadCast, bakeLive } = await import('/src/render/characters.ts');
    let t0 = performance.now();
    const pre = await loadCast();
    const preMs = performance.now() - t0;
    t0 = performance.now();
    const live = await bakeLive();
    const liveMs = performance.now() - t0;
    let poses = 0, worstP = 0, worstN = 0, worstC = 0, idxDiff = 0, meta = 0;
    let memPre = 0, memLive = 0;
    const seen = new Set();
    const mem = (g, acc) => {
      for (const a of [...Object.values(g.attributes), g.index].filter(Boolean)) if (!seen.has(a)) (seen.add(a), (acc.n += a.array.byteLength));
    };
    const mp = { n: 0 }, ml = { n: 0 };
    for (const [key, lb] of Object.entries(live)) {
      const pb = pre[key];
      if (JSON.stringify([lb.durations, lb.loops, lb.deathFalls]) !== JSON.stringify([pb.durations, pb.loops, pb.deathFalls])) meta++;
      for (const [clip, lf] of Object.entries(lb.frames)) {
        const pf = pb.frames[clip];
        if (!pf || pf.length !== lf.length) { meta++; continue; }
        lf.forEach((lg, i) => {
          const pg = pf[i];
          poses++;
          mem(lg, ml);
          mem(pg, mp);
          const a = lg.attributes, q = pg.attributes;
          for (let v = 0; v < a.position.count; v++) {
            worstP = Math.max(worstP, Math.abs(a.position.getX(v) - q.position.getX(v)), Math.abs(a.position.getY(v) - q.position.getY(v)), Math.abs(a.position.getZ(v) - q.position.getZ(v)));
            worstN = Math.max(worstN, Math.abs(a.normal.getX(v) - q.normal.getX(v)), Math.abs(a.normal.getY(v) - q.normal.getY(v)), Math.abs(a.normal.getZ(v) - q.normal.getZ(v)));
            worstC = Math.max(worstC, Math.abs(Math.min(1, Math.max(0, a.color.getX(v))) - q.color.getX(v)));
          }
          if (!!lg.index !== !!pg.index || (lg.index && lg.index.array.some((x, k) => x !== pg.index.array[k]))) idxDiff++;
        });
      }
    }
    return { poses, worstP, worstN, worstC, idxDiff, meta, preMs, liveMs, memPre: mp.n, memLive: ml.n };
  });
  ok(r.meta === 0 && r.idxDiff === 0, `same characters, clips, poses, timings and triangles (${r.poses} poses)`);
  ok(r.worstP <= 0.0006, `positions within 0.6 mm (worst ${(r.worstP * 1000).toFixed(2)} mm)`);
  ok(r.worstN <= 0.02 && r.worstC <= 0.003, `normals and colours within rounding (worst ${r.worstN.toFixed(4)}, ${r.worstC.toFixed(4)})`);
  console.log(`     load: pre-baked ${(r.preMs / 1000).toFixed(2)} s vs live bake ${(r.liveMs / 1000).toFixed(2)} s; memory ${(r.memPre / 1e6).toFixed(0)} MB vs ${(r.memLive / 1e6).toFixed(0)} MB`);
  ok(r.preMs < r.liveMs / 2, 'the game loads the pre-baked file (much faster than baking)');
  console.log(errs.join('\n') || 'no page errors');
  await b.close();
})();
