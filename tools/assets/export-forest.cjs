// v4.66: the owner's forest tree pack (99.Miles, assets-src/models/low-poly-forest-tree-pack.zip) → one small
// textured GLB per tree/shrub in public/models/trees/, listed in public/models/manifest.json as tree1…N and
// shrub1…M (replacing the old packs). The pack's FBX is inside a .rar in the zip; it's kept unpacked in
// assets-src/models/forest_tree_pack/Tree_Pack.fbx, and the textures come from the zip.
// Leaves are cut-out cards, so these keep a texture (see exportTexturedTrees in src/dev/treeExport.ts).
// Needs the dev server: npx vite --port 5173 --strictPort
//   node tools/assets/export-forest.cjs
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { launch, URL, ROOT } = require('../browser/lib.cjs');

const T = '/_tmp_forest/';
const MATS = {
  Background_Tree_Atlas: { diffuse: T + 'Background_Tree_Atlas_Diffuse.png', opacity: T + 'Background_Tree_Atlas_Opacity.png' },
  Tree_Branches_01: { diffuse: T + 'Tree_Branches_1_Diffuse.png', opacity: T + 'Tree_Branches_1_Opacity.png' },
  Tree_Branches_02: { diffuse: T + 'Tree_Branches_2_Diffuse.png', opacity: T + 'Tree_Branches_2_Opacity.png' },
  Tree_Trunk_01: { diffuse: T + 'Tree_Trunk_01_Diffuse.png' },
  Tree_Trunk_02: { diffuse: T + 'Tree_Trunk_02_Diffuse.png' },
};
// the detailed trees are a trunk plus a set of branches (paired by position); the atlas trees are one piece.
// Not used: the rocks, and Background_Tree_Atlas008 (a low, wide patch).
const ITEMS = [
  { name: 'forest_oak_big', parts: ['Tree_Trunk_01001', 'Tree_Branches_01'], kind: 'tree' },
  { name: 'forest_oak_mid', parts: ['Tree_Trunk_01002', 'Tree_Branches_01002'], kind: 'tree' },
  { name: 'forest_oak_small', parts: ['Tree_Trunk_01', 'Tree_Branches_01001'], kind: 'tree' },
  { name: 'forest_birch', parts: ['Tree_Trunk_02', 'Tree_Branches_02'], kind: 'tree' },
  ...['', '001', '002', '003', '004', '005', '006', '007', '009'].map((k) => ({ name: `forest_pine${k || '000'}`, parts: [`Background_Tree_Atlas${k}`], kind: 'tree' })),
  ...['010', '011', '012'].map((k) => ({ name: `forest_bush${k}`, parts: [`Background_Tree_Atlas${k}`], kind: 'shrub' })),
];

(async () => {
  const tmp = path.join(ROOT, 'public', T);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  const need = [...new Set(Object.values(MATS).flatMap((m) => [m.diffuse, m.opacity].filter(Boolean)))].map((u) => `textures/${path.basename(u)}`);
  execSync(`unzip -q -o -j "${path.join(ROOT, 'assets-src/models/low-poly-forest-tree-pack.zip')}" ${need.map((n) => `"${n}"`).join(' ')} -d "${tmp}"`);
  fs.copyFileSync(path.join(ROOT, 'assets-src/models/forest_tree_pack/Tree_Pack.fbx'), path.join(tmp, 'Tree_Pack.fbx'));
  const b = await launch();
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('page error:', e.message));
  await p.goto(URL + '/dev-treeexport.html');
  await p.waitForFunction(() => document.title === 'ready', null, { timeout: 120000 });
  const items = await p.evaluate((j) => window.exportTexturedTrees(j), { url: T + 'Tree_Pack.fbx', mats: MATS, items: ITEMS });
  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  const dir = path.join(ROOT, 'public/models/trees');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/models/manifest.json'), 'utf8'));
  for (const k of Object.keys(man)) if (/^(tree|shrub)\d+$/.test(k)) delete man[k];
  const n = { tree: 0, shrub: 0 };
  let total = 0;
  for (const it of items) {
    const key = `${it.kind}${++n[it.kind]}`;
    const buf = Buffer.from(it.b64, 'base64');
    total += buf.length;
    fs.writeFileSync(path.join(dir, `${it.name}.glb`), buf);
    man[key] = { url: `trees/${it.name}.glb` };
    console.log(`${key} ${it.name}: ${it.tris} triangles, ${it.height} m, ${(buf.length / 1024).toFixed(0)} KB`);
  }
  fs.writeFileSync(path.join(ROOT, 'public/models/manifest.json'), JSON.stringify(man, null, 2) + '\n');
  console.log(`total ${(total / 1024).toFixed(0)} KB`);
})();
