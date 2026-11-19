// Round 15 #181 (v4.68): the difficulty tuning page end to end. Edits starting money, a region's hive stage and
// the zombie numbers on dev-balance.html, saves, starts the game and checks it uses them (and says so),
// downloads balance.json, resets. Prints ok/FAIL per check. Uses the browser's storage for this test only.
//   node tools/browser/balance.cjs
const fs = require('fs');
const { launch, watchErrors, startGame, URL } = require('./lib.cjs');

const ok = (cond, what) => console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`);

(async () => {
  const b = await launch();
  const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1300, height: 900 } });
  const p = await ctx.newPage();
  const errs = watchErrors(p);
  await p.goto(`${URL}/dev-balance.html`);
  await p.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  // the owner's kept settings (public/balance.json), if any: they count as changes from the defaults too
  const file = await p.evaluate(async () => {
    const r = await fetch('/balance.json', { cache: 'no-store' });
    return r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : {};
  });
  const fileKeys = Object.keys(file).filter((k) => !['BALANCE.economy.startMoney', 'region.motel.hiveStage', 'HORDE.count'].includes(k));
  const groups = await p.$$eval('details', (d) => d.map((x) => x.querySelector('summary').textContent));
  ok(groups.length > 8, `${groups.length} groups (${groups.slice(0, 4).join(' / ')} …)`);
  ok(groups.some((g) => /Region: Roadside Motel.*starting zombies/.test(g)), 'regions show a starting-zombie estimate');
  const est0 = groups.find((g) => /Roadside Motel/.test(g));

  const set = async (path, v) => {
    await p.evaluate(
      ({ path, v }) => {
        const el = document.querySelector(`input[data-p="${path}"]`);
        el.closest('details').open = true;
        el.value = String(v);
        el.dispatchEvent(new Event('change', { bubbles: true }));
      },
      { path, v },
    );
  };
  await set('BALANCE.economy.startMoney', 777);
  await set('region.motel.hiveStage', 3);
  await set('HORDE.count', 3);
  const est1 = await p.$$eval('details summary', (s) => s.map((x) => x.textContent).find((t) => /Roadside Motel/.test(t)));
  ok(est1 !== est0, `the estimate follows the edits (${est0.match(/≈ \d+/)} → ${est1.match(/≈ \d+/)})`);
  ok((await p.$$('.row.changed')).length === 3 + fileKeys.length, `the three edits are highlighted (plus balance.json's ${fileKeys.length})`);
  await p.click('[data-a="save"]');
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('dbc.tuning') || '{}'));
  ok(stored['BALANCE.economy.startMoney'] === 777 && stored['region.motel.hiveStage'] === 3, 'Save stores the edits');

  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-a="download"]')]);
  const body = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  ok(dl.suggestedFilename() === 'balance.json' && body['HORDE.count'] === 3 && Object.keys(body).length === 3 + fileKeys.length, `Download gives balance.json with the three changes (and balance.json's ${fileKeys.length})`);

  const g = await ctx.newPage();
  await startGame(g);
  const got = await g.evaluate(() => ({
    money: window.game.world.money,
    stage: window.game.world.hives.find((h) => h.districtId === 'motel')?.stage,
    toast: document.body.innerText.match(/Tuned difficulty in use[^\n]*/)?.[0] ?? '',
  }));
  ok(got.money === 777, `the game starts with the tuned money ($${got.money})`);
  ok(got.stage === 3, `the motel hive starts at the tuned stage (${got.stage})`);
  ok(/3 from this browser/.test(got.toast), `the game says it's tuned ("${got.toast}")`);

  p.on('dialog', (d) => d.accept());
  await p.click('[data-a="resetall"]');
  await p.click('[data-a="save"]');
  const left = await p.evaluate(() => JSON.parse(localStorage.getItem('dbc.tuning') || '{}'));
  ok(Object.keys(left).every((k) => k in file) && Object.keys(left).length === Object.keys(file).length, `Reset everything + Save: only what undoes balance.json is left (${Object.keys(left).length})`);
  await p.evaluate(() => localStorage.setItem('dbc.tuning', '{}'));
  ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join(' / ') : ''}`);
  await b.close();
})();
