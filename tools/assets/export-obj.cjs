// One character of a GLB, in its T-pose, as an OBJ + MTL + textures zip for Mixamo's auto-rigger (Mixamo
// doesn't take .glb). Feet on the ground, 1.8 units tall, facing +Z. Leave guns out (`skip=` or `meshes=`):
// Mixamo would bend them; the game holds its own gun models. Needs the dev server.
//   node tools/assets/export-obj.cjs "model=/assets-src/models/x.glb&skip=Object_78,Object_80" rifleman
// → tools/out/rifleman_for_mixamo.zip. On Mixamo: upload, place the markers, Standard Skeleton, then
// download FBX Binary, T-pose, **With Skin** (a "Without Skin" download has no mesh).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { OUT, URL, launch } = require('../browser/lib.cjs');

(async () => {
  const [query, name = 'character'] = process.argv.slice(2);
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 600, height: 600 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`${URL}/dev-objexport.html?${query}`);
  await p.waitForFunction(() => document.title === 'ready', null, { timeout: 100000 });
  const o = await p.evaluate(() => window.__out);
  const dir = path.join(OUT, `${name}_obj`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'character.obj'), o.obj);
  fs.writeFileSync(path.join(dir, 'character.mtl'), o.mtl);
  for (const [k, v] of Object.entries(o.images)) fs.writeFileSync(path.join(dir, k), Buffer.from(v.split(',')[1], 'base64'));
  const zip = path.join(OUT, `${name}_for_mixamo.zip`);
  if (fs.existsSync(zip)) fs.unlinkSync(zip);
  execFileSync('zip', ['-q', '-9', '-j', zip, ...fs.readdirSync(dir).map((f) => path.join(dir, f))]);
  console.log(`${o.verts} vertices from ${o.parts.join(', ')}; textures: ${Object.keys(o.images).join(', ') || 'none'}`);
  console.log('wrote', path.relative(process.cwd(), zip));
  await b.close();
})();
