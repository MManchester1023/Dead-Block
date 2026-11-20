# Dead Block Command

An isometric zombie-city RTS: reclaim the city block by block with squads, engineers and fortifications. Browser game, TypeScript + Three.js.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173. Tests: `npm test`.

## Where things are

- **[STATUS.md](docs/STATUS.md)**: what's done and what's next, ranked. Start here.
- **[Design doc](docs/ORIGINALDESIGNDOC(DO NOT EDIT).md)**: the full design and the source of truth (roadmap in §21, playtest log in §22).
- **[CREDITS.md](docs/CREDITS.md)**: model authors and licences.
- `src/`: `sim/` is the game rules (no graphics), `render/` the 3D view, `ui/` the HUD, `config/` every tunable number.
- `assets-src/models/`: uploaded models waiting to be used (not shipped).
- [README_old.md](README_old.md): the previous, detailed README (architecture notes).

## Tools

With `npm run dev` running (the game at http://localhost:5173):

- **Difficulty tuning**: http://localhost:5173/dev-balance.html: every difficulty setting (whole horde, hives, horde waves, noise, each zombie type, each difficulty tier's hive pools and spawning, each region's hive starting stage and ambient zombies…) next to its default. **Save** uses your changes in your next game in that browser; **Download balance.json** and upload it to `public/` to keep them for good.
- **Map editor**: http://localhost:5173/dev-map.html: the city as data: move, resize, add and delete buildings, cars, roads, lots, districts, hive sites and power stations, with checks for problems and undo. **Play** tries your edit in the game straight away; **Save** downloads `starter.json` (upload it to `src/data/maps/` to keep it).
- **Dev menu** (in the game): press **`** to spawn zombies (any type, 1–50, hunting or wandering) and hives (stage 1–4) by clicking the map, clear all zombies, or add money and supplies, for testing.
- **Weapon fitter**: http://localhost:5173/dev-rifle.html: pick a unit and a gun, line the gun up in the hands (sliders, any animation), then **Download** its `.json` (one per gun) and upload it to `public/models/weapons/`.
