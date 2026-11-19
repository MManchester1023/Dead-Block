# Dead Block Command: notes for Claude

Browser isometric zombie RTS (TypeScript, Three.js, Vite). A personal, non-commercial project by Mat; all
assets are free-licence downloads, credited in `CREDITS.md`.

## Where things are

- **`docs/Dead_Block_Command_Design_Doc_v4.md`** is the source of truth: version table at the top (one row
  per change, newest first), §21 roadmap, **§22 playtest log** (rounds of numbered notes, #1–#231 so far (round 19)).
- **`STATUS.md`** is the short, ranked to-do list plus what's done. **Item numbers are fixed** ("work on #13" always means
  item **#13**): never renumber; new items take the next free number and go where they rank. Keep "Next, in
  order" **ranked by importance with open items only**; finished items move to Done → Finished items.
- `CREDITS.md` (every model, animation, sound), `assets-src/README.md` (source assets, how to add a Mixamo
  clip), `tools/README.md` (probes, browser checks, asset scripts).
- Code: `src/sim/` is the deterministic simulation (World = state + registry + step loop; `rules/` =
  campaign, commands, damage, buildings; `systems/` = what runs each tick); it never touches the DOM.
  `src/render/` is the 3D view (Renderer coordinates layers: City, Crowd, Unit, SupplyDrops, Effects,
  PlacementGhost; `characters.ts` bakes animations into flipbook poses). `src/ui/Hud.ts`, `src/audio/`, `src/data/maps/` (the city as data, edited in `dev-map.html`),
  `src/config/` (balance.ts, units.ts, features.ts: tune numbers there; tuning.ts: the knobs Mat tunes himself in
  `dev-balance.html`, saved as `public/balance.json`, so check that file before changing a default). `dev-*.html` are developer pages.

## Working with Mat

- Straightforward, honest answers; light-hearted is welcome. Say when something is a guess (most balance
  numbers are until a playtest) and when you didn't check something.
- **No screenshots at all** (Mat asked twice; round 15 #191): don't take them, not even private ones to check
  your own work (they cost usage). Check visuals with the scripted browser checks and say what was checked;
  anything only eyes can judge, ask Mat to look at.
- **Mat's long-term plans stay** (vehicles, air support, bosses, human faction, the whole roadmap). Don't suggest
  dropping or parking them; when asked for opinions, suggest additions, changes and order, not cuts.
- **Mat decides difficulty from his own playtests.** The balance bots don't build or think, so don't run
  probes to judge or retune difficulty, and don't propose difficulty changes based on them. Make the
  change asked for and let Mat playtest it. Probes are still fine as a quick "nothing broke" check
  (e.g. a region can still be won, an outpost can still hold); just don't spend effort on them.
- **Playtest notes without a request to code: log them, don't build them.** Add a new round to §22 (table:
  # | Note | Current state from the code | Proposed fix | Needs from owner), a version row, and the items
  in STATUS.md in ranked order; give likely causes and proposals, then ask.
- When asked for "the next thing", pick the most important thing overall, not every open note.
- After each piece of work: STATUS.md (✔ with the version), a version row in the design doc (and the §22
  row if it closes a note), CREDITS.md for new assets; commit and push. Each reply ends with a short summary
  of what changed, what was verified, and what's left to Mat.
- Mat tests locally and **uploads assets through GitHub's web UI**, so `git fetch` and merge the branch
  before using an upload. Check uploads before wiring them in: e.g. a Mixamo FBX whose strings say
  `MotionOnlyScene` has no mesh ("Without Skin"); a clip can be the wrong animation (`Walking.fbx` turned
  out to be a zombie walk).
- Work up to v4.32 is on `claude/magical-brown-7bsmza`; from v4.33 it's on `claude/awesome-einstein-oapvzq`.
  Each new session may get a new branch: push only to the one the session names, and **tell Mat the branch
  name in the reply** so he tests the right one (round 12 began with him testing the old branch). Don't rewrite history (the ~200 MB of old models in it) without Mat's OK.

## Assets: what works

- **Characters** are Mixamo-rigged: export the model to an OBJ zip **without its gun**
  (`tools/assets/export-obj.cjs`); on Mixamo use the Standard Skeleton and download **FBX Binary, T-pose,
  With Skin**. Mixamo renames materials to `<name>mat` (relevant for `recolor`).
- **After any character change** (model, clip, texture, gun, gun fit from `dev-rifle.html`, or the specs in
  `characters.ts`): re-bake with `node tools/assets/bake-cast.cjs` (dev server up) and commit
  `public/models/baked/cast.bin`; `npm test` fails until you do, and the game bakes live (slow start) meanwhile.
- **Animations**: Mixamo FBX (animation-only "Without Skin" is fine for clips), then convert to
  `.clip.json` (`tools/assets/convert-clips.cjs`); originals go to `assets-src/models/mixamo/clips/`.
- **Guns** are separate GLBs in the rifle frame (barrel +X, magazine −Z), placed in the hand by a fit file
  next to them (`public/models/weapons/<gun>.json`), which Mat sets in `dev-rifle.html` (Unit/Gun pickers).
  A character's own gun can be cut out with `tools/assets/export-gun.cjs`.
- **Textures** are baked into vertex colours at ≤512 px: shrink bigger ones with
  `tools/assets/resize-texture.cjs` (not ffmpeg: its colours differ), trim GLBs with `tools/assets/trim_glb.py`.
- **Sounds**: originals in `assets-src/audio/`; shipped as trimmed mono mp3 (44.1 kHz, 96 kbit) in
  `public/audio/` via ffmpeg, wired in `src/audio/Sound.ts`. **Loops** are seamless cross-faded WAVs (MP3 padding gaps a loop),
  made by `tools/assets/make-loops.py`. Vehicle sounds play only zoomed in and close
  (`closeUp()` in Sound.ts, owner's rule). Building models (and vehicles) go through `tools/assets/export-prop.cjs`.

## Checking work

- `npm test` (~5 s, must pass) and `npx tsc --noEmit`. `npm run build` for the bundle (~11 MB). Vite 8 / Vitest 5 since v4.70.
- Performance: Settings → Performance readout in the game; `node tools/browser/perf.cjs` profiles here (no GPU: CPU numbers only).
- Changes that shouldn't alter behaviour: `TAG=before`/`TAG=after npm run probe -- simhash` (identical
  files), `tools/browser/screens.cjs` + `pngdiff.py`, `tools/browser/bakecheck.cjs --compare`.
- Gameplay paths: `node tools/browser/smoke.cjs`. Balance bots (crude, only a sanity check; Mat judges difficulty): `npm run probe -- region1|region2|region3|roaming`.
- Dev server for the browser tools: `npx vite --port 5173 --strictPort` as a background task with a long
  timeout (the default limit stops it mid-session).
- In this environment, long heredocs with some patterns trip a shell safety check: write edit scripts to a
  file in the scratchpad and run them instead.
