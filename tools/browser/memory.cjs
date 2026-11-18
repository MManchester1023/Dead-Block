// Load time and GPU memory of the baked character poses, per character and clip.
//   node tools/browser/memory.cjs        (v4.31: ~6.3 s headless, 91 MB)
const { URL, launch } = require('./lib.cjs');

(async () => {
  const b = await launch();
  const p = await b.newPage();
  const t0 = Date.now();
  await p.goto(URL + '/');
  await p.waitForSelector('[data-act=start]', { timeout: 300000 });
  console.log('load', ((Date.now() - t0) / 1000).toFixed(1), 's');
  console.log(
    await p.evaluate(() => {
      const crowds = window.game.renderer.crowds.crowds; // Renderer → CrowdLayer → Crowd per character
      const seen = new Set();
      const out = [];
      let total = 0;
      for (const [k, cr] of Object.entries(crowds)) {
        let bytes = 0;
        let frames = 0;
        let verts = 0;
        for (const fs of Object.values(cr.book.frames))
          for (const g of fs) {
            frames++;
            verts = g.attributes.position.count;
            for (const a of [...Object.values(g.attributes), g.index].filter(Boolean)) {
              if (seen.has(a.array)) continue;
              seen.add(a.array);
              bytes += a.array.byteLength;
            }
          }
        total += bytes;
        out.push(`${k}: ${frames} poses, ${verts} vertices each, ${(bytes / 1e6).toFixed(0)} MB (${Object.entries(cr.book.frames).map(([c, f]) => `${c} ${f.length}`).join(', ')})`);
      }
      return out.join('\n') + `\nTOTAL ${(total / 1e6).toFixed(0)} MB`;
    }),
  );
  await b.close();
})();
