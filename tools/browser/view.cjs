// Screenshot one of the dev pages, for a quick look at a character, model or fit without the game:
//   node tools/browser/view.cjs bake "key=engineer&clip=walk&n=4&lod=1&yaw=0.8"   (dev-bake.html: baked poses)
//   node tools/browser/view.cjs model "model=models/zombieidle.glb"               (dev-model.html: a raw GLB)
//   node tools/browser/view.cjs rifle "unit=engineer&gun=models/weapons/scar.glb" (dev-rifle.html: the fitter)
// Saves tools/out/view-<page>.png and prints whatever the page reports.
const path = require('path');
const { OUT, URL, launch } = require('./lib.cjs');

(async () => {
  const [page, query = ''] = process.argv.slice(2);
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1200, height: page === 'rifle' ? 800 : 600 } });
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto(`${URL}/dev-${page}.html?${query}`);
  if (page === 'rifle') {
    await p.waitForFunction(() => document.title === 'Rifle fitter' && document.getElementById('fit'), null, { timeout: 300000 });
    await p.waitForTimeout(1500);
    await p.click('#play'); // pause on a firing pose
    console.log(await p.inputValue('#json'));
  } else {
    await p.waitForFunction(() => document.title === 'ready', null, { timeout: 300000 });
    console.log(JSON.stringify(await p.evaluate(() => window.__info)).slice(0, 2000));
  }
  await p.screenshot({ path: path.join(OUT, `view-${page}.png`) });
  console.log(`saved tools/out/view-${page}.png`);
  await b.close();
})();
