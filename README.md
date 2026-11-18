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

- **[STATUS.md](STATUS.md)**: what's done and what's next, ranked. Start here.
- **[Design doc](docs/Dead_Block_Command_Design_Doc_v4.md)**: the full design and the source of truth (roadmap in §21, playtest log in §22).
- **[CREDITS.md](CREDITS.md)**: model authors and licences.
- `src/`: `sim/` is the game rules (no graphics), `render/` the 3D view, `ui/` the HUD, `config/` every tunable number.
- `assets-src/models/`: uploaded models waiting to be used (not shipped).
- **Rifle fitter**: with `npm run dev` running, open http://localhost:5173/dev-rifle.html to line the rifle up in the soldiers' hands (sliders, any animation), then save `m4.json` into `public/models/weapons/`.
- [README_old.md](README_old.md): the previous, detailed README (architecture notes).
