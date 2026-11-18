// Downscale a PNG exactly the way the game samples model textures (a canvas drawImage, as texSampler does
// in src/render/characters.ts), so the baked colours come out identical. Other resizers (ffmpeg etc.)
// filter differently and shift the colours by a percent or two. No dev server needed.
//   node tools/assets/resize-texture.cjs in.png out.png 512
const fs = require('fs');
const { launch } = require('../browser/lib.cjs');

(async () => {
  const [src, dst, size = '512'] = process.argv.slice(2);
  const b = await launch();
  const p = await b.newPage();
  const url = await p.evaluate(
    async ({ data, size }) => {
      const img = new Image();
      img.src = data;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      cv.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, size, size);
      return cv.toDataURL('image/png');
    },
    { data: 'data:image/png;base64,' + fs.readFileSync(src).toString('base64'), size: Number(size) },
  );
  fs.writeFileSync(dst, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`${src} → ${dst} (${size}px, ${fs.statSync(dst).size} bytes)`);
  await b.close();
})();
