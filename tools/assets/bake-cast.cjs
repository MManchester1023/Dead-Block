// Pre-bake the characters (STATUS #15, v4.47): bakes the whole cast in a headless browser exactly as the
// game would, and writes public/models/baked/cast.bin, which the game loads instead of baking at launch.
// Re-run after changing any character model, animation clip, texture, gun model or gun fit, or the
// character settings in src/render/characters.ts (npm test fails while cast.bin is out of date).
// Needs the dev server: npx vite --port 5173 --strictPort
//   node tools/assets/bake-cast.cjs
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { launch, URL, ROOT } = require('../browser/lib.cjs');

/** Fingerprint of the files a bake reads (same as tests/castfile.test.ts computes). */
function sourcesHash(files) {
  const h = crypto.createHash('sha1');
  for (const f of files) {
    h.update(f);
    h.update(fs.readFileSync(path.join(ROOT, 'public', f)));
  }
  return h.digest('hex');
}

(async () => {
  const b = await launch();
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('page error:', e.message));
  await p.goto(URL + '/dev-bakecast.html');
  await p.waitForFunction(() => document.title === 'ready', null, { timeout: 120000 });
  const files = await p.evaluate(() => window.castSourceFiles());
  const sources = sourcesHash(files);
  const r = await p.evaluate((s) => window.bakeCast(s), sources);
  const out = path.join(ROOT, 'public/models/baked/cast.bin');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(r.b64, 'base64'));
  console.log(`baked ${files.length} source files in ${(r.ms / 1000).toFixed(1)} s → ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1e6).toFixed(2)} MB), key ${r.key}`);
  await b.close();
})();
