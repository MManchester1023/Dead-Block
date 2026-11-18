// Convert Mixamo FBX animation clips to the compact .clip.json the game loads (src/render/clipFile.ts):
// the keyframes only, no skeleton or mesh, ~10x smaller. Paths are relative to public/; each output goes
// next to its FBX. Then point the character's clipFiles at the .clip.json and move the FBX to
// assets-src/models/mixamo/clips/. Check the result with tools/browser/bakecheck.cjs. Needs the dev server.
//   node tools/assets/convert-clips.cjs models/characters/soldier/reload.fbx [more.fbx …]
const fs = require('fs');
const path = require('path');
const { ROOT, URL, launch } = require('../browser/lib.cjs');

(async () => {
  const files = process.argv.slice(2);
  if (!files.length) return console.log('usage: node tools/assets/convert-clips.cjs models/characters/<who>/<clip>.fbx …');
  const b = await launch();
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`${URL}/dev-clips.html?files=${files.join(',')}`);
  await p.waitForFunction(() => document.title === 'ready', null, { timeout: 120000 });
  const out = await p.evaluate(() => window.__out);
  for (const [f, j] of Object.entries(out)) {
    const src = path.join(ROOT, 'public', f);
    const dst = src.replace(/\.fbx$/i, '.clip.json');
    fs.writeFileSync(dst, JSON.stringify(j));
    console.log(`${f}: ${fs.statSync(src).size} → ${fs.statSync(dst).size} bytes (${j.tracks.length} tracks)`);
  }
  await b.close();
})();
