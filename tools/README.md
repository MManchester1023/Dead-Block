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
| `region1` | Balance bot for the Roadside Motel: a careful "bounding" advance vs. a straight charge at the hive, 6 seeds | v4.31: bounding 6/6, charge 0/6 |
| `region2` | Same for the Gas Station Strip (motel already secured) | v4.31: bounding 1/6, charge 0/6 (over 12 seeds ~5/12: possibly too hard) |
| `region3` | Same for Rail Siding, both hives | v4.31: bounding 6/6, charge 2/6 |
| `roaming` | A motel outpost, bare vs. MG nest + sandbags, against 4 roaming packs | v4.29: bare held 0/4, fortified 4/4 |
| `simhash` | Fingerprints the full game state at 1, 3 and 5 minutes of two scripted games. Run with `TAG=before` and `TAG=after` around a change that shouldn't alter behaviour; identical `tools/out/simhash-*.txt` files mean identical behaviour | |

## Browser checks (`browser/`)

| Script | What it does |
|---|---|
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
