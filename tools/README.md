# Tools

Scripts for checking and preparing the game, outside the normal test suite. Output (screenshots,
fingerprints, exports) goes to `tools/out/`, which git ignores.

Browser scripts need **Playwright** (preinstalled in Claude's cloud sessions; locally `npm i -D playwright`
then `npx playwright install chromium`) and, unless noted, the **dev server** running (`npm run dev`).
Set `DBC_URL` if it isn't on `http://localhost:5173`.

## Simulation probes (`probes/`, `npm run probe -- <name>`)

Slow runs that print results instead of passing or failing. Not part of `npm test`.

| Probe | What it tells you | Last result |
|---|---|---|
| `region1` | Balance bot for the Roadside Motel: a careful "bounding" advance vs. a straight charge at the hive, 6 seeds | v4.34: bounding 6/6, charge 1/6 (v4.31: 6/6, 0/6) |
| `region2` | Same for the Gas Station Strip (motel already secured) | v4.34: bounding 5/6, charge 0/6 (v4.31: 1/6; each round 11 change alone still gave 1/6, together 5/6: noisy, playtest decides) |
| `region3` | Same for Rail Siding, both hives | v4.34: bounding 4/6, charge 1/6 (east hive now starts at stage 2; v4.31: 6/6, 2/6) |
| `roaming` | A motel outpost, bare vs. MG nest + sandbags vs. both plus the Garrison upgrade, against 4 roaming packs | v4.34: bare 0/4, MG + sandbags 1/4, + Garrison 4/4 (v4.29, garrison built in: 0/4, 4/4) |
| `simhash` | Fingerprints the full game state at 1, 3 and 5 minutes of two scripted games. Run with `TAG=before` and `TAG=after` around a change that shouldn't alter behaviour; identical `tools/out/simhash-*.txt` files mean identical behaviour | |

## Browser checks (`browser/`)

| Script | What it does |
|---|---|
| `round11.cjs` | Round 11 in the real game: the cargo plane's shadow is removed after an instant crate pickup, supplies show no cap, the outpost panel offers the Garrison |
| `round12.cjs` | Round 12 in the real game: search pop-up over the house and the neighbour left unsearched, the outpost panel sends engineers to install the Garrison, district names move the camera; screenshots in `tools/out/round12-*.png` |
| `crouch.cjs` | Crouch and cover in the real game: three squads sent to one car, G crouches and the button flips to Stand, muzzle flashes are made when they shoot, a hive's hover shows its next-stage timer |
| `sound.cjs` | Sound wiring in the real game: every clip decodes, both ambience beds start, a working engineer crew gets its construction loop and loses it when done, HUD buttons click, soldier deaths play, Command's radio lines play chatter, the supply plane's fly-by and parachute, the hive's blast, and that barbed wire uses the model (checks the audio graph; it can't listen) ; v4.78: restoring the power plays the power-on sound |
| `round13.cjs` | Round 13 in the real game: squad labels hidden until hovered, MG nests turned to their aim |
| `perf.cjs [zombies] [seconds]` | STATUS #47: a busy scene (a crowd closing on a squad) with the CPU profiler on: the game's own readout (sim / scene / draw / HUD per frame), draw calls, triangles, the hottest functions. No GPU here, so draw and FPS aren't representative |
| `graphics.cjs` | Settings → performance readout and graphics quality (High/Medium/Low change pixel ratio, shadow map, zombie shadows; both survive a reload) |
| `devmenu.cjs` | STATUS #59: the dev menu through keys and mouse: ` opens it, Runners ×10 by a click (hunting), Shift+click keeps placing, right-click stops, a stage 2 hive, +$1000, clear, ` closes |
| `round18.cjs` | Round 18 (v4.83): clicking a Humvee with a rider selects it, medics board a damaged one, tracers from the gun, one drive-off at a time, WAV loops, the right-drag ghost and its facing, N repair, engineers' right-click boards, the XP bar, the Vehicle Bay's door arrow |
| `round17.cjs` | Round 17 (v4.80): trees in batches (and the draw calls), the Humvee's turret turning to a target and back, drive-off sound only zoomed in, engine idle only up close, ground under a shop matching its surroundings |
| `humvee.cjs` | STATUS #51: the Vehicle Bay panel builds a Humvee (owner's model), a rifle squad right-clicks it and boards (hidden), its card and Unload button, U unloads, its gun fires |
| `landmarks.cjs` | STATUS #50 in the real game: the run-down Med Bay (tent model, dark, label), the hospital (label once region 2 opens, roof cross), searching it by right-click, the significant-buildings briefing, engineers repairing the Med Bay (medics unlock), the Vehicle Bay (Y, built, garage model) |
| `round16.cjs` | Round 16 fixes (v4.74): no flash for a Bloater burst (a real explosion still flashes), cars duller than their model, hive labels only on hover, the power card without a pause |
| `round15.cjs` | Round 15 quick fixes (v4.71): no hive stage on the HUD, muzzle flashes drawn for at least two frames, explosion flashes, finished effects freeing their GPU memory |
| `balance.cjs` | Difficulty tuning (`dev-balance.html`, v4.68): groups and region estimates shown, edits highlighted, Save stores them, Download gives balance.json, the game starts with the tuned values and says so, Reset clears |
| `mapeditor.cjs` | Map editor (`dev-map.html`): no problems in the starter map, Save with no edits gives exactly the repo file, dragging moves a building, Play starts the game on the edit |
| `chunks.cjs` | City streaming on a 1.8 km test map (100 chunks): only chunks near the camera are built, memory stays within budget while crossing the map, the ops map uses low detail |
| `castcheck.cjs` | Pre-baked cast: matches a live bake pose for pose, loads much faster; prints load times and memory |
| `round14.cjs` | Round 14 in the real game: overlapping squads' labels stack on hover, the Barracks queue groups "×3", no pulse countdown or cooling-down text, "Horde wave" on the radio, P + clicks make a patrol loop, routes drawn (amber loop, numbered waypoints), formation buttons, a right-drag preview and the formation move, plain right-click unchanged |
| `anims.cjs` | Which animation plays when: crouch walk, kneeling fire, stand-up, crouched death, tower climb, survivors' idle and run; and the MG emplacement's burst loop |
| `medic.cjs` | The Medic Team in the real game (v4.61): locked in the Barracks until a Med Bay, recruited by its button, Heal button, K + click a hurt squad heals it, the cooldown on the button, right-click a hurt squad heals |
| `smoke.cjs` | End to end in the real game: survivors evacuated, save to slot 1, load it back after a change, Continue on the start screen. Prints ok/FAIL per check |
| `screens.cjs <tag>` + `pngdiff.py a b` | Screenshots of a fixed paused scene (street and wide; waits for city streaming to finish). Compare before/after a visual refactor; two runs of the same code differ by ~0.001–0.05% (things that sway on real time) |
| `bakecheck.cjs <tag> [--compare <tag>]` | Bakes every character as the game does and fingerprints every pose; with `--compare`, says which clips changed. Use around asset or loader changes |
| `memory.cjs` | Load time and GPU memory of the baked characters (v4.31: ~6.3 s headless, 91 MB) |
| `view.cjs <page> "<query>"` | Screenshot of a dev page: `bake` (baked poses), `model` (a raw GLB), `rifle` (the weapon fitter) |

## Asset preparation (`assets/`)

| Script | What it does |
|---|---|
| `convert-clips.cjs <fbx…>` | Mixamo FBX animation → compact `.clip.json` (~10x smaller). See `assets-src/README.md` |
| `export-obj.cjs "<query>" <name>` | A model's character (guns left out) as an OBJ zip for Mixamo's auto-rigger (v4.62: `.fbx` too, `tex=` for an unlinked texture) |
| `export-gun.cjs "<query>" [out.glb]` | Cut a character's own gun out into a weapon GLB in the game's rifle frame (then fit it in `dev-rifle.html`). v4.62: a stand-alone `.fbx` gun too, with `tex=` and `length=` (metres); e.g. the pistol: `model=…/pistol.fbx&meshes=slide,trigger,lower,mag&tex=…/pistolcolor.png&barrel=z&down=-y&length=0.2`. A gun that isn't rifle-sized also needs its length and grip in `GUN_SHAPES` (characters.ts) |
| `resize-texture.cjs in out 512` | Downscale a texture exactly the way the game samples it (no dev server needed) |
| `trim_glb.py …` | Keep only a GLB's used animations and colour texture (Python, no dependencies; ffmpeg only if resizing without the PNG above) |
| `export-cars.cjs [pack.glb]` | The owner's car pack → one small GLB per car in `public/models/cars/` (wheels merged, textures baked to colours, ~1,500 triangles, 4.6 m), listed in the model manifest as car1…carN (needs the dev server) |
| `export-forest.cjs` | v4.66: the owner's forest pack (99.Miles) → one textured GLB per tree/bush in `public/models/trees/` (cut-out leaf cards: texture with alpha, double-sided; atlas trees cropped; ≤ 256 px), listed as tree1…/shrub1… in the model manifest, replacing what's there (needs the dev server; restart it afterwards so it serves the new files) |
| `export-trees.cjs` | (superseded by `export-forest.cjs` in v4.66) The owner's first two tree packs → one small GLB per tree/shrub in `public/models/trees/` (colours baked, ≤ 900 triangles, trees 6–9.5 m, shrubs 1–1.6 m), listed as tree1…/shrub1… in the model manifest (needs the dev server) |
| `export-prop.cjs <source.glb\|.zip> <key> <w> <d> [tris] [node]` | A building/prop model → one GLB for a structure (textures baked to colours, simplified, fitted to a footprint in metres), listed in the model manifest under `key` (v4.72: `medTent`, `vehicleBay`). A `.zip` is a Sketchfab glTF download; `node` picks one object out of a pack; `--only=<part>` / `--exclude=<part>` split a model into pieces that line up and `--pivot=<part>` centres a piece on that part (v4.80: the Humvee's turret). Needs the dev server (restart it afterwards so it serves the new file) |
| `bake-cast.cjs` | **Re-run after any character change** (model, clip, texture, gun model, gun fit, or the specs in `src/render/characters.ts`): bakes the cast into `public/models/baked/cast.bin` (needs the dev server). `npm test` fails while it's out of date |
| `simplify-glb.mjs in.glb out.glb [tris] [lengthM]` | Shrink a static, untextured model to be repeated many times: bakes transforms, merges meshes, simplifies with meshoptimizer, puts its long side along X at `lengthM` metres (v4.39 barbed wire: 245k → 3.5k triangles) |

The dev pages these drive (`dev-*.html` in the repo root) also work by hand in the browser with the dev server running.
