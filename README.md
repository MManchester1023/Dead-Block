# Dead Block Command

> **Reclaim it block by block.** An isometric military RTS-lite set in a zombie-choked city.

Browser-first MVP built from the design doc: **[docs/Dead_Block_Command_Design_Doc_v4.md](docs/Dead_Block_Command_Design_Doc_v4.md)** (v4 merges the v3 PDF, its revision addendum and the November additions, and adds a priority roadmap in §21).

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173.

```bash
npm test
```

```bash
npm run build
```

## What's in the MVP (roadmap Tier 0, plus a few Tier 1 items)

- One continuous map: the main base plus the 64 × 64 **Roadside Motel** starter zone. Seamless zoom from street level to an operations-map view (`M`).
- Fixed-step simulation that keeps running across zoom levels, with pause and 1×/2×/4× speed.
- **Rifle Squads** and **Engineer Teams** with individual members. Members die one at a time; a wiped squad is gone for good.
- **Threat-priority focus fire** (doc §5 v4): lock a target and finish it; danger-close threats break the lock; otherwise bosses > specials > normals.
- Orders: select / box-select, move, attack-move, hold, stop, Shift waypoints, take cover (cars, sandbags), Ctrl+number groups, multi-squad line formation with support units in the rear rank.
- **Walkers, Runners, Bloaters** (toxic cloud on death). **A hive** with 4 permanent stages that gets tougher as it matures, a spawn budget and a global zombie cap. Only explosives or fire can kill it.
- **Noise**: every shot attracts nearby zombies; a full district noise meter triggers an immediate horde pulse. Pulses also fire every 4 minutes at your nearest outpost or the base gate.
- **Economy**: money, supplies (cap), command cap, daily upkeep, Barracks production queue.
- **Engineers**: sandbags, barbed wire, MG emplacements (auto-firing), outposts (need 0% infestation), and demo charges for hives. Build anywhere.
- District infestation, clearing, securing, income. **Region takeover**: a lost outpost becomes a hive (doc §19).
- XP and levels (Recruit → Regular → Veteran → Elite), explosion **knockback** for friend and foe.
- Radio chatter, objectives, roster roadmap in the Barracks panel, intro briefing and win/loss screens.

## Architecture

```
src/
  core/        math, seeded RNG, typed EventBus
  config/      features.ts (roadmap registry), balance.ts (every tunable), units.ts (full roster)
  sim/         World + systems. Pure TypeScript, no DOM or Three.js, deterministic, runs headless in tests
    systems/   orders, combat, zombies, hives, noise, districts, economy, movement
    targeting.ts   the focus-fire rule as a pure, unit-tested function
  render/      Three.js renderer, iso camera rig, pixel textures, palette (reads the sim, never writes)
  input/       mouse/keyboard → Game commands
  ui/          DOM HUD + radio chatter (subscribes to sim events)
  Game.ts      fixed-step loop, pause/speed, selection, input modes
```

Rules that keep later features cheap to add:

- **The sim never touches rendering.** That makes 4× speed, headless balance testing and a future desktop/server build possible. Everything visual comes from `EventBus` events or from reading state.
- **Feature registry** (`config/features.ts`) mirrors the doc §21 tiers. Disabled features already have hooks in place. Search the code for the id: `dayNight` (renderer lighting), `specialZombies` (soldier reanimation on wipe), `tallWalls` (`climbable: false` structures, loudspeaker lure), `destruction` (building HP and `crushable` cars), `humanFaction` (`Faction = 'hostile'` and the hostility table; target acquisition is faction-vs-faction already), `armoryCustomization` (per-member `loadout`), `rooftops` (`Squad.garrisonedIn`, building `roofCapacity`), `outpostResupply` (`Structure.stock`).
- **Full roster as data** (`config/units.ts`). Medics, MG/Sniper/Flame/Mortar teams, vehicles, Hawk, Sparrow and the candidate howitzer are already defined, gated by their feature flag, and shown as locked in the UI with their unlock condition.
- **Damage types** (`bullet | explosive | fire | melee | toxic | crush`) drive the rules: hives ignore bullets, cover ignores explosives and toxic, and `crush` is reserved for collapsing buildings and tanks.
- **Deterministic**: a seeded RNG everywhere in the sim (cosmetic radio lines are the only exception).

## Honest status / known gaps

- Balance is first-pass. A naive "attack-move everyone at the hive" bot wins about 1 in 3 seeds. A player using cover, sandbags and a third squad should do better. All numbers live in `config/balance.ts` and `config/units.ts`.
- Not in the MVP yet (by design; see doc §21): fog of war, power stations, the seven-mission tutorial, direct control (TAB shows a "coming later" toast), save/load, audio.
- Zombie crowds steer directly and use A* only when stuck. That's cheap (~0.1 ms per sim tick with 60+ zombies) but they can look dumb around building corners.
- Buildings don't receive shadows (it avoided shadow acne on software GL). Units and the ground still do.
