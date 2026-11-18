// The owner's car pack → one small GLB per car for the parked cars (v4.56; see src/dev/carExport.ts),
// written to public/models/cars/<name>.glb and listed in public/models/manifest.json as car1…carN.
// Needs the dev server: npx vite --port 5173 --strictPort
//   node tools/assets/export-cars.cjs [/assets-src/models/mixamo/generic_passenger_car_pack.glb]
const fs = require('fs');
const path = require('path');
const { launch, URL, ROOT } = require('../browser/lib.cjs');

(async () => {
  const src = process.argv[2] || '/assets-src/models/mixamo/generic_passenger_car_pack.glb';
  const b = await launch();
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('page error:', e.message));
  await p.goto(URL + '/dev-carexport.html');
  await p.waitForFunction(() => document.title === 'ready', null, { timeout: 120000 });
  const cars = await p.evaluate((u) => window.exportCars(u), src);
  const dir = path.join(ROOT, 'public/models/cars');
  fs.mkdirSync(dir, { recursive: true });
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/models/manifest.json'), 'utf8'));
  for (const k of Object.keys(man)) if (/^car\d+$/.test(k)) delete man[k];
  cars.forEach((c, i) => {
    fs.writeFileSync(path.join(dir, `${c.name}.glb`), Buffer.from(c.b64, 'base64'));
    man[`car${i + 1}`] = { url: `cars/${c.name}.glb` };
    console.log(`car${i + 1} ${c.name}: ${c.tris} triangles, ${c.size.join(' × ')} m, ${(Buffer.from(c.b64, 'base64').length / 1024).toFixed(0)} KB`);
  });
  fs.writeFileSync(path.join(ROOT, 'public/models/manifest.json'), JSON.stringify(man, null, 2) + '\n');
  await b.close();
})();
