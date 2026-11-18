// The owner's low-poly tree packs → one small GLB per tree/shrub (v4.58; see src/dev/treeExport.ts), in
// public/models/trees/, listed in public/models/manifest.json as tree1…N and shrub1…M (the street decor
// picks one per spot). Unzips the packs from assets-src/models/ into a temporary public folder.
// Needs the dev server: npx vite --port 5173 --strictPort
//   node tools/assets/export-trees.cjs
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { launch, URL, ROOT } = require('../browser/lib.cjs');

const PACKS = [
  { zip: 'assets-src/models/low-poly-tree-pack.zip', fbx: 'source/LP_TREE_PACK.fbx', shrubs: [] },
  { zip: 'assets-src/models/low-poly-tree-set.zip', fbx: 'source/Lowpoly_tree_set.fbx', shrubs: ['Lowpoly_Tree_12', 'Lowpoly_Tree_13', 'Lowpoly_Tree_14'] },
];

(async () => {
  const tmp = path.join(ROOT, 'public/_tmp_trees');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const jobs = PACKS.map((p, i) => {
    execSync(`unzip -q -o "${path.join(ROOT, p.zip)}" "${p.fbx}" -d "${tmp}/${i}"`);
    return { url: `/_tmp_trees/${i}/${p.fbx}`, shrubs: p.shrubs };
  });
  const b = await launch();
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('page error:', e.message));
  await p.goto(URL + '/dev-treeexport.html');
  await p.waitForFunction(() => document.title === 'ready', null, { timeout: 120000 });
  const items = await p.evaluate((j) => window.exportTrees(j), jobs);
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  const dir = path.join(ROOT, 'public/models/trees');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/models/manifest.json'), 'utf8'));
  for (const k of Object.keys(man)) if (/^(tree|shrub)\d+$/.test(k)) delete man[k];
  const n = { tree: 0, shrub: 0 };
  for (const it of items) {
    const key = `${it.kind}${++n[it.kind]}`;
    fs.writeFileSync(path.join(dir, `${it.name}.glb`), Buffer.from(it.b64, 'base64'));
    man[key] = { url: `trees/${it.name}.glb` };
    console.log(`${key} ${it.name}: ${it.tris} triangles, ${it.height} m, ${(Buffer.from(it.b64, 'base64').length / 1024).toFixed(0)} KB`);
  }
  fs.writeFileSync(path.join(ROOT, 'public/models/manifest.json'), JSON.stringify(man, null, 2) + '\n');
})();
