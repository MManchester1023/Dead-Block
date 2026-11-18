// Shared bits for the browser scripts: repo paths, the dev-server URL, and a headless Chromium with WebGL.
// Needs Playwright (preinstalled in Claude's cloud sessions; locally: `npm i -D playwright` once, then
// `npx playwright install chromium`). Most scripts need the dev server running (`npm run dev`).
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, 'tools/out');
const URL = process.env.DBC_URL || 'http://localhost:5173';
fs.mkdirSync(OUT, { recursive: true });

/** Headless Chromium with software WebGL (works without a GPU). */
async function launch() {
  const { chromium } = require('playwright');
  return chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
}

/** Collect page errors and console errors, to print at the end. */
function watchErrors(page, ignore = /computeBoundingSphere/) {
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && !ignore.test(m.text()) && errs.push(m.text().slice(0, 200)));
  return errs;
}

/** Open the game, wait for the models to bake, click "Deploy (skip training)". */
async function startGame(page) {
  await page.goto(URL + '/');
  await page.waitForSelector('[data-act=start]', { timeout: 300000 });
  await page.click('[data-act=start]');
}

module.exports = { ROOT, OUT, URL, launch, watchErrors, startGame };
