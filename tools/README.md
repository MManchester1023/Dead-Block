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
| `smoke.cjs` | End to end in the real game: survivors evacuated, save to slot 1, load it back after a change, Continue on the start screen. Prints ok/FAIL per check |
| `screens.cjs <tag>` + `pngdiff.py a b` | Screenshots of a fixed paused scene (street and wide). Compare before/after a visual refactor; two runs of the same code differ by ~0.001–0.05% (things that sway on real time) |
| `bakecheck.cjs <tag> [--compare <tag>]` | Bakes every character as the game does and fingerprints every pose; with `--compare`, says which clips changed. Use around asset or loader changes |
| `memory.cjs` | Load time and GPU memory of the baked characters (v4.31: ~6.3 s headless, 91 MB) |
| `view.cjs <page> "<query>"` | Screenshot of a dev page: `bake` (baked poses), `model` (a raw GLB), `rifle` (the weapon fitter) |

## Asset preparation (`assets/`)

| Script | What it does |
|---|---|
| `convert-clips.cjs <fbx…>` | Mixamo FBX animation → compact `.clip.json` (~10x smaller). See `assets-src/README.md` |
| `export-obj.cjs "<query>" <name>` | A model's character (guns left out) as an OBJ zip for Mixamo's auto-rigger |
| `export-gun.cjs "<query>" [out.glb]` | Cut a character's own gun out into a weapon GLB in the game's rifle frame (then fit it in `dev-rifle.html`) |
| `resize-texture.cjs in out 512` | Downscale a texture exactly the way the game samples it (no dev server needed) |
| `trim_glb.py …` | Keep only a GLB's used animations and colour texture (Python, no dependencies; ffmpeg only if resizing without the PNG above) |

The dev pages these drive (`dev-*.html` in the repo root) also work by hand in the browser with the dev server running.
