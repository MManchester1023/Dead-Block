// A building/prop model → one small GLB for a structure (v4.72; see src/dev/propExport.ts): textures baked
// into vertex colours, simplified, fitted to a footprint in metres, listed in public/models/manifest.json
// under `key`. Needs the dev server: npx vite --port 5173 --strictPort
//   node tools/assets/export-prop.cjs <source.glb|.zip> <key> <widthM> <depthM> [triangles=3000] [node]
//   e.g. node tools/assets/export-prop.cjs assets-src/models/medical_tent.glb medTent 12 9
//        node tools/assets/export-prop.cjs assets-src/models/military_environment_buildings._modular.zip vehicleBay 15 12 3000 garage_2
//        node tools/assets/export-prop.cjs assets-src/models/low_poly_humvee.glb humvee 4.6 2.2 2500 --exclude=tube_33
//        node tools/assets/export-prop.cjs assets-src/models/low_poly_humvee.glb humveeTurret 4.6 2.2 800 --only=tube_33 --pivot=Object_50
// A .zip is a Sketchfab glTF download (scene.gltf + scene.bin + textures/); [node] picks one object out of it.
const fs = require('fs');
const path = require('path');
const { launch, URL, ROOT } = require('../browser/lib.cjs');

(async () => {
  const [src, key, w, d, tris = '3000', node] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  // round 17 #202: --only=<part> / --exclude=<part> split a model into pieces that line up; --pivot centres a piece
  const opt = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
  if (!src || !key || !w || !d) return console.log('usage: node tools/assets/export-prop.cjs <source.glb> <key> <widthM> <depthM> [triangles]');
  const tmp = path.join(ROOT, 'public/_tmp_prop');
  fs.mkdirSync(tmp, { recursive: true });
  let url = '/_tmp_prop/src.glb';
  if (/\.zip$/i.test(src)) {
    require('child_process').execSync(`unzip -q -o "${path.join(ROOT, src)}" -d "${tmp}"`);
    url = '/_tmp_prop/scene.gltf';
  } else fs.copyFileSync(path.join(ROOT, src), path.join(tmp, 'src.glb'));
  const b = await launch();
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('page error:', e.message));
  await p.goto(URL + '/dev-propexport.html');
  await p.waitForFunction(() => document.title === 'ready', null, { timeout: 120000 });
  const out = await p.evaluate((j) => window.exportProp(j), { url, w: Number(w), d: Number(d), tris: Number(tris), node, only: opt.only, exclude: opt.exclude, pivot: opt.pivot ? opt.pivot : 'pivot' in opt });
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  const dir = path.join(ROOT, 'public/models/props');
  fs.mkdirSync(dir, { recursive: true });
  const file = `${key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())}.glb`;
  fs.writeFileSync(path.join(dir, file), Buffer.from(out.b64, 'base64'));
  const manPath = path.join(ROOT, 'public/models/manifest.json');
  const man = JSON.parse(fs.readFileSync(manPath, 'utf8'));
  man[key] = { url: `props/${file}` };
  fs.writeFileSync(manPath, JSON.stringify(man, null, 2) + '\n');
  console.log(`${key}: ${out.srcTris} → ${out.tris} triangles, ${out.size.join(' × ')} m, props/${file} (${(fs.statSync(path.join(dir, file)).size / 1024).toFixed(0)} KB)${out.pivot ? `, pivot at x ${out.pivot[0]}, z ${out.pivot[1]}` : ''}`);
})();
