// "Did the characters change?" Bakes the whole cast exactly as the game does (dev-bakecheck.html) and
// fingerprints every pose of every clip (frame count, vertex positions, colours) to tools/out/bake-<tag>.json.
// With --compare <other> it reports any clip that differs. Use around asset or loader changes:
//   node tools/browser/bakecheck.cjs before   …change…   node tools/browser/bakecheck.cjs after --compare before
const fs = require('fs');
const path = require('path');
const { OUT, URL, launch } = require('./lib.cjs');

(async () => {
  const tag = process.argv[2] || 'latest';
  const other = process.argv.indexOf('--compare') > 0 ? process.argv[process.argv.indexOf('--compare') + 1] : null;
  const b = await launch();
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(URL + '/dev-bakecheck.html');
  await p.waitForFunction(() => document.title === 'ready', null, { timeout: 300000 });
  const out = await p.evaluate(() => window.__out);
  await b.close();
  fs.writeFileSync(path.join(OUT, `bake-${tag}.json`), JSON.stringify(out, null, 1));
  console.log(`${Object.keys(out).length} clips fingerprinted → tools/out/bake-${tag}.json`);
  if (!other) return;
  const a = JSON.parse(fs.readFileSync(path.join(OUT, `bake-${other}.json`), 'utf8'));
  let bad = 0;
  for (const k of new Set([...Object.keys(a), ...Object.keys(out)])) {
    const x = a[k], y = out[k];
    if (!x || !y) { console.log(`${k}: only in ${x ? other : tag}`); bad++; continue; }
    const pos = x.frames === y.frames && x.n === y.n && Math.abs(x.sum - y.sum) / Math.max(1, Math.abs(x.abs)) < 1e-6;
    const col = Math.abs(x.colors - y.colors) < 1e-3;
    if (!pos || !col) { bad++; console.log(`${k}: ${pos ? 'positions same' : 'POSITIONS DIFFER'}, ${col ? 'colours same' : `colours ${x.colors} → ${y.colors}`}`); }
  }
  console.log(bad ? `${bad} clip(s) differ` : 'identical');
})();
