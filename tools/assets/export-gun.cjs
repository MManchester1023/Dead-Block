// Cut a character's own gun out of its model into a weapon GLB in the game's rifle frame (barrel +X,
// magazine -Z, colours baked per vertex), via dev-gunexport.html. Needs the dev server.
// 1) Without axes it only shows the extracted gun (side and top views) so you can read them off:
//      node tools/assets/export-gun.cjs "model=/assets-src/models/x.glb&meshes=Object_186"
// 2) With axes it writes the GLB (then fit it in dev-rifle.html, which saves the matching .json):
//      node tools/assets/export-gun.cjs "model=…&meshes=…&barrel=x&down=-y" public/models/weapons/scar.glb
// (round 10: scar.glb barrel=x down=-y; m4_kolos.glb barrel=-x down=-z; barrett.glb barrel=x down=-y)
const fs = require('fs');
const path = require('path');
const { ROOT, OUT, URL, launch } = require('../browser/lib.cjs');

(async () => {
  const [query, out] = process.argv.slice(2);
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1000, height: 500 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`${URL}/dev-gunexport.html?${query}`);
  await p.waitForFunction(() => document.title === 'ready', null, { timeout: 120000 });
  const o = await p.evaluate(() => window.__out);
  console.log(JSON.stringify({ size: o.size, triangles: o.tris }));
  await p.screenshot({ path: path.join(OUT, 'gun-export.png') });
  console.log('preview: tools/out/gun-export.png (left: side view, X right / Z up; right: top view, X right / Y up)');
  if (out && o.glb) {
    fs.writeFileSync(path.resolve(ROOT, out), Buffer.from(o.glb, 'base64'));
    console.log('wrote', out);
  }
  await b.close();
})();
