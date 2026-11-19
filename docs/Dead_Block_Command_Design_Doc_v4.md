# DEAD BLOCK COMMAND
### Game Design Document — v4

> **Reclaim it block by block.**

A persistent, open-world-ish military RTS-lite set in a zombie-choked city. Build and maintain a force, push out from a safe base, establish outposts and field fortifications wherever engineers can reach, and reclaim the city through continuous battles.

**Current direction:** Single-player strategy and tactical action • Continuous city battlefield • Isometric 3D (clean, stylised; only loosely pixel-art influenced) • Browser-first development with desktop migration if needed.

**Document history**

| Version | Notes |
|---|---|
| v3 | November 2026 design review: map sequence, engineer construction rules, Elite armory access, hive progression. Revision addendum (§17–20): tutorial, open-world transition, region takeover. |
| **v4** | Addendum merged into the main body. Added: rooftops, tall walls, building destruction and rubble, vehicle crushing, AC-130, colored smoke, target priority, human faction (placeholder), day/night with flares, Little Bird, knockback, sheet-metal armor, artillery vehicles, Last Stand defeat, outpost resupply, artillery strike patterns, loudspeaker, Hawk rappelling, Elite cosmetics. New §21 priority roadmap. Table formatting fixed. |
| **v4.79** | Playtest round 17 logged (§22, #201–209): Humvee engine and drive-off sounds, a turning gun, car steering, no pushing vehicles, Humvees vs lamp posts; ground around buildings; more trees; duller cars confirmed. No code changes. |
| **v4.78** | Why the owner never heard the power-on sound: the first restore opened the power briefing, which paused the game a moment before the sound played (and nothing plays while paused), so it was always silent. Fixed by v4.74's non-pausing cards; `sound.cjs` now checks it plays. |
| **v4.77** | STATUS #51 (part): the **Humvee** (owner's model, SIpriv, CC BY 4.0): made at the Vehicle Bay (its own production panel), the MG emplacement's weapon firing all round, room for one squad of up to 5 (board by right-click, unload with U; riders hidden and safe; bail out if it's destroyed). The roster's "Gun Jeep" placeholder became the Humvee. MG sound loops now follow their gun. |
| **v4.76** | Owner: frame rates fine now (STATUS #47 closed); region 3 spice (#51) feels OK for now, to decide later. No code changes. |
| **v4.75** | Round 16 #200: the supply plane is the owner's **C-130 propeller fly-by** (timed to peak over the drop at 10 s into the clip). |
| **v4.74** | Round 16 built (STATUS #53–#55): no flash for Bloater bursts, duller cars, hive labels on hover, no hospital label and the cross on its roof; briefings are non-pausing HUD cards with short how-to text (tutorial unchanged); medics earn XP from healing (a full heal = 8 XP). |
| **v4.73** | Playtest round 16 logged (§22, #192–200): no flash for Bloater bursts, duller cars, HUD pop-ups instead of pausing dialogs, hive labels on hover, no hospital label, roof cross on the roof, shorter how-to prompts, medic XP from healing, a new cargo plane sound. No code changes. |
| **v4.72** | STATUS #50 (round 15 #185): **significant buildings**: the hospital in region 2 (15 s search, guaranteed haul, unlocks the Med Bay repair; roof cross and label; map editor field); the **Med Bay** in the base from the start, run down until engineers repair it (no power needed any more), drawn with the owner's Medical Tent; region 3's power unlocks the **Vehicle Bay** (engineers build it, Y), drawn with the owner's garage; first-landmark briefing, objectives, hospital tuning knobs. Tools: `export-prop.cjs` (building models → structure GLBs). |
| **v4.71** | STATUS #48, round 15 quick fixes: hive stage off the HUD (#187); visible muzzle flashes (bigger, longer, at least two frames) and an explosion flash + ground glow (#188); street trees on the grass beside the sidewalk or in tree pits (#189); finished effects free their GPU memory. |
| **v4.70** | Dev tools upgraded to clear `npm install`'s security warnings: **Vite 5 → 8, Vitest 2 → 5** (0 vulnerabilities; esbuild no longer needed, so the install-scripts warning goes too). Development-only: the game itself is unchanged; tests, build, probes and the browser checks pass on the new versions. |
| **v4.69** | STATUS #47 part 1: **Performance readout** and **Graphics quality** (High/Medium/Low) in Settings; `tools/browser/perf.cjs` profiles a busy scene (475 zombies: sim ~2 ms/tick, scene ~1.5 ms, 1.24 M triangles + shadows: GPU-bound). |
| **v4.68** | Round 15 #181: **difficulty tuning tool** `dev-balance.html` (every difficulty knob, Save for this browser, Download balance.json to keep; the game applies `public/balance.json` then the browser's edits and says so). #182: README and STATUS list the map editor, weapon fitter and tuning tool with links. Round 15 answers recorded (#183, #185, #186, #190). |
| **v4.67** | Playtest round 15 logged (§22, #181–191): difficulty tuning tool, README tools, pile-up climbing, region 3 spice (Humvee, build incentives), hospital → Med Bay and power → Vehicle Bay with run-down base buildings, routes for selected only, hive stage off the HUD, invisible muzzle/explosion flashes, trees in the sidewalk, frame drops, no screenshots. No code changes. |
| **v4.66** | Every tree is from the owner's new **forest pack** (99.Miles): 13 trees (pines, plus four with separate trunk and branches) and 3 bushes, with real textures and cut-out leaf cards (shadows follow the leaves); scaled to street-tree height (6–9.5 m), bushes 1–1.6 m. Replaces the v4.58 packs. |
| **v4.65** | The owner's gun fits from `dev-rifle.html`: the medics' pistol and the riflemen's M4 sit as he placed them. |
| **v4.64** | The owner's **medic model**, re-rigged on Mixamo, replaces the red-tinted engineer stand-in; the owner's pistol clip (a steady aim, no recoil) is the medics' shooting pose. |
| **v4.63** | Squads leave a guard tower by **jumping down** (owner's Mixamo "Jumping Down", replacing "Climbing Down"): 2.5 s with the landing (was a 2 s climb); the clip and the fall are timed together so they touch down as it lands, soldiers one after another. |
| **v4.62** | Owner uploads wired in (#41): the re-rigged **civilians** (male and female, alternating); the straight **Rifle Crouch Walk** for crouched squads; a **medic character** (engineer body as a stand-in, the owner's **pistol** model, Mixamo pistol idle/run/kneel/stand-up, the **healing animation** while treating) and **pistol sounds**. The medic model itself is exported for a Mixamo re-rig. Gun and OBJ exporters read FBX now. |
| **v4.61** | STATUS #20 / round 9 #103: the **Medic Team** is in. Unlocks with the Med Bay; pistols (15 m); **Heal** (K / button / right-click a hurt squad): walk over, treat 2 s without shooting, +40% of the squad's health and fallen soldiers back, 30 s cooldown. Engineer body tinted red and a pitched-up carbine sound as stand-ins. |
| **v4.60** | Design: the Medic Team unlocks with the Med Bay (owner); recorded on STATUS #20, not built yet. |
| **v4.59** | All trees are the owner's models now: the street palms and the house-yard trees use them too (procedural trees only as a fallback). |
| **v4.58** | The owner's two tree packs (free use) as the street trees and shrubs: 20 trees and 3 shrubs, colours baked, ≤ 900 triangles, picked per spot; palms stay procedural. |
| **v4.57** | Fix: the OBJ export for Mixamo's auto-rigger laid "Z up" models (the civilians) flat on their face; it now stands them up (and the right way up). Civilian zips re-exported. |
| **v4.56** | Round 14 uploads, part 2: the owner's car pack (Comrade1280, CC BY 4.0) as the parked cars: ten models merged, texture colours baked, ~1,500 triangles each, picked per car; civilians exported skeleton-free for a Mixamo re-rig. |
| **v4.55** | Round 14 uploads, part 1: soldiers kneel to fire when crouched, crouch-walk, stand up from a crouch, die crouched when hit low, and climb guard-tower ladders; survivors breathe while waiting and run; MG emplacements fire a looping 50-cal burst. Cast re-baked (8.6 → 12.5 MB, 131 → 68 MB in memory vs a live bake). |
| **v4.54** | Formation maker (§22 #177): line, column, wedge, box, spread from the squad panel; right-drag places the formation and sets its facing (with a preview); plain right-click unchanged. |
| **v4.53** | Random hive sites (§22 #163): hives placed at random open spots each game (seeded, saved), apart and away from fence, base and squads; ordered west to east so per-hive stages keep their meaning. |
| **v4.52** | Waypoints and patrol (§22 #174–176): Shift+right-click waypoints unchanged (stop at the last); new Patrol order (P, click points, Shift+click to add), looping and fighting on the way; routes drawn for selected squads (green numbered waypoints, amber patrol loops). |
| **v4.51** | Round 14 fixes and tweaks (§22 #162, #165–168, #170–173, #178, #179): zombies route round walls at any distance and use headway for the stuck check; overlapping squads' labels stack on hover; Runners 9.5 m/s; toughness 0.45; demo charge 2 s; wander 40 m; hive spawns ≥ 5 s apart; grouped Barracks queue; no pulse countdown or cooling-down text; "Horde wave". |
| **v4.50** | Round 14 playtest logged (§22 #162–180), not started. Causes found: zombies within 8 m of their target walk straight at it through walls, and the stuck check misses jostled zombies (#167); hovering shows only the nearest squad's label (#178). Shift+right-click already does "go to each, stop at the last" (#174/#175). |
| **v4.49** | More zombies, but weaker (owner: "the current state is a little underwhelming"): `HORDE` setting (count 2, toughness 0.6, damage 0.75) scales every crowd, brood, pulse, pack and nest; per-kill money, supplies, XP and infestation halved to keep the economy. |
| **v4.48** | Footsteps removed (owner's call). |
| **v4.47** | STATUS #15: characters pre-baked into public/models/baked/cast.bin (tools/assets/bake-cast.cjs): loaded in 0.4 s instead of a ~5 s bake at launch, half the memory (99 → 52 MB), identical poses within 0.5 mm; live bake kept as the fallback. |
| **v4.46** | STATUS #14: the city streams in 192 m chunks (ground textures, buildings, props) built as the camera nears them, ground painted within a per-frame budget, low detail far away and on the ops map, far chunks freed past a budget. Tested on a 1.8 km map. |
| **v4.45** | STATUS #13: the map is data (`src/data/maps/starter.json`, built by `buildMap()`), proven identical to the hand-coded map; map editor `dev-map.html` (edit, check, save, play the edit). STATUS items get fixed numbers (originals #1–32 restored; rounds 11–13 are #33–40). |
| **v4.44** | Footsteps: the owner's boots-on-gravel recording as a quiet seamless loop under up to 4 moving squads near the camera (crouched: softer, slower). |
| **v4.43** | Round 13 built (§22 #151–156, #158, #160): soldiers slide along walls and rejoin when stuck; MG nests face their aim; ambience levels; Walkers attack every 2 s, Runners every 1 s; power coming on draws the dead; squad labels only on hover. #157 side tasks added to the roadmap. |
| **v4.42** | Round 13 playtest logged (§22 #151–161), not started. Causes found: soldiers stuck on buildings come from v4.36's no-walking-into-walls rule (#154); the MG nest model never turns to its aim (#160). The power-on sound plays in the current build (#155, retest). |
| **v4.41** | Power station start-up sound from the owner's recording (§22 #112), placed at the station like other sounds; supply crate landing thud (#113). |
| **v4.40** | New Bloater burst from the owner's recording replaces the layered pop + gore (§22 #108). |
| **v4.39** | Owner's uploads: hive death = wet mud blast (§22 #110), supply plane fly-by timed to peak over the drop + parachute opening (#113), barbed wire model (CliffUnderside, CC BY 4.0) simplified 245k → 3.5k triangles (#115). The new Bloater sound (a video) had silent audio: old burst kept. |
| **v4.38** | Sounds from the owner's uploads: engineers' construction loop (three recordings layered; §22 #111), soldier deaths (3), UI click, ambience (suburban bed + very quiet horror drone, seamless loops), radio chatter (8 clips cut from one recording: on Command/Overwatch radio lines and now and then in the background). |
| **v4.37** | Round 11 leftovers built (§22 #125–127, #135): muzzle flashes; hive hover shows time to its next stage; G = crouch (half cover anywhere, 60% speed), cover room (car 2, sandbags 3, MG nest 2) with overflow squads crouching in the open; squads in cover hold their ground; barbed wire hotkey G → Z. |
| **v4.36** | Round 12 built (§22 #137–150 except #143's open question, now answered): noise-pulse cooldown 45 s; one building per house (53 → 68); search pop-ups; wanderers stop walking into buildings; build sites push squads off; footprint clicks; soldiers walk or stand (no sliding); engineers don't shoot at work; Garrison installed by engineers (6 s); idle leftovers go for your structures after 2 min; MG 12 damage; TREATING; district names move the camera; no command cap from Rail Siding on. |
| **v4.35** | Round 12 playtest logged (§22 #137–150), not started. Causes found: houses blocks searched as one building (#141), search results never shown on screen (#142), no cooldown after a noise pulse (#149), deconstruct picks the first overlapping structure (#148), build sites trap squads standing on them (#147), wandering zombies skip the go-around routing (#139), resting soldiers slide in the idle pose (#137). |
| **v4.34** | Round 11 bugs and quick tweaks (§22 #120, #123, #124, #128–134, #136): plane shadow no longer freezes; search X on the searched house; outposts at ≤ 2% with the hives dead, "N dead left" shown; closest target first; Runners 17 hp; carbine 10 damage; moving fire 50%; outpost Garrison is a $80 + 25 ▣ upgrade; east Rail Siding hive at stage 2; no supply cap; no pack-drifting radio line. |
| **v4.33** | Round 11 playtest logged (§22 #119–136), not started: confirmed cover crouch/lean (#119) and region 2 difficulty (#122); bugs: cargo-plane shadow freezing (#123, cause found), search marking the wrong house (#124), stuck at 1% infestation (#120); tweaks: closest-target priority, engineer damage, no supply cap, region 3 stage-2 hive, outpost garrison as an upgrade, quieter radio; muzzle flash, search pop-ups, hive stage timer; crouch in open cover. |
| **v4.32** | Hand-off for a new chat: CLAUDE.md (working agreements, asset workflow, checks) and tools/ (probes, browser checks, asset scripts), all tested. |
| **v4.31** | Quick wins, no visible change: compact animation clips and a trimmed main zombie (build 28 → 11 MB, load ~8.9 → ~6.3 s, every baked pose identical), zombies skip the base wall when picking targets (simulation identical), dev clutter removed. |
| **v4.30** | Code restructure (STATUS #12), no behaviour change: the renderer split into layers (city, crowds, squads, structures, hives, supply drops, effects, build preview); World's rules moved to sim/rules/ (campaign, commands, damage, buildings). Verified with identical simulation state hashes and matching screenshots. |
| **v4.29** | Roaming packs (STATUS #11, §22 #88): idle dead drift between neighbouring districts in packs, likelier at outposts; dead inside a secured district contest it (infestation up to 30%, income cut to match); outposts get a small all-round garrison. Save / load (STATUS #16): 3 slots + autosave, Continue on the start screen, exact replay after loading. |
| **v4.28** | Civilians from house searches built (STATUS #10, §22 #91): Rail Siding on, 25% of non-nest searches find 2–4 survivors; walk them to the Command Post for $20 + 8 supplies each; unarmed, slow, preferred prey. Placeholder look until a civilian model + unarmed animations arrive. |
| **v4.27** | New soldier models (round 10): riflemen = Kolos Studios' low poly soldier, engineers = MadTrollStudio's SCAR soldier, both re-rigged on Mixamo and carrying their own guns (cut out of the model files); crouch for soldiers away from their cover (#107); sounds for Bloater bursts (#108), explosions (#109) and the engineers' carbine (#114); rifle fitter picks any unit and gun. |
| **v4.26** | Round 10 quick fixes (#106, #116–118) and the pause menu (#105) built. |
| **v4.25** | Playtest round 10 logged (§22, #105–118): pause menu with keybinds (replacing the start-up controls screen), no idle floating, crouch when not hugging cover, Elite squads +1 soldier, region 3 roads/rails to the map edge with rails over the roads; asset requests (sounds, barbed wire model, engineer weapon, crouch/idle animations). No code changes. |
| **v4.24** | First sound pass (owner's Pixabay clips: gunfire, zombie deaths, groans, screams; positional, volume button), shooting-while-moving and cover animations (#95), owner-set rifle fit via the rifle fitter. |
| **v4.23** | Round 9 fixes (#93, #96–#99) and the engineer build menu (#104) built. |
| **v4.22** | Playtest round 9 logged (§22, #93–104): rifle orientation, shooting animations, choppy long clips, tower climb time, 0% infestation with zombies alive, lower command cap; walking fix and real-hardware FPS confirmed; drone (recon only, 30 s fog-clearing orbit), Medic Team design, engineer build menu. No code changes. |
| **v4.21** | Longer sight (#86, #87): rifle 24 → 30 m, carbine 18 → 22 m, MG emplacement 22 → 35 m. |
| **v4.20** | Sound and a technical track added to the roadmap (§21 T1–T7): code split, map data format, chunked world, pre-baked animations, save/load moved up, real-hardware performance check, repo size. No code changes. |
| **v4.19** | Round 8 to-dos logged (§22, #85–92): longer sight for riflemen and MG emplacements, zombies roaming between districts and hitting outposts, police/fire station loot, civilians from house searches (introduced in region 3), an unlock-progress UI for the open world. Ranked into §21. No code changes. |
| **v4.18** | Character models replaced: riflemen and engineers (Military RTS Character 1) and female zombies rigged on Mixamo with Mixamo animations, real M4 rifle model. |
| **v4.17** | Tutorial region 3 (Rail Siding), the power system and the Med Bay built (§17, §21 Tier 1 #14–16). |
| **v4.16** | Round 7 fixes built (#76–84). Next up: tutorial region 3 with the power system. |
| **v4.15** | Playtest round 7 logged (§22, #76–84): both regions cleared first try. Round 7 fixes ranked next on the roadmap, ahead of region 3. No code changes. |
| **v4.14** | Round 6 fixes and the region 2 rework built: animation twitch, noise decay, zombie classes and pools, guaranteed Bloaters, MG field of fire, artillery locked, guard towers (introduced by region 2), region 2 difficulty step. Next up: tutorial region 3 with the power system. |
| **v4.13** | Zombie classes decided (§9): **normal** (Walker, Runner), **medium** (every other zombie type except bosses), **boss**. Normal and medium have separate spawn pools that together make up a district's total. MG field of fire (#71) and the region 2 difficulty plan (#74) approved. |
| **v4.12** | Playtest round 6 logged (§22, #66–74). Roadmap re-ranked: round 6 fixes first; region 2 gets a real difficulty step and a new feature (guard towers); region 3 introduces the power system, which unlocks the Med Bay; artillery becomes a later unlock; Last Stand tabled; replacing the cartoon character models moves up the visual track. No code changes. |
| **v4.11** | Tutorial region 2 built: Gas Station Strip (§17). Roadmap Tier 1 #10 done; next up is region 3. |
| **v4.10** | Playtest rounds 4–5 implemented except #54, #58, #64. §21 roadmap re-ranked: every open item (including parked playtest notes) is now in one ordered list, with done items marked. Uploaded models catalogued (§21 visual track). |
| **v4.9** | Round 5 design decisions recorded: one shared squad health pool (§5), three tutorial regions instead of seven (§17), medics keep their place in the roadmap, "Shriekers" in #59 meant Bloaters. |
| **v4.8** | Playtest round 5 logged (§22): 20 notes from a two-person playtest, with likely causes, proposed fixes and the design conflicts they raise. No code changes in this revision. |
| **v4.7** | Playtest round 4 logged (§22): 13 notes with likely causes and proposed fixes. No code changes in this revision. |
| **v4.6** | See-through buildings (any building hiding a squad, hive or build site fades out). Crowd navigation via shared flow fields (zombie sim ~30% cheaper; profiling says the sim isn't the bottleneck yet, so the Web Worker move is deferred until real-hardware tests say otherwise). Tutorial system + mission 1 script. |
| **v4.5** | Playtest round 3 (§22): continuous supply income (fixes outposts becoming unaffordable), Quonset barracks and roofed MG nest, tough base walls, full-length avenues, status badges, blood. Model-dependent notes parked. |
| **v4.4** | Playtest round 2 (§22): fixed hand-authored world layout confirmed (§2), engine/porting notes (§23), repair and resume building, Command Post support powers, shooter aggro, kill salvage, wider gunfire hearing, calmer hives, crowds of hundreds to thousands. Animated CC0 characters (Quaternius) with flipbook crowd rendering. |
| **v4.3** | Art direction: isometric first, pixel art dropped (only a loose influence). First procedural city pass: houses, apartments, motel, shops, warehouse, trees, streetlights, vehicles, painted roads. Optional glTF model overrides. |
| **v4.2** | Playtest feedback round 1 (§22): force-attack, middle-mouse camera rotation, rifle range, time-then-distance zombie aggro, HUD click fix, looser squads, weaker basic zombies, engineer deconstruction, car wheels, 12-minute days. Plus hive alarm and 3 s charge planting. |
| **v4.1** | §14 "Target look for the finished game" (art direction from reference images, scale, crowd tech, camera rotation). §16 adds the open production questions. MVP: gunfire is now heard well beyond sight. |

Where earlier wording conflicts with a v4 rule, the v4 rule wins. Every v4 change is marked **[v4]**.

---

## 1. Pitch and design pillars

Dead Block Command is a top-down/isometric RTS-lite. The player commands modern military units from a fortified safe zone on the edge of a ruined city. They produce squads and vehicles, send them into nearby streets, clear infestations, secure districts, set up outposts, and push deeper into the city. The city is one persistent battlefield, not a set of separately loaded missions.

- **One persistent city.** The player moves between a strategic overview and detailed street-level combat without loading separate district maps. Units must travel between the main base, outposts and operational areas.
- **Reclaim it block by block.** Infestation recedes, nests are destroyed, outposts are built, power is restored, and the map visibly changes as the city is retaken.
- **Command a force, not a spreadsheet.** Squads act on their own under clear orders. The player can take direct control of a selected squad, vehicle or helicopter when needed.
- **Every loss matters.** **[v4.9]** Each squad has one shared health pool; soldiers drop out as it falls. A squad that is wiped out is gone for good, along with its experience.
- **Noise has consequences.** Gunfire, engines and heavy weapons attract attention. The player trades speed and firepower against the risk of drawing a bigger horde.
- **Build and hold.** Engineers build outposts and defensive structures. *(See §6: field fortifications can go anywhere.)*
- **The city fights back. [v4]** Buildings fall, rubble stays where it lands, night falls, and lost ground can be retaken by the horde.
- **Gritty but fun.** A ruined, atmospheric city, recognizable military-inspired hardware, readable combat and dry radio chatter.

**Format:** single-player real-time strategy with tactical direct control. **Working title:** Dead Block Command.

---

## 2. The city: one continuous battlefield

The city is built as one connected world. Districts are named regions of that world, not separate missions or maps. The player starts at a safe zone on the city's edge and must physically move forces out to the districts and back. The strategic map and the detailed battlefield are two views of the same simulation.

- **Seamless zoom.** Zooming into a street on the operations map shows the live battlefield. Zooming back out returns to the strategic overview while the simulation keeps running.
- **Fixed, hand-authored world [v4.4].** The city layout (roads, buildings, districts, hive sites, abandoned cars) is designed by hand and is **identical every time**, so the open world stays the same place you learn and reclaim. Nothing about the map layout is randomly generated. "Procedural" in this project only means the *look* of a building is built by code instead of loaded from a model file, and even that is seeded per building, so the same house always looks the same. Future districts are authored the same way (as map data), not generated.
- **Persistent consequences.** Soldiers lost, zombies killed, structures destroyed, vehicles damaged, hives cleared, fortifications built and **rubble created [v4]** all stay in the world.
- **No hidden auto-resolve.** Battles are simulated in the world. Progress comes from actual unit movement and combat.
- **Travel matters.** Units travel between base, outposts and districts. Outposts are forward positions, not teleporters.
- **Pause and speed.** Pause, or run at up to 4× speed.
- **Fog of war.** Unexplored areas show estimated infestation. Recon units reveal accurate information and give battlefield vision.

### District structure

**[v4.9]** The campaign opens with three tutorial regions: two small ones, then one big one, each attached to the map as the previous one is cleared (§17). The other starter districts then open as the first part of the open world, and the player can only push into territory connected to areas they already hold.

| District | Terrain / identity | Key progression or threat |
|---|---|---|
| Roadside Motel | Motel rooms, parking lots | Starter; Walkers |
| Gas Station Strip | Pumps and convenience stores | Starter; Walkers |
| Corner Market | Small shops and loading docks | Starter; Walkers, first Runners |
| Rail Siding | Boxcars and small depot | Starter; Walkers and Runners |
| Trailer Park | Tight rows, little cover | Starter; Runner packs |
| Parking Garage | Stacked decks and ramps | Starter; first Bloaters |
| Fire Station | Garage bays and open yard | Starter stronghold |
| Checkpoint | Fortified highway interchange | First full-size district; Walkers and Runners |
| Suburbs | Houses, fences, back yards | Runner packs; Barracks upgrade |
| Main Street | Narrow shops and alleys | Hives; Armory unlock |
| Industrial Park | Warehouses and rail yard | Bloaters; Repair and Armor Stations |
| Hospital Row | Tight wards and parking decks | Screamers; Medbay; The Matron |
| Harbor | Docks and container stacks | Brutes; Flame and Mortar Teams |
| Stadium | Large open bowl and stands | Dense crowds; advanced armor |
| Airport | Runways and hangars | Airfield unlock; The Dispatcher; **human faction [v4]** |
| Downtown Core | Skyscraper canyons | Final district; Patient Zero; **human faction [v4]** |

The Airport must be reached and its Airfield unlocked before the endgame. The player needs a real chance to use the Airfield's unlocks before entering Downtown Core. It must not be an optional late unlock with no practical payoff.

### Infestation and district security

- Each district has an infestation meter from 0–100%. Killing zombies drains it slowly; destroying hives drains it fast. Infestation cannot reach zero while a hive remains.
- At 0% infestation, an Engineer Team can establish an outpost and the district becomes secured.
- Secured districts generate funds over time and provide forward operating positions.
- Some districts contain power stations. Engineers must reach and hold the generator room for about three minutes to restore power. This is loud and can draw a horde.
- Restoring power unlocks or upgrades a related base building.
- If zombies retake a district, the outpost is replaced by a hive (see §19).

---

## 3. Core gameplay loop

The loop is **produce → deploy → clear → secure → reinforce**. Every step happens in the same continuous city, connected by travel, supply upkeep and persistent combat.

| Stage | Player activity |
|---|---|
| Produce | Spend money and supplies to create squads and vehicles at the main base. |
| Deploy | Move a force through the city toward a district or existing outpost. |
| Clear | Fight through streets, destroy hives, manage noise, use cover, deal with special zombies. |
| Secure | Reduce infestation to zero and have engineers establish an outpost. |
| Reinforce | Build defenses, **resupply outposts [v4]**, repair or restore units, prepare the next push. |

Pacing targets (not fixed lengths): full-size district 30–45 minutes, starter district 10–15 minutes.

---

## 4. Controls and command system

Conventional RTS selection and orders, plus an optional direct-control mode. Orders apply to the selected squad, vehicle or helicopter unless a command applies to a formation.

| Input | Command | Behavior |
|---|---|---|
| TAB | Direct control | Take direct control of the selected squad, vehicle or helicopter. A squad is controlled as one unit. |
| Left-click and drag | Box select | Select multiple friendly units. |
| Right-click terrain / map | Move | Walk or drive to the location. Works from the minimap or full map. |
| Right-click cover | Take cover | Infantry move to the cover position and fight from it. |
| Right-click building **[v4]** | Garrison / roof | Elite infantry enter the building and take the roof (see §5). |
| Right-click zombie **[v4.2]** | Force attack | Selected units close to range and shoot that zombie, overriding threat priority. |
| Middle-mouse drag **[v4.2]** | Rotate camera | Free rotation. Q / E snap 90°. Shift + middle-drag pans. |
| K then click a squad **[v4.61]** | Heal | Medics treat the squad (also: right-click a hurt squad with medics selected). |
| X then click **[v4.2]** | Deconstruct | Engineers take down something they built (see §6). |
| M | Operations map | Full map: units, base, districts captured and uncaptured, fog of war. |
| A + click | Attack-move | Move toward a destination, engaging enemies that come in range along the way. |
| Sneak | Quiet movement | Move as quietly as possible; ignore zombies unless they get danger-close. |
| Patrol | Patrol route | Cycle between waypoints, scouting, keeping vision and intercepting. |
| H | Hold position | Stay put; fire at enemies in range without chasing. |
| S / Stop | Cancel | Cancel current movement or production-queue action. |
| Shift + click | Waypoint queue | Add waypoints; units follow them in order. |
| Ctrl + right-click / drag-line | Formation move | Lines, circles or custom spacing while moving. |

Formation movement should give sensible spacing and facing without micromanagement. Start with reliable line formations and custom spacing; add shapes later.

### Direct-control behavior

Direct control is an optional layer on top of squad autonomy. The controlled squad moves and fights by player input; on release it goes back to its normal behavior. Vehicles and helicopters work the same way. Exact input mapping for movement, aiming and firing is still to be finalized.

---

## 5. Squad behavior, cover, and formations

Squads fight on their own when not directly controlled. They pick targets, hold ground, use cover and follow the current order. Vehicles and helicopters lean more on explicit orders but still defend themselves.

- Infantry benefit from cover: concrete barriers, walls, cars, sandbags. Cover reduces incoming damage and shapes firing lanes.
- Right-clicking cover orders infantry to occupy it and fight from there.
- Hold Position stops units chasing targets.
- Attack-Move advances while engaging threats on the way.
- Sneak suits recon and quiet approaches; units still defend themselves against immediate danger.
- Patrol routes keep local vision and intercept enemies.
- Vehicles and helicopters hold and engage nearby threats when idle, and should return to base (RTB) when servicing is needed.

### Squads that look alive [v4.2]

Squad members are not welded to formation slots. Each soldier drifts around their slot, moves at their own pace (squads string out on the move and bunch up on arrival), mills about when idle, and glances around when holding. Holding or in cover keeps them tighter.

### Target priority and focus fire [v4]

Units **pick one target and keep firing at it until it is dead** instead of spreading fire across a crowd. Picking a new target is driven by threat:

1. **Danger-close first.** Whatever is closest and about to reach the unit.
2. **Then high-threat targets** in range: bosses, then dangerous specials (Dragger mid-pull, Bloater near friendlies, Brute, Puker, Screamer).
3. **Then everything else**, nearest first.

A unit only drops its current target early if (a) the target dies or leaves range, or (b) something enters danger-close range and outranks it. This stops wasteful switching while keeping squads from being overrun. Squads share a target where possible so members finish targets quickly.

**Forced target [v4.2].** Right-clicking a zombie orders the selected units to attack it. They move until it is in range and visible, then shoot only it (ignoring the priority rules) until it dies.

### Elite rooftop access [v4]

**Elite infantry** can enter buildings and take up positions on the roof. Rooftops give range, vision and protection from ordinary melee. **They are not safe:** zombies can pile up against a building and climb onto the roof (see §9, pile-ups). A rooftop is a strong position, not an invulnerable one. If the building is brought down (§6a), units inside or on top are crushed.

### Explosion knockback [v4]

Very close explosions knock back **both zombies and friendly units**. Knockback interrupts actions (firing, building, Dragger pulls), can push units out of cover, and can throw zombies off pile-ups and walls. Grenades, artillery, tank shells, bombs and Bloater bursts all apply knockback by distance from the blast.

---

## 6. Main base, outposts, and fortifications

The main base is the player's safe zone and main production center. It starts with a Command Post, Barracks and Supply Depot, with room for more facilities. The base grows as power is restored in key districts.

| Building | Function | Unlock / upgrade |
|---|---|---|
| Command Post | Command cap; strategic support abilities | Starts at base; level 2 tied to Airport progression |
| Barracks | Trains basic infantry squads | Starts at base; level 2 from Suburbs |
| Supply Depot | Stores and manages supplies | Starts at base; level 2 from Harbor |
| Armory | Trains heavy weapons teams; Elite customization **and cosmetics [v4]** | Main Street; level 2 from Harbor |
| Repair Station | Services and repairs vehicles; **sheet-metal armor upgrade [v4]** | Industrial Park |
| Armor Station | Builds ground vehicles | Industrial Park; level 2 from Stadium |
| Medbay | Restores lost squad members at base | Hospital Row |
| Airfield | Builds helicopters; unlocks air-support abilities | Airport |

### Outposts

- An Engineer Team establishes an outpost after a district is cleared. Build-time target: about 30 seconds.
- Outposts are forward positions with a radio and a defensive perimeter.
- Outposts can be upgraded with barricades and a machine-gun nest.
- Units travel to outposts through the world; no teleporting.
- An outpost taken by zombies becomes a hive (§19).

### Command Post support powers [v4.4]

Click the Command Post to open its support panel. Each power costs money, has a cooldown, and is marked on the ground with its own smoke colour before it arrives (§8).

| Power | Smoke | Effect | Availability |
|---|---|---|---|
| Artillery Barrage | White | 8 shells over ~4 s across a 10 m radius; knockback; hurts friendlies too | Command Post (playtest: from the start; later gated by base progression) |
| Supply Drop | Green | Crate parachutes in (+45 supplies); a squad must reach it to collect | Command Post |
| Gun Run / Bombing Run / AC-130 | Red / Orange / Purple | See §8 | Airfield |

### Outpost resupply [v4]

Outposts **hold their own local supply stock**. Building defenses at an outpost, and rearming or servicing units there, draws from that stock rather than from the global pool directly. When the stock runs out, the outpost cannot build or rearm until it is resupplied.

- Resupply is delivered by **Supply Truck**, **Hauler Helicopter**, or (later) **airdrop**.
- Supply runs travel through the world and can be ambushed, which makes supply lines worth defending.
- This does **not** add ammo or fuel as resources (§11 still holds). It limits *where* the global supply pool can be spent.

### Engineer construction

Engineers can build predefined defensive structures **anywhere on the map**, not only at the base or outposts: roads, intersections, bridges, chokepoints, cleared buildings. An Engineer Team must be present, and building costs money and supplies. Bases and outposts are still the important production, resupply and service locations.

| Structure category | Examples / purpose |
|---|---|
| Placed weapons | Mounted machine guns, grenade-launcher emplacements, other unlockable weapons |
| Cover | Sandbag walls, concrete barriers |
| Area denial | Barbed wire and similar obstacles that slow or funnel zombies |
| Tall concrete walls **[v4]** | Expensive ~40 ft walls (see below) |
| Lure **[v4]** | Craftable loudspeaker (see below) |
| Base defenses | Sniper towers, mounted HMGs, mounted grenade launchers, mounted flamethrowers |
| Strategic support | Artillery strikes on districts, unlocked through base progression |

**Repair and resume [v4.4].** Right-click your own structure with engineers selected: an unfinished site is picked back up where it was left (a new order no longer throws the work away), and a damaged structure is repaired over roughly its build time, paying supplies as the crew works (about half the structure's supply cost for a full bar). Unfinished and damaged structures show a progress/health bar.

**Deconstruction [v4.2].** Engineers can take down anything the player built (not base facilities). An unstarted construction site refunds in full; a finished structure refunds half its cost and takes half its build time to dismantle. Dismantling your own outpost gives up the district quietly. Only a zombie takeover turns it into a hive.

**Tall concrete walls [v4].** Very expensive, slow-to-build walls about forty feet tall. They are the **one exception** to the pile-up rule: zombies cannot pile high enough to get over them. They are the "hold this forever" option, priced so they can't ring the whole city. They can be destroyed by explosives, Brutes and bosses (balance TBD).

**Loudspeaker [v4].** A craftable device engineers place to broadcast noise. It **pulls zombies toward one area**: into a kill zone, away from a weak outpost, or under an artillery strike. It is loud by design, so it also feeds the district's noise level and may draw more than you planned for. It has health and can be destroyed.

### 6a. Destruction, rubble, and the changing battlefield [v4]

- **Building destruction.** Buildings can be brought down by:
  - a direct hit from a plane-dropped bomb,
  - several direct tank shots,
  - fire burning over time.
- **Collapse crushes** everything inside or next to the building: **friendlies and zombies alike**. Elite units on a roof go down with it.
- **Rubble is permanent.** It changes the battlefield for good: blocking streets, creating new cover, opening or closing routes and chokepoints. Collapsing a building can seal a street against a horde, or cut off your own supply route.
- **Tanks crush static cars.** Battle Tanks (and later heavy armor) flatten parked and abandoned cars, removing them as cover and obstacles. Lighter vehicles must go around.
- Wrecked player vehicles still block the street until cleared (see §7 vehicle damage).

---

## 7. Unit roster and progression

The core unit roles and unlock structure stay the same. The roster covers infantry, support, armor, transport and aviation. Costs, command weights and upkeep are balance values.

| Unit | Role | Unlock / notes |
|---|---|---|
| Rifle Squad (4) | All-round infantry | Starting unit; main early-game force |
| Engineer Team (2) | Builds outposts and defenses; restores power; patches vehicles | Starting unit |
| Medic Team (2) | Pistols (15 m). **Heal** (K): treats a chosen squad for 2 s → +40% health and fallen soldiers back; 30 s cooldown (v4.61) | Build a Med Bay |
| Recon Pair (2) | Quiet, fast scouts with long vision | Suburbs / Barracks level 2 |
| Machine Gun Team (3) | Crowd suppression; slow movement | Main Street / Armory |
| Sniper Team (2) | Long-range precision against dangerous targets | Main Street / Armory |
| Flame Team (3) | Burns hives and packed hordes at short range | Harbor / Armory level 2 |
| Mortar Team (3) | Indirect fire; strongest when positioned at an outpost | Harbor / Armory level 2 |
| Gun Jeep (HMMWV-inspired) | Fast scout and harasser with mounted MG | Industrial Park / Armor Station |
| Supply Truck (HEMTT-inspired) | Moves squads and supplies; **outpost resupply [v4]** | Industrial Park / Armor Station |
| LAV (M2 Bradley-inspired) | Armored carrier with autocannon; mobile cover | Stadium / Armor Station level 2 |
| Battle Tank (M1 Abrams-inspired) | Heavy siege vehicle; drives through crowds; **crushes cars, can bring down buildings [v4]** | Stadium / Armor Station level 2 |
| Self-propelled howitzer (M109 Paladin-inspired) **[v4, candidate]** | Long-range tracked artillery; strike patterns (below) | Proposed: Stadium / Armor Station level 2 |
| Rocket artillery truck (M142 HIMARS-inspired) **[v4, candidate]** | Long-range precision rocket salvos | Proposed: Airport / late game |
| Hawk Helicopter (Black Hawk-inspired) | Transport with door miniguns; **squads can rappel [v4]** | Airfield |
| Sparrow light helicopter (Little Bird-inspired, placeholder name) **[v4]** | Fast light helo with miniguns; carries 4 infantry on side benches | Airfield |
| Hauler Helicopter (Chinook-inspired) | Transports squads and supplies; evacuates wounded | Airfield |
| Hornet Gunship (Cobra-inspired) | Light controllable gunship for strafing and scouting | Airfield |
| Anvil Gunship (Apache-inspired) | Heavy controllable gunship for dangerous targets | Airfield |

**Rappelling [v4].** Infantry can fast-rope from a hovering Hawk onto rooftops or streets without the helicopter landing. That avoids landing in a horde, but the Hawk must hover low and still while troops go down, which exposes it to clinging Walkers and Runners (§9).

**Artillery strike patterns [v4].** Artillery units (Mortar Team, howitzer, rocket artillery, and the base artillery strike) can fire in selectable patterns:

| Pattern | Use |
|---|---|
| Point | Concentrated fire on one spot: hives, bosses, buildings |
| Line / creeping barrage | A strip of fire that walks along a street toward or away from a position |
| Area / box | Spread fire across a block to thin a horde |
| Ring / perimeter | Fire around a friendly position to break an encirclement |

Which units get which patterns is a balance decision. Artillery is loud.

### Squad losses and leveling

- Infantry squads have two to four members sharing **one squad health pool** **[v4.9]**. Damage to any member comes off the shared pool, and a soldier drops out each time the pool crosses one member's share (a 4-man squad loses one at 75%, 50% and 25%), taking their firepower with them. At 0 the squad is wiped for good.
- A squad with no members left is permanently lost, along with its experience and level.
- Squads gain experience from kills, boss kills and taking part in cleared districts.
- Progression: **Recruit** (base) → **Regular** (+15% health, +10% damage) → **Veteran** (+30% health, +20% damage) → **Elite** (choose one of two class-specific paths).
- The Rifle Squad's Elite paths come first: an M320 grenade-launcher path (**Grenadier Squad**) or an incendiary-ammunition path (placeholder **Cinder Squad**). Other classes get paths later.
- **[v4]** Elite status also unlocks **rooftop access** (§5) and **cosmetic customization** (below).

### Elite armory access and customization

Reaching Elite unlocks Armory access for that unit. Elite units can visit the Armory to customize weapons and unlock more weapon options: attachment slots such as grips, flash hiders, extended magazines and sights; alternate rifles and other weapon classes as the campaign progresses. Weapons and attachments are set **per infantry member** where supported.

**Visual and clothing customization [v4].** At the Armory, Elite units can also change their look: uniforms and camo, headgear, patches, face gear and similar options, per member where supported. This is cosmetic only and has no stat effect. It exists to make players attached to soldiers they can lose.

### Vehicle leveling and upgrades

Vehicles that survive and stay in service earn experience and level up. Level bonuses and upgrade paths are still to be designed. Vehicles do level; they are not static purchases. Damage stays visible and affects performance.

| Vehicle health | Visual state | Effect |
|---|---|---|
| 75–50% | Dented; light smoke | ~15% slower |
| 50–25% | Panels damaged; heavy smoke | ~30% slower; secondary systems may go offline |
| Below 25% | Burning | ~50% slower; main weapon fires at reduced rate |
| 0% | Wreck | Vehicle lost; blocks the street until cleared |

**Sheet-metal armor [v4].** A Repair Station upgrade that bolts sheet metal onto a vehicle's exterior. It **stops zombies climbing onto the vehicle** and **adds health**. The trade-off (cost, some speed loss, visible scrap-armor look) is a balance decision.

---

## 8. Airfield and air support

The Airfield is unlocked by securing the Airport and restoring its power. It provides controllable helicopters and unlocks aircraft and drone support abilities. Support aircraft do not replace the helicopters.

| Air asset | Control model | Function |
|---|---|---|
| Hawk Helicopter | Controllable unit | Transport with door miniguns; rappel deployment [v4] |
| Sparrow light helo [v4] | Controllable unit | Fast minigun helo carrying 4 infantry |
| Hauler Helicopter | Controllable unit | Transports squads and supplies; lands in suitable areas; evacuates wounded |
| Hornet Gunship | Controllable unit | Fast light gunship; chain-gun strafing; limited endurance |
| Anvil Gunship | Controllable unit | Heavy gunship; rocket pods for Brutes, hives and bosses; limited ammo |
| Heavy attack plane (placeholder name) | Air-support ability | A-10-style gun run that levels a large stretch of zombies along a line |
| Fast fighter (placeholder name) | Air-support ability | F/A-18-style bombing run; HE or incendiary bombs; **direct hits can collapse buildings [v4]** |
| AC-130 gunship **[v4]** | Air-support ability | ~90-second orbit using its full weapon set (25 mm, 40 mm, 105 mm). Very expensive, very effective. |
| Patrol drone | Placed / autonomous ability | Patrols a district and automatically attacks hordes it detects |

- Support abilities have real cooldowns, costs or limits so they stay powerful without replacing ground forces.
- The heavy plane does a broad gun run; the fast plane does a bombing run with an HE or incendiary choice.
- The AC-130 is the most expensive call-in. Over its orbit it automatically engages zombies in a target circle the player can move. Its 105 mm counts as a heavy explosive (knockback, hive damage, building damage).
- The drone patrols a district and attacks hordes automatically. Duration, ammo, health and redeployment are balance values.
- Controllable gunships have limited ammo and must return to the Airfield to rearm. Helicopters and vehicles use RTB/servicing rather than a fuel system.
- The Airport unlock must come early enough before Downtown Core for the player to make real use of it.

**Colored smoke marking [v4].** Every aircraft call-in is marked on the ground with a **colored smoke** grenade before the strike arrives. Each call-in type has its own color, so the player (and the battlefield) can read what's coming:

| Call-in | Smoke (proposed) |
|---|---|
| Heavy attack plane gun run | Red |
| Fast fighter bombing run | Orange |
| AC-130 orbit | Purple |
| Artillery barrage (Command Post) **[v4.4]** | White |
| Supply / upgrade airdrop | Green |
| Helicopter LZ / extraction | Yellow |

At night, smoke is replaced by or paired with matching **flares/strobes** so marking stays readable.

---

## 9. Zombie roster and behavior

**Zombie classes [v4.13].** Every zombie type belongs to one class:

| Class | Types | Spawning |
|---|---|---|
| **Normal** | Walker, Runner | Normal pool |
| **Medium** | Bloater, and every other non-boss type (Screamer, Brute, Dragger, Puker…) | Medium pool |
| **Boss** | Planned bosses (§21 Tier 3) | Placed or event-spawned; outside both pools |

Each district's population limit is the **normal pool + medium pool**. Hives and pulses fill the two pools separately, so common Runners can't crowd out the rarer medium types, and the medium share stays capped however big the horde gets. Difficulty tiers set both pool sizes.

The roster mixes basic crowd threats, tougher special types, persistent hives and bosses. Specials have more health than Walkers and Runners, but not so much that they feel like bosses. Bosses are a separate tier and appear after the opening sequence.

| Zombie | Behavior / threat | Counterplay |
|---|---|---|
| Walker | Slow, weak alone, dangerous in crowds | Machine guns, flame weapons, vehicle run-over |
| Runner | Fast and weak; sprints toward noise | Rifle squads in cover; vehicle run-over |
| Bloater | Slow, swollen; bursts into a toxic cloud when killed | Snipers at range; don't kill it next to friendly squads. Cloud is flammable. |
| Screamer | Hangs back and shrieks, filling the noise meter | Snipers or fast recon |
| Brute | Armored, hits hard, resists rifle fire | Snipers, Battle Tank, Anvil Gunship |
| Dragger | Long tongue wraps one infantry member and drags them off; the member dies if the pull lasts long enough. Any damage to the Dragger makes it let go. Can damage vehicles and helicopters but can't pull them. | Kill or damage it fast to break the pull |
| Puker | Spits acid that stays on the ground for ~3 seconds; can hit armor and helicopters | Avoid contaminated ground; kill it before it blocks movement |
| Hive | Infested structure that spawns zombies while active | Fire or explosives only; small arms can't destroy it |

### Hive progression and destruction

Hives spawn zombies for as long as they're active. Each hive moves independently through four permanent threat stages and never goes back down. Its stage is visible on the map/intel view.

1. **Dormant:** small groups spawn now and then, roaming close to the hive.
2. **Growing:** spawns come faster; bigger groups roam and threaten nearby infrastructure.
3. **Established:** much higher production and roaming; nearby defenses are under constant pressure.
4. **Overrun:** maximum production; large roaming hordes that can overwhelm nearby positions.

Hives can only be destroyed with fire or explosives: incendiary weapons, Flame Teams, grenades, charges, rockets, artillery, air-delivered ordnance. Destroyed hives never respawn. Destroying a hive does not spawn a boss; bosses are separate campaign events.

For performance, each hive has a spawn budget and counts toward a global active-zombie cap. When the cap is reached, hives pause or slow spawning. The cap and spawn rates are balance values.

### Horde behavior and environmental threats

- Horde pulses grow with the difficulty of the region sending them.
- **Noise** is a core mechanic. Weapons, engines and loud actions raise a noise level that attracts hordes. Quiet weapons and Sneak lower detection. **Loudspeakers [v4]** use this on purpose.
- **Aggro [v4.2]: time first, then distance.** A zombie that has seen a squad hunts it for ~20 s even after losing sight (it keeps pathing toward the squad), then keeps coming while the squad is within ~60 m. Simply running away no longer shakes them; breaking contact takes distance *and* time.
- **Getting shot makes them angry [v4.4].** A zombie that's hit turns on whoever shot it (unless it's already biting someone), even from beyond its sight. Fixes Bloaters sometimes ignoring fire.
- **Hive alarm [v4.2].** A squad within ~20 m of a hive draws every zombie around the hive (~45 m) onto it. Charges are planted over 3 s and getting hit restarts the plant, so engineers need covering fire. (Playtest bots found that a lone engineer could sprint past walkers and one-shot a stage-1 hive.)
- **Pile-ups.** Zombies can pile up and climb over each other to get over barricades, vehicles, small buildings **and onto rooftops [v4]**. Height and barriers don't guarantee safety. **Exception [v4]:** tall concrete walls (§6) are too high to pile over.
- Walkers and Runners can cling to helicopters hovering low or landed, which makes low hovering, landing **and rappelling [v4]** risky in infested areas.
- Vehicles can run over Walkers and Runners without taking damage. Specials such as Pukers and Draggers can damage vehicles. **Vehicles with sheet-metal armor [v4]** can't be climbed.
- Soldiers killed by the horde can rise again as zombies.
- **[v4]** Zombies are knocked back by close explosions and crushed by collapsing buildings.

### Bosses

From Hospital Row on, each major district has a boss with a trait that counters a standard tactic. Bosses drop a reward item.

| Boss | District | Defining mechanic |
|---|---|---|
| The Matron | Hospital Row | Heals nearby zombies and raises downed ones until killed |
| The Foreman | Harbor | Throws shipping containers from range, changing cover and blocking streets |
| The Stampede | Stadium | A stadium-sized horde charges the loudest sound |
| The Dispatcher | Airport | Coordinates Runner waves; makes noise especially dangerous in the district |
| Patient Zero | Downtown Core | Calls surviving hives across the city into the final fight |

The Bloater's toxic cloud is flammable. Flame Teams or incendiary ammo can ignite it for a powerful area attack that can also hurt friendly units.

### 9a. Human enemy faction [v4, to be designed]

The **last two zones** (assumed to be **Airport** and **Downtown Core**; to confirm) add a **hostile human faction** alongside the zombies. This is the first enemy that shoots back, uses cover and makes noise of its own. Three-way fights (player vs. humans vs. zombies) are expected.

Open questions:

- Who are they? (Deserters, a militia, a private security contractor, a cult around Patient Zero?)
- Unit roster, vehicles, and whether they have air defense that threatens the Airfield's aircraft.
- Do they hold territory and outposts the player can capture?
- Do they ever fight zombies, or does the horde ignore them?
- Can they be negotiated with or recruited (tie-in with Guerrillas, §10)?

**Framework note:** combat code must support **faction-vs-faction** targeting from day one (not just "player vs. zombie") so this faction can be added without a rewrite.

---

## 10. Civilians and guerrilla recruits

Civilians are sometimes found hiding in buildings or other spots in infested districts. Rescuing and evacuating them gives the player a reason to explore and secure areas, not just chase hives and kill counts.

- Successful evacuation can reward money and supplies.
- Some rescued civilians may volunteer as a special unit type: **Guerrillas**.
- Guerrillas are a distinct recruitable unit, not a replacement for trained infantry. Weapons, strengths and recruitment limits are to be designed.
- Rescues should be occasional, not guaranteed in every district.

---

## 11. Economy, upkeep, and servicing

Two resources: **money** and **supplies**. Money is harder to get and is the main limit on expansion. Supplies are easier to come by and pay for unit creation, daily upkeep, repairs and restoring squad members. Ammo and fuel are not resources the player has to buy.

| Resource | Earned from | Spent on |
|---|---|---|
| Money ($) | Secured-district income, one-time clear rewards, civilian evacuations, searched buildings | Recruiting units and vehicles, construction, air-support calls |
| Supplies | Base/outpost income, supply crates, cleared buildings, district rewards | Unit production, daily upkeep, repairs, restoring lost members, **outpost stock [v4]** |

- **Kill salvage [v4.4].** Every kill pays a little: Walkers and Runners $1 + 1 supply, Bloaters $4 + 3, Screamers $3 + 2, Brutes $10 + 6 [v4.5]. Fighting pays for itself a bit; holding a secured district still pays far better.
- **Supply income is continuous [v4.5]** (+9/min from the base depot, +5/min per secured district), not a lump at day's end, so the 12-minute day never starves the opening.
- Each active unit costs supplies once per in-game day. This is a predictable upkeep payment, not a constant drain during combat.
- Supplies are not spent on ammo or fuel.
- Vehicles still RTB for servicing and rearming where relevant. RTB is a behavior, not a fuel minigame.
- Repairs and restoring lost infantry use supplies.
- Supplies should be far easier to get than money; the player is mainly limited by money and force capacity.
- Supplies are one shared pool for the whole force. **[v4]** Outposts keep a local stock filled from that pool by physical resupply (§6).

### Starting economy and balance targets

Original target: **$250**, **100 supplies** (150 storage cap), **command cap 8**, with two Rifle Squads and one Engineer Team. To be revisited once upkeep and supply costs are in.

### Horde counterattacks

Infested neighboring districts send horde pulses toward the nearest outpost now and then. Target cadence: about every four minutes. The loudest neighbor sends the biggest pulse, and pulse size scales with the difficulty of the source region. Garrisons and defenses help hold them off.

### Airdrop upgrades [v4, open question]

Proposal under consideration: support items and upgrades (supply crates, ammo/equipment crates, field-upgrade kits, reward items) can be **airdropped** to a green-smoke-marked location instead of collected at base. The drop lands in the world and must be secured before zombies (or the human faction) reach it.

- Is this a paid call-in, a reward, or both?
- Can airdrops deliver "upgrades" (e.g. sheet-metal kits) to units in the field, or only supplies?

---

## 12. Unlocks and campaign progression

Unlocks are driven mainly by restoring power in key districts, not by a big tech tree. Securing districts gives income, experience and occasional reward items. Restored power ties campaign progress to base facilities and new unit types.

| Progress point | Unlock / reward |
|---|---|
| Suburbs power | Barracks level 2; Medic Team and Recon Pair |
| Main Street power | Armory; Machine Gun Team and Sniper Team; **loudspeaker [v4]** |
| Industrial Park power | Repair Station and Armor Station; Gun Jeep and Supply Truck; **sheet-metal armor [v4]** |
| Hospital Row power | Medbay; restores lost squad members at base |
| Harbor power | Armory level 2; Flame Team and Mortar Team; larger Supply Depot |
| Stadium power | Armor Station level 2; LAV and Battle Tank; **howitzer (candidate) [v4]**; **tall concrete walls (proposed) [v4]** |
| Airport power | Airfield: Hawk, **Sparrow [v4]**, Hauler, Hornet, Anvil; air-support abilities incl. **AC-130 [v4]** |
| Downtown Core | Final district; securing it and defeating Patient Zero wins the campaign |

Command Post level 2 and artillery support connect to Airport / late-campaign progress. The Airport must be available before the final district.

### Reward items

About one district in three, and every boss, drops a one-off reward item: suppressor kits, ceramic plates, thermal optics or other squad equipment. Items are assigned to a squad and specialize the force.

---

## 13. Win conditions, defeat, and base security

- **Win:** secure Downtown Core and defeat Patient Zero.
- **Squad wipe:** a squad that loses every member is permanently gone, including its experience.
- Losing outposts costs income and territory and can let hives back in (§19), but does not end the campaign by itself.

### Last Stand defeat mode [v4] (tabled v4.12)

*(Replaces v3's "future endgame base-breach challenge" and "main base cannot be destroyed".)*

Because zombies can retake regions through hives (§19), a player who keeps losing ground can be **pushed all the way back to the main base**. When the last outpost falls and the horde reaches the base, the game triggers a **Last Stand**:

- A scripted, high-intensity defense: a huge horde attacks the base for a **set amount of time**.
- Clear warning beforehand (radio chatter, map alert, a short countdown to prepare).
- **Survive:** the horde breaks, pressure eases, and the player **gets another chance to retake the city**. Survivors keep their experience.
- **Fail:** the base falls. *Open question: campaign over, or restart from a checkpoint/earlier save?*

Open questions: can a Last Stand happen more than once? Does each one get harder? Should surviving give a breather (hives pause briefly, emergency supply drop)?

---

## 14. Visual and audio direction

**[v4.3] The game is isometric first, not pixel art.** It is a clean, full-resolution, anti-aliased 3D isometric world with stylised low-poly detail. Pixel art is at most a loose influence (chunky shapes, bold readable silhouettes, a little crunch in textures); there is **no pixel filter or low-res rendering**. It should feel like a detailed miniature battlefield, not flat sprites or a voxel game.

- **Camera:** isometric, with smooth zoom between strategic overview and close battlefield view.
- **World:** detailed ruined streets, buildings, interiors, vehicles, vegetation, debris, fortifications, **permanent rubble [v4]**.
- **Materials:** stylised flat-shaded colours and simple textures, chunky geometry, crisp edges, controlled detail.
- **Lighting:** directional light, shadows, muzzle flashes, fire, smoke and atmosphere communicate time, danger and activity.
- **Readability:** friendlies, zombies, cover, attack ranges and formations must stay easy to tell apart at both zoom levels, **day and night [v4]**.
- **Animations:** infantry moving and firing, vehicle damage, helicopter landing/hovering, zombie swarms, climbing piles, Dragger pulls, Puker acid, **rappelling, building collapse, knockback, colored smoke [v4]**.

**Palette:** desaturated greys, browns, muddy teal, olive and tan for military units; sickly yellow-green for zombies. Red is reserved for infestation and danger.

### Target look for the finished game [v4.1]

The current MVP visuals (code-built boxes) are placeholders for testing. The finished game aims for a **detailed, sun-lit miniature city seen from a high isometric angle**, based on reference images supplied in November 2026. Concretely:

- **Real scale.** Soldiers are small next to the world: a two-storey house is several times a soldier's height, and streets are wide multi-lane roads with sidewalks, crosswalks, streetlights and parked cars. The city should feel big and the squads should feel vulnerable in it.
- **Detailed, readable buildings.** Suburban houses with pitched tile or shingle roofs, porches, balconies, garages and fences; flat-roofed apartments and commercial blocks with rooftop clutter (AC units, solar panels); warehouses, an airfield and a desert outskirts biome. Palm and leafy trees, hedges, scrub, lawns.
- **Lighting carries the mood.** One strong sun with long, crisp shadows; a warm/neutral midday and an orange-brown dusk grade; at night, floodlights, searchlights, flares, muzzle flashes and fires do the lighting (ties into §14 day/night and the flare launcher).
- **Massive crowds.** Hordes are dense carpets of individual zombies: hundreds on screen routinely, **thousands** at a Last Stand and around neglected hives. Blood spatter on asphalt, bodies and debris persist. **[v4.4]** Implemented first pass: animated CC0 characters drawn with flipbook instancing (a few draw calls for any crowd size), corpses that lie where they fell, a 1,500-zombie cap, and Overrun hives that grow toward 300 locals.
- **Spectacle that stays readable.** Tank muzzle blasts, red tracer streams, explosion fireballs with sparks, rising black smoke columns from wrecks, dust clouds, helicopter rotor wash and fast-ropes, jets with afterburners on strike runs, artillery pieces with visible crews.
- **Fortified bases look built.** Tall modular walls with walkways and turret blocks, sandbag rings, gun pits, floodlight towers, vehicle gates.
- **Labels on units.** Small callsign tags with health pips over squads, vehicles and aircraft (e.g. `SQ-14`, `TK-1`, `UH-3`), and distance markers for off-screen SOS/objectives.
- **Camera.** Smoothly **rotatable** in 90° or free steps (compass readout), plus zoom from street level to a wide overview.

**UI direction** (standard RTS conventions, styled to fit): a bottom strip of unit cards (portrait, callsign, health pips, filter tabs for ground/air), a support panel listing call-ins with remaining uses, a minimap with compass and legend, a top-centre day clock with "dusk in mm:ss", and a contextual construction bar (walls, defence, fire support, supply, lighting) with blueprints and placement help.

**What this means for production** (decisions needed; see §16):

1. **Art assets.** Code-generated boxes won't get there. The look needs modelled and textured 3D assets: buildings, vehicles, aircraft, props, soldiers and zombies with animation. Options: model in-house (e.g. Blender), license asset packs that match the style, or commission an artist. Whichever we choose, the renderer will load glTF models in place of the placeholder meshes; sim code doesn't change.
2. **World scale — DECIDED.** **1 world unit = 1 metre.** Navigation uses a 3 m grid, so a "64 × 64" starter zone is 64 × 64 grid cells = **192 × 192 m**. Soldiers are 1.8 m, cars 4.6 m, buildings 6–15 m. Speeds and weapon ranges were doubled together (so fights close at the same pace) while the map grew 3×, and hearing scales with the map.
3. **Crowd tech.** Thousands of zombies needs GPU-instanced, vertex-animated zombie meshes plus flow-field pathing, with the simulation in a Web Worker. This is the single biggest performance item and is the most likely trigger for the "move to desktop" decision in §15.
4. **Camera rotation — DONE.** Q / E rotate in 90° steps with a compass readout. Building see-through/cutaway when a building hides units is still to do.

### Day/night cycle [v4]

*(Moved up from "deferred"; now a planned feature.)*

- A full day/night cycle tied to the in-game day (and the daily upkeep tick).
- **Night** cuts vision ranges, makes fog of war denser, and makes zombie behavior more dangerous (balance TBD: more active, bigger pulses).
- **Flares** light up an area for a limited time. They can be fired by infantry, launched from outposts, or dropped by aircraft. Flares are noisy-bright: they may draw attention (balance TBD).
- Vehicle and helo spotlights, muzzle flashes and fires become important light sources.
- Colored smoke marking switches to flares/strobes at night (§8).

### Audio

- Low-fi, grimy synth drones that swell as noise and horde pressure rise.
- Distinct weapon sounds; layered zombie groans that grow with horde size.
- Engine and aircraft audio feed the atmosphere and the noise system.
- Gritty, dry radio chatter with occasional dark humor.

Sample lines:
- Engineer: *"Give me thirty seconds and a lot of sandbags."*
- Machine Gun Team: *"I brought enough ammo to be rude."*
- Medic: *"Stay down. That's medical advice and an order."*
- AC-130 **[v4]**: *"Overlord on station. Ninety seconds of bad news, coming right up."*

---

## 15. MVP scope and development plan

Start as a browser game. Move to a desktop build only if the continuous 3D battlefield, simulation scale, rendering or performance become too much for the browser. Decide that based on actual technical limits, not in advance.

### Browser-first MVP

- A compact opening area: the main base and one 64 × 64 starter zone. Later the opening grows to three 64 × 64 zones and two larger maps.
- Isometric 3D rendering prototype with zoom and pan between strategic and close views.
- Rifle Squad and Engineer Team; Walker, Runner and Bloater; an initial hive objective.
- Selection, move, cover, hold, attack-move, stop, Shift+click waypoint queueing.
- Autonomous squad combat **with threat-priority focus fire [v4]**, member-by-member losses, permanent squad wipes.
- A basic noise system that draws hordes, and a first horde-pulse test.
- Main base production, money, supplies, daily upkeep, outpost setup, engineer-built field fortifications.
- Continuous-world persistence: units and combat stay active across zoom levels.
- **Static cars as cover [v4]** (crushing comes with tanks).

### Defer until after the core is fun

- Full district set, later map areas, advanced hive progression, all bosses.
- Advanced infantry, vehicles, helicopters, air strikes, drones.
- Dragger, Puker, pile-ups, helicopter clinging, soldier reanimation.
- Civilians, evacuation, Guerrillas.
- Advanced construction catalogue (incl. tall walls, loudspeaker).
- Weapon customization and cosmetics.
- Vehicle leveling and upgrades (incl. sheet metal).
- Last Stand defeat mode.
- Day/night and flares; building destruction and rubble; human faction.

### Build order

| Step | Focus |
|---|---|
| 1 | Prototype the isometric world, camera, zoom and persistent simulation. |
| 2 | Unit movement, selection, formations and squad representation. |
| 3 | Combat, threat-priority targeting and individual member losses. |
| 4 | Squad AI, cover and core orders. |
| 5 | Walker/Runner AI, hives, noise and horde response. |
| 6 | Base production, money, supplies, daily upkeep, command limits. |
| 7 | District infestation, fog of war, outposts and power restoration. |
| 8 | Leveling, repairs and the first reward item. |
| 9 | Expand content and systems only once the core battlefield is fun and stable. |

**Fun check:** before adding lots of content, test whether a few Rifle Squads holding a street against a Walker horde is satisfying. If it isn't, fix that before building more on top.

---

## 16. Deferred design questions and tuning

These are left open on purpose so they don't block the core design or the prototype.

- **Vehicle progression:** levels, bonuses, upgrade branches, per-model paths.
- **Aircraft support:** costs, cooldowns, targeting, damage radius, heavy plane's final name; **AC-130 cost, orbit radius, weapon cycling [v4]**.
- **Drones:** patrol duration, attack behavior, health, limits, servicing.
- **Guerrillas:** squad size, weapons, recruitment, progression.
- **Infantry loadouts:** weapon availability, per-member inventory, costs.
- **Engineer construction:** exact structures, build times, prices, upgrades, repair/salvage. Confirmed: engineers can build anywhere.
- **Day length and upkeep timing:** ~~day length~~ **12 real minutes per in-game day [v4.2]** (4 min felt far too fast); how the player is warned before supply deductions; **night difficulty modifiers [v4]**.
- **RTB rules:** which vehicles return, how servicing works, whether helicopters use separate rearm points.
- **Direct-control input mapping.**
- **Continuous-world performance:** simulation detail at strategic zoom, entity limits, streaming, the point where a desktop build makes sense. **Rubble and destruction add to this [v4].**
- **[v4]** Human faction identity, roster and behavior (§9a).
- **[v4]** Last Stand fail outcome, repeatability, scaling (§13).
- **[v4]** Airdrop upgrades scope (§11).
- **[v4]** Artillery vehicles: whether the howitzer and/or HIMARS-style unit make the cut, and their unlocks.
- **[v4]** Building destruction thresholds (HP per building class, fire spread rate).
- **[v4]** Tall wall cost, build time and what can destroy them.
- **[v4.1]** Art pipeline — DECIDED: no purchases. Procedurally generated buildings, roads, props, trees and fortifications (in code), plus free CC0 models (e.g. Quaternius, Kenney, Poly Pizza; check each model's licence) for animated soldiers/zombies and aircraft/armour.
- **[v4.1]** Crowd target (hundreds routine, thousands at a Last Stand) and whether that forces the desktop build.

---

## 17. Three-region starter tutorial and open-world transition [v4.9]

**Three tutorial regions** (replaces the earlier seven-mission plan). Two small regions, then one big one, each harder than the last:

1. **Region 1 (small):** Roadside Motel, the current 192 × 192 m zone. Basics: camera, selection, movement, cover, noise, fortifying, recruiting, support, killing a hive, securing.
2. **Region 2 (small): Gas Station Strip** ✔ v4.11. 192 × 192 m east of the motel, on the same main road. Two gas stations (pump islands are low cover, canopies are walkable), a strip mall facing a big parking lot, a truck-stop diner, a car wash, houses and a small apartment block; the hive sits in the far south-east lot. Easy difficulty tier (tougher, more numerous dead than the motel, more Runners, a busier hive). Until the motel is secured it's behind a chain-link fence with jersey barriers across the road, dimmed on screen, and empty: no zombies, hive or noise. Securing the motel cuts the wire, seeds the district and wakes its hive. Scripted bots: careful advancing wins 6/6 (engineers usually lost at the hive); charging straight in is wiped 6/6. **[v4.12] Playtest: it didn't feel harder and taught nothing new (#74).** **[v4.14] Reworked:** a larger starting crowd (Easy tier: zombie HP 85%, density ×1.15), three Runner packs of four, the hive already at **stage 2**, the first horde after 7 minutes aimed at the motel outpost, and **guard towers** unlocked with a briefing card when the region opens. Scripted bots with 4 rifle squads and no towers or reinforcements: careful advancing now wins 3/6 with losses (region 1: 6/6 without losses), charging straight in 0/6.
3. **Region 3 (big): Rail Siding** ✔ v4.17. 390 × 240 m south of both earlier regions, fenced off (top and west edges) until Gas Station Strip is secured. A main road, the avenues running on south, and a rail line across the whole region lined with boxcars (cover and choke points), warehouses, a depot and workers' houses. **Two hives**, standard difficulty, a large starting crowd with six Runner packs.
   - **Power system (introduced here).** The region's **power station** stands offline in the east yard. Engineers restore it (right-click with engineers, ~25 s of work) but only while **no zombie is within 30 m**, so the player has to clear and hold the yard. The dead ignore it while it's dead; once running it's a target, and if they wreck it, it goes **offline** (it isn't destroyed) and must be restored again.
   - **Med Bay (unlocked by the power).** Engineers build it inside the main base (N, $150 · 40▣). It needs power. A squad resting next to it (not moving, not hit for 5 s) heals ~1.5% of its health per second, paying 0.12 supplies per point, and **lost soldiers rejoin** as health climbs back past each member's share. A wiped squad is still gone for good.
   - Briefing cards when the region opens and when the power first comes on; objectives include "Restore the power station".
   - Scripted bots (6 rifle squads + 2 engineers, no towers/healing/reinforcements): careful advancing wins 6/6 but usually loses a squad or two; charging in wins 3/6. Starting either hive at stage 2 made it swing to 1–2/6, so the hives start at stage 1.

**Regions attach as you go.** Clearing a region opens the road from HQ to the next one; the new region is added next to the existing map, not loaded as a separate level, so the city stays one continuous world (§2). Until a region is attached, its edge is closed.

**Open-world unlock.** After region 3, the remaining starter districts (from the old seven-mission plan) become the first part of the open world. The three tutorial regions stay connected parts of the same persistent city: the player can travel back, defend them and respond to new infestations.

## 18. Tutorial presentation and final test

The starter sequence is a guided tutorial. During instruction, **the game pauses** while clear on-screen prompts explain the mechanic and tell the player what to do. The simulation resumes when the player dismisses or completes the prompt.

**Progressive instruction.** Prompts introduce controls and systems in a set order, each shown in the relevant starter area. Prompts are short, actionable and tied to the current objective.

**Implementation status [v4.6].** The tutorial system is built and mission 1 (Roadside Motel) is scripted: 12 steps covering camera, selection, movement, cover, noise and targeting, fortifying, recruiting, Command Post support, the hive and securing the district. Each step pauses with a prompt; after "Got it" it becomes an objective banner while you play, the relevant HUD panel pulses, and steps you've already completed advance on their own. Missions 2–7 need their maps first.

**Final test.** The last one or two larger starter regions are a practical final test: they combine earlier mechanics with less step-by-step instruction. They're still part of the tutorial and must be completed before the open world unlocks.

## 19. Region loss, hive takeover, and progression regression

A secured region isn't permanently safe. If zombies retake it, the friendly outpost is lost and **replaced by a zombie hive**. This is a change of control, not just a higher infestation number.

**Consequences of a takeover:**

- The outpost is destroyed and a hive takes its place.
- The region is no longer secured; its income and forward benefits are lost while the hive is active.
- Infestation and zombie pressure come back, and the new hive starts its own threat progression.
- To reclaim it, the player must clear the region again, destroy the hive with fire or explosives, bring infestation down, and have engineers re-establish an outpost.

Leaving a region unattended can therefore cost territory, income and forward presence. Takeovers must be visible and clearly communicated so they feel like a consequence of a changing battlefield, not an unexplained state change. **[v4]** Repeated takeovers that reach the main base trigger the **Last Stand** (§13).

**Progression boundary.** Losing a region reverses that region's secured status and local benefits. It does not revoke permanent global unlocks earned elsewhere unless a future system says so.

## 20. Clarifications to earlier rules

- Engineers may build field fortifications anywhere on the map, not only at the main base or outposts.
- The three tutorial regions stay part of the persistent open world after the tutorial.
- The old rule that a fallen outpost leaves the region at a fixed 40% infestation is superseded by the takeover rule: a full zombie retake replaces the outpost with a hive.
- Hives spawn zombies while active, go through four escalating threat stages, have a spawn/population limit for performance, and can only be destroyed with fire or explosives. Bosses are separate from hive destruction.
- **[v4]** Pile-ups can scale barricades, vehicles, small buildings and rooftops, **but not tall concrete walls**.
- **[v4]** The v3 rule "main base cannot be destroyed" is replaced by the Last Stand (§13).
- **[v4]** Outposts need physical resupply to build and rearm (§6). This is a logistics rule, not an ammo/fuel resource.

---

## 21. Feature priority roadmap [v4, re-ranked v4.10]

Every feature, ranked by importance to the game being fun and shippable. **Work goes top to bottom**: within a tier, items are in priority order, and the next thing to build is the first open item. ✔ = done. Playtest note numbers (#) point to §22. The code has **extension hooks** for many later items (see `README_old.md` → *Architecture*).

### Tier 0: MVP core ✔
1. ✔ Isometric 3D world, camera pan/zoom/rotate (WASD, MMB), fixed-step persistent simulation, pause and 4× speed
2. ✔ Selection, move, attack-move, hold, stop, Shift-waypoints, cover, disband
3. ✔ Squads with one shared health pool, soldiers dropping at thresholds, permanent wipes
4. ✔ **Threat-priority focus fire**, forced targets
5. ✔ Walker, Runner, Bloater; hive with stages; noise (with hold) and horde pulses
6. ✔ Money, supplies, daily upkeep, command cap, Barracks production and rally point
7. ✔ District infestation, engineer outposts, field fortifications (sandbags, barbed wire, MG emplacement)
8. ✔ Static cars as cover; house searching and zombies holed up in buildings
9. ✔ Per-district difficulty tiers (tutorial → easy → standard)

### Tier 1: The campaign loop (next)
10. ✔ **Tutorial region 2: Gas Station Strip** (v4.11). Fenced off east of the motel until the motel is secured, then the wire is cut, the region is seeded and its hive wakes (#58, §17)
11. ✔ **Playtest round 6 fixes** (v4.14): animation twitch (#67), noise decay (#72), zombie classes and pools + Bloaters in region 1 (#70, #75), artillery locked for later (#73), MG field of fire + ghost arrow (#71)
12. ✔ **Region 2 rework** (v4.14, #74): a real difficulty step, and **guard towers** (#54) as region 2's new feature: unlocked when the region opens, explained in a briefing card. Engineer-built (V, $120 · 40▣); one squad mans it for +40% range, sight over cars and walls, and half damage from ranged threats; melee goes to the tower, which the dead must tear down; any other order brings the squad down
13. ✔ **Playtest round 7 fixes** (v4.16, #76–84)
14. ✔ **Tutorial region 3: Rail Siding** (v4.17). The open-world unlock after it is still to come (#58, §17)
15. ✔ **Power stations**: the first one, in region 3 (v4.17). The wider network and the other base unlocks power drives come with the open world (§12)
16. ✔ **Med Bay** (v4.17), unlocked by restoring region 3's power. ✔ **Medic Team** (v4.61), unlocked by the Med Bay.
**Round 8 to-dos [v4.19], ranked (§22 #85–92):**
- 16a. ✔ **Longer sight** (v4.21, #86, #87): rifle 24 → 30 m, carbine 18 → 22 m, MG emplacement 22 → 35 m (120° arc kept); guard-towered squads ~42 m.
- 16b. ✔ (v4.28) **Civilians found by searching houses** (#91), introduced in tutorial region 3: a controllable civilian group that earns money and supplies when walked back to HQ. (Moves the civilians part of Tier 4 #36 forward.)
- 16c. **Zombies roam between districts and attack outposts** (#88). Needed before the open world: holding ground has to mean defending it.
- 16d. **Open-world unlock** (§17) with **an unlock-progress panel** (#92) showing what's left to unlock.
- 16e. **Police station and fire station** as loot landmarks (#89, #90) with a decent amount of supplies.
17. ✔ Region takeover → hive (§19)
18. Save / load (a persistent city needs it before the open world)
19. Fog of war and recon
20. Outpost resupply via Supply Truck
21. ✔ XP and leveling (Recruit → Elite); Elite paths (Grenadier/Cinder) still open
22. ✔ Explosion knockback

### Tier 2: Escalation and spectacle
23. Vehicles: Gun Jeep, Supply Truck, LAV, Battle Tank; sheet-metal armour. **Includes overrun and re-crewing** (#64): zombie pile-ups kill the crew, the empty hull stays, any infantry squad can board it, it starts at 50% HP and engineers repair it
24. Special zombies: Screamer, Brute, Dragger, Puker; reanimation
25. Day/night cycle and flares
26. Building destruction, permanent rubble, tank crushing of cars
27. **Artillery** (v4.12, #73: a later unlock, not available from the start): the Command Post barrage unlocks here, alongside the Mortar Team and strike patterns. The barrage itself is already built and just gets locked until then
28. Elite rooftop access and pile-ups onto roofs
29. Tall concrete walls, loudspeaker

*Tabled (v4.12, #69): **Last Stand defeat mode** (was Tier 2 #28). Kept in the doc (§13) for later; not scheduled.*

### Tier 3: Air power and late game
30. Air-support call-ins with coloured smoke: gun run, bombing run, AC-130, drone (supply-drop flyover ✔ is the template)
31. Airfield: Hawk (with rappelling), Sparrow, Hauler, Hornet, Anvil
32. Bosses (the uploaded "muscular zombie" is the first candidate model)
33. Human enemy faction (Airport, Downtown Core)
34. Howitzer / HIMARS-style artillery vehicles (if kept)

### Visual production track (runs alongside the tiers) [v4.1, updated v4.10]
- V1. ✔ World scale; ✔ camera rotation; ✔ glTF model loading
- V2. ✔ Instanced, animated crowds + flow-field pathing; ✔ smoother flipbooks (more poses, stable simplification), ✔ corpses fall. Web Worker deferred until real-hardware testing shows the sim is the limit
- V3. Real assets, in this order:
  1. ✔ Main zombie: "Zombie" by pxltiger (Idle/Walk/Run/Attack/FallingBack)
  2. **Replace all three cartoon Quaternius models (v4.12, #66): the big-headed female zombie, the rifleman and the engineer.** This is now the top visual item. Every replacement needs, at minimum, idle, walk, a shooting or attack loop, and a death that ends on the ground (plus a work/build loop for the engineer). None of the uploaded soldier models have animations, so the practical route is **Mixamo** (free, Adobe account, licence allows use in games): upload the chosen model or pick a Mixamo character, download each clip as FBX "with skin", and drop them in. The loader already handles multi-part glTF/FBX and texture colours. If an uploaded model won't rig cleanly, use a Mixamo stock soldier instead
  4. Aircraft for call-ins and flyovers (A-10, Huey, Chinook, Tiger, Reaper drone, fighter jet), compressed when wired in
  5. Ground vehicles for Tier 2 (Bradley, tank, Ural truck)
- V4. Lighting pass: dusk grade, night lights/flares, smoke columns, fire
- V5. UI restyle toward the §14 direction (unit-card strip, minimap, day clock). ✔ UI scale and collapsible panels
- **Parked until better-animated soldier models:** idle realism (#22), engineer build animation (#23), leaning against cover (#25)

### Technical track (v4.20) — groundwork the open world depends on
These get more expensive the longer they wait, so they're scheduled *before* the open-world unlock (ranked together with the features in `STATUS.md`).
- **T1. ✔ Real-hardware performance check** (v4.22, round 9 #100): frame rate fine with a lot of zombies on the owner's machine. Web Worker not needed for now.
- **T2. Sound** (first pass ✔ v4.24: gunfire, deaths, groans, screams). Still to add: explosions, building, footsteps, UI, ambience. Originally: gunfire per weapon, zombie groans/attacks, explosions, UI, ambience (CC0 packs). Noise is a core mechanic and the game is silent. The radio lines are ready for voice later.
- **T3. Split the oversized code**: the renderer (~1,200 lines) and the World class into focused modules. No behaviour change.
- **T4. Map data format** (+ simple editor or an existing tile editor). The layout is hand-typed coordinates in code today; a city needs data files.
- **T5. Chunked ground and streaming.** One ground texture (2,550 × 2,280 px) won't survive a growing city; chunks that load near the camera.
- **T6. Pre-baked character animations.** Bake the flipbooks offline instead of processing ~20 MB of models on every launch.
- **T7. Save / load**, moved up from Tier 1 #18: the state keeps growing (searches, unlocks, power, crates, hives), so it only gets harder.
- *Housekeeping:* ~200 MB of uploaded models in git history (rewrite needs a force-push and the owner's OK); Web Worker for the sim if T1 shows the sim is the bottleneck.

### Tier 4: Polish and attachment
35. Armory weapon customization and Elite cosmetics
36. Civilians, evacuation and Guerrillas
37. Vehicle leveling paths
38. Airdrop upgrades
39. Reward items catalogue, full campaign balancing

*Design status: v3 decisions remain confirmed. v4 additions are confirmed direction except where marked "candidate", "proposed" or "open question". All numbers are subject to playtesting.*

---

## 22. Playtest feedback log [v4.2]

First hands-on playtest of the browser MVP (November 2026). Every note, and what was done about it.

| # | Note | Status |
|---|---|---|
| 1 | Zombies don't react to gunfire, only to sight | **Fixed (v4.1).** Hearing radius was below sight range. Gunfire is now heard ~73 m (rifle) to ~106 m (MG) and zombies path around buildings toward it. |
| 2 | Right-click a zombie to force units to attack it | **Done.** Forced target overrides threat priority (§5). |
| 3 | Rotate the camera with middle mouse held | **Done.** Middle-drag rotates freely; Q/E snap 90°; Shift + middle-drag pans. |
| 4 | Riflemen need a bit more range | **Done.** 18 → 24 m (carbines 14 → 18 m). |
| 5 | Zombie aggro should be time-based first, then distance-based; they give up too easily if you run | **Done.** 20 s hunt after losing sight, then a 60 m leash (§9). |
| 6 | UI buttons sometimes need several clicks; rotating sandbags only updates when the mouse moves | **Fixed.** The HUD re-rendered 8×/s and swallowed clicks; panels now only redraw when their content changes, and buttons act on press. The placement preview refreshes every frame. |
| 7 | Units are too stiff; they should move around a bit instead of a strict formation | **Done.** Loose, drifting, individually paced squad members (§5). |
| 8 | Normal zombies (walkers, runners, screamers) should be a bit weaker | **Done.** HP: Walker 45 → 36, Runner 28 → 22, Screamer 50 → 40. |
| 9 | Engineers should be able to deconstruct things they've built | **Done.** X / Deconstruct button; refunds per §6. |
| 10 | Static cars have no wheels | **Fixed.** Wheels (some flat), bumpers, head/tail lights. |
| 11 | Day/night cycle is really fast | **Done.** 12 real minutes per in-game day; daily supply income raised to match. |

**Balance after this round** (scripted bots, 6 seeds): a careful "advance, let the wave come, clear, advance" push wins 6/6 with no losses, so careful play is now on the easy side for a starter zone. Blob-rushing the hive and the lone-sapper sprint both fail 6/6. Watch whether human play feels too safe; the knobs are walker HP, hive spawn rate and the alarm radius in `config/balance.ts`.

### Round 2 [v4.4]

| # | Note | Status |
|---|---|---|
| 12 | Map regions should be the same every time (no procedurally generated layouts) | **Confirmed and written down (§2).** The layout was already fixed; only building *visuals* are code-generated, seeded per building. |
| 13 | Similar games use C# in Unity; will this be easy to move over? | **Answered in §23.** |
| 14 | Engineers stop building if given an order mid-build | **Done.** The site keeps its progress; right-click it to resume; progress bar shows. (A new order still takes priority, as in most RTS games; Shift-queue to add orders after a build.) |
| 15 | Gunshots should be heard further still | **Done.** Rifle ~110 m (was ~73), MG ~160 m; cap 260 m. |
| 16 | Zombies should eventually reach overwhelming numbers: hundreds to thousands in places | **First pass done.** Crowd renderer handles thousands; cap 1,500; Overrun hives grow to 300; bigger late-stage pulses. Next: move the sim to a Web Worker and test on real hardware. |
| 17 | Engineers should repair built structures | **Done** (§6). |
| 18 | Boomers (Bloaters) don't aggro when shot, sometimes | **Fixed.** Zombies now turn on whoever shoots them. |
| 19 | Command structure clickable with power-ups | **Done.** Artillery Barrage and Supply Drop; air call-ins shown locked (§6). |
| 20 | Hives spawn zombies far too often | **Done.** Spawn interval roughly doubled at every stage, smaller groups; big hordes come from pulses instead. |
| 21 | A little money and supplies per kill | **Done** (§11). |

---

## 23. Engine, platform and porting [v4.4]

**Question:** similar games are built in C# with Unity (or similar engines). Will this be easy to move over?

**Honest answer: the game's logic will move over fairly easily; the visuals and UI will be rebuilt, not moved.**

- **Simulation (easy to port).** All the rules (combat, targeting, zombies, hives, noise, economy, orders, districts) live in `src/sim/` and `src/config/`. They're plain TypeScript with no browser or graphics code in them, deterministic, and covered by tests. TypeScript and C# are close cousins; this code translates almost line by line, and the tests translate with it (they become the proof the port behaves the same). Config tables become JSON or ScriptableObjects. Roughly ~3,000 lines today.
- **Assets (port as-is).** Characters are standard FBX; Unity imports them directly. The procedural buildings and props would either be re-implemented as an editor script or exported once to models.
- **Rendering, input and UI (rebuild).** Three.js and the HTML HUD don't exist in Unity. These get rebuilt with Unity's renderer, its input system and its UI toolkit. This is the bulk of a port, and it's also where Unity would *help*: lighting, shadows, particles, animation blending and big crowds (ECS/DOTS, GPU instancing) are its strengths.
- **What keeps it portable:** the strict rule that the sim never touches rendering, all numbers in config, the event bus between sim and presentation, and tests on the sim. Keep following these.

**When to decide.** Stay in the browser while the core is being found (fast iteration, nothing to install, easy to share). The real trigger is the crowd target: if thousands of zombies plus lighting and effects can't hold a steady frame rate on mid-range hardware after moving the sim to a Web Worker, that's the point to port. A middle option, if the only goal is "a desktop app", is wrapping the browser build (Electron/Tauri) with no port at all.

### Round 3 [v4.5]

| # | Note | Status |
|---|---|---|
| 22 | Infantry idle movement should be more realistic | **Waiting on better 3D models** (needs richer idle/look-around/fidget animations than the current pack has). |
| 23 | Engineers should play a building animation while erecting structures | **Waiting on better 3D models.** Currently they use the pack's "pick up" animation as a stand-in. |
| 24 | MG emplacement model is missing its roof | **Done.** Sandbag ring with a rear entrance, corrugated roof on posts, bags on top. |
| 25 | Units in cover should look like they're in cover (leaning against it) | Open. Needs crouch/lean-on-cover poses (also benefits from better models); positioning members along the cover edge can come first. |
| 26 | Zombies should bleed when shot and when dying | **Done.** Droplet sprays thrown away from the shooter on every hit; a dark pool spreads under each body and dries over ~45 s. |
| 27 | Still not getting supplies from kills; after building a few things you can't afford an outpost | **Fixed.** Kills did pay (0.5 supplies per Walker), but too little to notice. The real cause: v4.2 made days 12 min long while supply income only arrived at day's end, so for the first 12 minutes almost no supplies came in. Now supplies trickle in continuously (+9/min base, +5/min per secured district), Walkers/Runners salvage 1 supply each, and the top bar shows income rates. Upkeep is still paid once per day. |
| 28 | Barracks model is only half rendered | **Fixed.** The Quonset hut was rotated half underground; rebuilt with ribs, door and windows. |
| 29 | Concrete main-base walls should have a lot of health | **Done.** 3,000 → 15,000 HP per section. |
| 30 | The text saying what a unit is actively doing should be more obvious | **Done.** A coloured status badge (MOVING, ENGAGING, BUILDING, IN COVER · FIRING, PLANTING CHARGE…) on each unit card and above each squad in the world; blue = moving, orange = fighting, yellow = working. |
| 31 | Not all roads in the test level go to the edge of the map | **Fixed.** Both avenues now run the full height of the map. |

### Round 4 [v4.7] (logged, not started)

| # | Note | Likely cause (from the code) | Proposed fix |
|---|---|---|---|
| 32 | The hive is now a bit slow and zombies don't spawn enough; you can drag most of the motel's zombies to the base just by shooting at the entrance | Two v4.4/v4.5 changes stacked: hive spawn intervals were roughly doubled, and gunfire is now heard ~110 m, so a few shots at the gate pull nearly the whole district into a kill zone. The starting population (~45) is finite and the young hive refills it slowly. | Bring hive output partway back up (especially stage 1–2), let a hive "reinforce" faster when its district population drops, and make the response to distant noise partial: louder/closer sounds pull more, a share of zombies stay put or guard the hive. Re-run the balance probes with a "shoot from the gate" bot. |
| 33 | Soldier and zombie animations are very twitchy at the arms and legs | The flipbook has few poses per clip (walk 10, idle 6, shoot 4), so limbs snap between poses; the zombie mesh simplification runs separately on every pose, so vertices shift slightly between frames and shimmer. | More poses per clip (walk ~20), blend between neighbouring poses in the vertex shader, and simplify once on the rest pose (then reuse that mapping for every frame) so the mesh is identical frame to frame. |
| 34 | Dead zombies stay standing | The pack has no fall-over death animation; the "Defeat" clip used for death ends standing/slumped. | Procedural death: tip the body over onto the ground over ~0.5 s (rotate the corpse instance), then lie flat; optionally blend the last Defeat pose. |
| 35 | Health bars shouldn't float over everything; only show when hovering with the mouse | Squad pips, hive bars and structure bars are always drawn. | Show world-space bars only on hover (and for the current selection). Keep the unit cards as the always-on readout. |
| 36 | Set the Barracks rally point by clicking the Barracks and choosing it from a Barracks menu | Rally point is fixed in the map data; the Barracks isn't selectable. | Make the Barracks selectable (like the Command Post) with a panel: production queue plus "Set rally point" → click the map. Show the rally flag in the world. |
| 37 | Airdrops: a C-130's shadow should fly over before the crate starts falling | Crate currently just appears and parachutes down on the green smoke. | Before the drop, a large aircraft shadow (and engine audio later) sweeps across the map along a line through the smoke; the crate releases as it passes overhead. Reuse the same flyover for the other air call-ins. |
| 38 | The UI takes up a lot of the screen; add a UI scaling option | Fixed pixel sizes; no settings menu. | Settings menu with UI scale (e.g. 75–125%), plus collapsible panels (radio, roster, objectives). |
| 39 | Should be able to select a unit by clicking its name | The name labels over squads in the world ignore the mouse; only the Forces panel chips are clickable. | Make the in-world name labels clickable (select; double-click to centre the camera), and let clicking a unit card in a multi-selection narrow the selection to that unit. |
| 40 | Infestation stuck at 5% with no zombies and no hive | Infestation only drops per kill. If the last zombies die from causes that don't count, or the starting infestation is higher than the zombies can "pay off", the meter can't reach 0 with nothing left to kill. | When a district has no hive, infestation should track what's actually there: decay to 0 when no zombies remain (and generally be derived from the live population plus hive state). Add a test that a cleared, hive-free district reaches 0%. |
| 41 | Road shouldn't be visible under the main base | The ground painter lays the main road and its sidewalks across the whole map width before the base concrete is painted, and only rows 34–37 inside the base get repainted; the sidewalk rows and the strip west of the base still show road. | Stop the road and sidewalks at the base wall (the road should end at the gate), and paint the base footprint last. |
| 42 | Orientation arrows on building placement ghosts | The ghost is a plain box. | Draw an arrow on the ghost showing which way the structure faces (the side squads take cover on, the MG's field of fire), updated live with R. |
| 43 | Noise meter goes up and immediately back down; it should build for a set time before deteriorating. **Clarified:** the rise is fine, it just falls too quickly. It should go up, **hold for a bit**, then fall. | District noise decays at a constant 4/s every tick, so it drains as fast as it fills between volleys. | Keep the current rise. Add a hold: after the last sound the meter stays at its level for ~10–15 s, then decays (more gently than today's 4/s). Sustained fighting then actually builds it up, which matches the doc ("fill it and the whole district comes"). |
| 44 | Move the camera with WASD; move conflicting keybinds to Ctrl+ versions | A (attack-move) and S (stop) are single letters; W and D are free. | WASD pans the camera. Attack-move → Ctrl+A, Stop → Ctrl+S (both can be intercepted in the browser). **Browser caveat:** Ctrl+W closes the tab and can't be overridden by a web page, so nothing should ever be bound to Ctrl+W, and a desktop build would lift that limit. |

### Round 5 [v4.8] (logged, not started; two testers)

| # | Note | Likely cause / current state | Proposed fix |
|---|---|---|---|
| 45 | Separate **Skip step** and **Skip tutorial** buttons | Both buttons today ("Skip tutorial" on the prompt, "Skip" on the banner) end the whole tutorial. | Two buttons on both the prompt and the banner: **Skip step** (marks the current step done, moves on) and **Skip tutorial** (ends it, asks to confirm). |
| 46 | Units can search houses for a small amount of supplies sometimes; takes 5 s | Not in the game. Buildings are scenery only. | New order: right-click a house with a squad → it stands at the door for 5 s (interrupted if attacked) → a random small supply reward, or nothing. Each house can be searched once; searched houses get a marker. Searching is mildly noisy. Ties into the doc's "zombies come out of buildings" (#64): a search can sometimes flush a few out. |
| 47 | Barracks options (recruiting) should only pop up when you click the Barracks | The production panel is always on screen. | Make the Barracks a selectable building (same pattern as the Command Post). Its panel holds recruiting, the queue, and the rally point from #36. |
| 48 | No passive healing; only medics or a med bay heal | There's no regen code. What looks like healing is probably levelling up: a promotion raises max HP and adds the difference to current HP. | Promotions raise max HP only; current HP stays put. Healing comes only from the **Medic Team** (already in the roster, doc §6) and a new **Med Bay** base structure (squads standing in it heal over time, costs supplies). Medics / Med Bay need to come forward in the roadmap, or the starter zones have no way to heal at all. |
| 49 | Barbed wire should slow zombies **and** infantry | Wire only slows zombies (`slow: 0.35` applied in zombie movement only). | Apply the slow to every infantry unit too (including yours). Vehicles crush it later. Players have to plan their own lanes through it. |
| 50 | Infantry health should be one squad health bar, not per soldier | Each member has their own HP and dies individually (doc §5). | **Design change:** one health pool per squad. Members still drop visually at thresholds (a 4-man squad loses a soldier at 75/50/25%) so the squad's firepower still shrinks as it's hurt, and reaching 0 is still a permanent wipe. Doc §5 needs rewriting to match. |
| 51 | Pulses come too often in the easy stages | Pulses fire every 240 s from the 8-minute mark regardless of hive stage. | Scale the pulse interval by hive stage and zone difficulty, e.g. stage 1 ~6 min, stage 2 ~4.5 min, stage 3–4 ~3 min, and push the first pulse later on tutorial maps. |
| 52 | Zombies shouldn't go for structures while there are units nearby | A zombie that runs into a structure on its way locks onto it and keeps scratching; units are only preferred when within its acquisition check. | Units within ~15 m always win over structures; a zombie scratching a wall re-checks every second and leaves it the moment a soldier is in reach. Structures are a fallback target only. |
| 53 | Cap how many mid-tier zombies a region can have at once | Only a global cap (1,500) and per-hive local caps exist; specials are a share of each spawn. | Per-district caps per type, e.g. Runners and Bloaters ≤ 10% of the district's zombies (and a hard number per zone difficulty). Hives roll a Walker instead when the cap is hit. |
| 54 | Buildable guard towers | Not in the game (doc has rooftops/garrisons as a later tier). | New engineer structure: a tall tower a squad can garrison for extra range and line of sight over cars and walls. Zombies can't climb it but can tear the base down. Reuses the `garrisonedIn` hook that's already there for rooftops. |
| 55 | Disband units: they run into the Barracks and disappear | Not in the game. | "Disband" button on a selected squad → it walks to the Barracks and despawns, freeing its command points and upkeep, with a partial refund. Cancelled if the squad is ordered elsewhere. |
| 56 | Allow more than 8 squads; a level 4 hive is overwhelming | Command cap is 8. | Raise the starting cap (e.g. 12) and let it grow with secured districts (doc §11's cap mechanic). Combined with #51/#57/#61, so the starter zones are beatable without needing a huge army. |
| 57 | Hive stage 3+ spawns far too often for beginner levels | Spawn intervals are 18/11/7/4 s for stages 1–4 on every map. | Hive output scales with the zone's difficulty tier. Tutorial zones get a much gentler stage 3–4 (e.g. 12 s / 9 s), and maybe tutorial hives only reach stage 2–3 at most. |
| 58 | Tutorial = two small maps and then one big map, ramping up; finishing one region attaches the next to HQ so you can travel there | The doc currently says **seven** tutorial missions (§17: three 64 × 64 zones plus two larger maps). Only Roadside Motel is built. | **Design change:** three tutorial regions: small → small → big, each harder. Clearing region 1 opens a road from HQ to region 2; clearing region 2 opens the big one. The world stays one continuous city (doc §2), and each new region is added beside the existing map, not loaded as a separate level. §17–18 need rewriting from seven missions to three. |
| 59 | Walkers, Runners and Shriekers (**clarified: Bloaters**) should be easier to kill and fewer on the easy maps | Walker 36 HP, Runner 22 HP, Bloater 120 HP, the same on every map. | Per-zone difficulty scaling: tutorial zones get lower zombie HP (~70%) and lower spawn counts, rising map by map. One table of difficulty tiers instead of per-map tweaks. |
| 60 | Zombies should go for HQ buildings before walls | Walls block the way, so zombies scratch at them; the base wall is excluded from target picking, but whatever's physically in the way gets attacked. | When a pulse targets the base, zombies path around walls to the gate and go for the Command Post and Barracks; they only attack walls they're stuck against for a while (or the gate). This also makes defending the gate matter. |
| 61 | Only engineers can build | The build buttons only act on the engineers in a selection, but they still show when a mixed selection is picked. | Show build buttons and hotkeys only when the selection is engineers only, and send all build orders through engineers. |
| 62 | Remove the radio panel but keep all the dialogue for when audio is added | The radio panel shows every line as text. | Hide the panel. Keep the `Radio` system and every line in place, firing events with nothing displayed, ready for voice audio. Important messages (hive spotted, outpost lost) move to brief toasts. |
| 63 | MG emplacements should cost more | $80 + 25▣. | Raise to about $140 + 45▣, and maybe a higher command cap or a limit per district. Re-check the economy probe afterwards. |
| 64 | Vehicles can be overrun by piled-up zombies; the crew dies, leaving an empty vehicle another squad can crew. Recovered vehicles start at half health and need repair | Vehicles aren't in the MVP (Tier 2). | Add to the vehicle design (doc §6/§21): zombie pile-ups on a vehicle (N zombies touching it for a few seconds) kill the crew, and the empty hull stays on the map. An infantry squad can board it to become the new crew; it starts at 50% HP and engineers can repair it. |
| 65 | Zombies can sometimes come out of buildings | Buildings are solid scenery; zombies only come from hives and the starting population. | Some buildings act as small "nests": a few zombies spill out of a door when units get close or make noise nearby, once or on a timer. Pairs with house searching (#46). |

**Design decisions (v4.9):**

- **#50 — DECIDED:** one shared squad health pool; soldiers drop out at thresholds (75/50/25% for 4 members). This was the original intent; §5 updated.
- **#58 — DECIDED:** three tutorial regions (small, small, big), each attached to the map when the previous one is cleared; §17 rewritten.
- **#48 — DECIDED:** medics and the Med Bay stay where they are in the roadmap. No passive healing, and promotions stop topping up HP.
- **#59 — CLARIFIED:** "Shriekers" meant **Bloaters**. The note is about Walkers, Runners and Bloaters being easier and fewer on the easy maps.

**Grouping for when coding starts:** (a) difficulty pass: #51, #53, #56, #57, #59, #63 plus round 4 #32/#43; (b) zombie targeting: #52, #60; (c) UI: #45, #47, #61, #62 plus round 4 UI items; (d) rules: #48, #49, #50, #55; (e) new content: #46, #54, #58, #64, #65.

### Status after v4.10 (rounds 4 and 5)

**Done:** #32 hive output and gate lure · #33 smoother animation · #34 corpses fall · #35 hover-only health bars · #36 Barracks rally point · #37 cargo-plane flyover · #38 UI scale · #39 clickable names · #40 infestation stuck · #41 road under the base · #42 ghost arrows (structures have no front, so it's a wall-direction arrow plus the MG's range ring) · #43 noise hold · #44 WASD (attack-move/stop → Ctrl+A/Ctrl+S) · #45 skip step / skip tutorial · #46 house searching · #47 Barracks menu · #48 no heal on promotion · #49 wire slows soldiers · #50 shared squad health · #51 pulse timing · #52 units before structures · #53 Runner/Bloater cap · #55 disband · #56 command cap 16 (+4 per secured district) · #57 calmer late hives on easy maps · #59 weaker/fewer zombies on easy maps · #60 HQ before walls · #61 engineers-only building · #62 radio hidden (lines kept for audio) · #63 MG cost · #65 zombies holed up in buildings

**Open, on the roadmap (§21):** #58 tutorial regions 2 and 3 → Tier 1 #10–11 · #54 guard towers → Tier 1 #13 · #64 vehicle overrun → Tier 2 #21 · parked #22, #23, #25 → visual track

**Balance after v4.10** (scripted bots, 6 seeds, tutorial tier): careful advancing wins 5–6/6 with no losses; charging straight in wins 1–2/6 with heavy losses.

### Round 6 [v4.12] (logged, not started)

| # | Note | Likely cause (from the code) | Proposed fix |
|---|---|---|---|
| 66 | Replace the big-headed zombie, the rifleman and the engineer with new models | They're the cartoon Quaternius models; only the main zombie was swapped (v4.10). | Top of the visual track (§21 V3.2). Needs animated replacements: Mixamo is the practical source, since none of the uploaded soldier models have animations. See §21 for the clips each one needs. |
| 67 | Zombie and infantry arms still jump up and down rapidly, about every second | Two causes. **(a) Soldiers:** a rifleman fires every 0.9 s, but the shooting pose is only shown for 0.7 s after each shot, so the arms flip between the aim pose and idle about once a second. **(b) Everyone:** the walk/run speed multiplies a *global* animation clock that keeps counting up for the whole session, so any small change in speed (every frame, from noisy velocity) jumps the animation to a completely different frame. | (a) Stay in the aim/shoot pose while the squad has a target, with the recoil as a small part of the loop, not the whole pose. (b) Give each character its own animation phase that advances by `dt × speed factor`, so changing speed changes the tempo smoothly and never jumps. Also blend between neighbouring poses. |
| 68 | The final, large tutorial map should introduce the power system, which is how the player unlocks the Med Bay | Power stations are Tier 1 #17 and not built; the Med Bay doesn't exist. | **Design decision, recorded in §17 and §21.** Region 3 introduces power: restore its power station and the Med Bay unlocks at the base. |
| 69 | Table Last Stand mode (§21 #28) for now | — | **Done in the doc:** taken off the roadmap and marked tabled; §13 keeps the design for later. |
| 70 | Haven't seen any Bloaters in region 1 recently | The motel's starting mix is only 3% Bloaters (about 1 in a starting crowd of ~39), the stage-1 hive rolls a Bloater 2% of the time, and the tutorial cap on Runners + Bloaters (about 5 at once) is mostly used up by Runners. Bloaters are also now drawn as a scaled-up version of the new zombie model, which may not read as a Bloater at a glance. | Guarantee a few in region 1 (e.g. 2–3 placed in the starting crowd), give Bloaters their own share of the cap so Runners can't crowd them out, and make them unmistakable visually (much fatter, sickly colour, maybe a dedicated model). |
| 71 | The MG still has no arrow showing its front on the placement ghost | The MG nest is square, and the turret currently turns a full 360°, so it has no front; the v4.10 ghost arrow only appears on long walls. | **Design change:** give the MG emplacement a **field of fire** (e.g. a 120° arc) that you aim with R while placing, shown on the ghost as an arrow plus the arc (instead of a full circle). The nest only engages inside its arc, so placement matters and flanks matter. |
| 72 | Noise should start to go down slowly after about 3 seconds; it stays up for a long time | v4.9 set the hold to 12 s (for #43, "it falls too quickly"). | Hold **3 s**, then drain **slowly** (≈1–1.5 per second instead of 2.5). Together that keeps sustained fights filling the meter, but quiet comes back sooner. |
| 73 | Artillery should be a later unlock | The Command Post barrage has been available from the start since v4.4 (playtest convenience). | Lock it until the Artillery tier (§21 Tier 2 #27). During the tutorial the Command Post shows it as locked with its unlock condition; the Supply Drop stays available. |
| 74 | No real difficulty step in region 2, and it didn't introduce anything new | The Easy tier only nudges the numbers (zombie HP 70% → 85%, a busier hive), while the player arrives stronger: more squads, the +4 command cap from securing the motel, motel income and veteran squads. Nothing new is taught there. | **Difficulty:** a bigger step than the numbers alone. Larger starting crowd, the hive starts at stage 2, early Runner packs (doc §2 has Runner packs as the next threat), and pulses that target the player's new motel outpost so holding ground matters. **New feature:** region 2 introduces **guard towers** (#54, §21 Tier 1 #12), with a short tutorial prompt when the region opens. Re-run the bot balance test with the player's realistic post-motel force. |

**Decisions after round 6 [v4.13]:**

| # | Note | Decision |
|---|---|---|
| 75 | Walkers and Runners are **normal** zombies; every other zombie type except the planned bosses is a **medium** zombie. Normal and medium zombies have **separate spawn pools** that both contribute to the total pool | **Decided (§9).** Each district's population cap is split into a normal pool and a medium pool; a hive fills each pool on its own, and the two together are the district's total. Runners no longer compete with Bloaters for room. Bosses stay outside both pools. |
| 71 | MG field of fire with a ghost arrow | **Approved** as proposed: a 120° arc aimed with R while placing. |
| 74 | Region 2 difficulty plan | **Approved** as proposed: bigger starting crowd, hive starts at stage 2, early Runner packs, pulses at the motel outpost, and guard towers as region 2's new feature. |

**Status after v4.14 (round 6):** done: #67 animation twitch (per-character animation clocks; soldiers hold the firing pose while engaged) · #70 Bloaters (at least 3 in region 1's starting crowd, own spawn pool, drawn wider and sickly green) · #71 MG 120° field of fire, aimed with R, arrow + arc on the ghost · #72 noise holds 3 s then drains at 1.25/s · #73 artillery locked until the Artillery tier · #74 region 2 rework + guard towers · #75 normal/medium spawn pools. **Open:** #66 new character models (needs Mixamo-animated replacements, §21 V3.2) · #68 power system in region 3 (§21 Tier 1 #14–16).

### Round 7 [v4.15] (logged, not started)

Both tutorial regions cleared on the first try.

| # | Note | Likely cause (from the code) | Proposed fix |
|---|---|---|---|
| 76 | Gunfire should only be heard about 60 m away | Hearing is 50 m per loudness point: a rifle (2.2) carries ~110 m, an MG (3.2) ~160 m (set in v4.4 when shots weren't drawing enough). | Rifle → ~60 m: about 27 m per loudness point, so carbine ~50 m, MG ~85 m, explosions further. Re-check the bot balance runs, since fights will draw smaller crowds. |
| 77 | Unlocking the second region shouldn't aggro the zombies | When the region opens, its crowd is placed anywhere from 12 m inside the fence, which is exactly where the player's squads wait, so some start within sight and charge. Rifle fire heard ~110 m away (#76) then pulls in the rest. | Seed the new region's crowd away from the opened border (nothing within ~50 m of it, none in sight of a squad), start them idle, and give the region a short grace period before noise counts. The 60 m hearing (#76) helps too. |
| 78 | The arm fix applies to some members of a squad but not all | Same root cause as #79–80 (below): soldiers shuffling around their spot in the squad keep crossing the "walking" speed threshold, so they flip between walk and aim/idle. | Fixed by #79–80; plus hysteresis (start walking above ~0.6 m/s, stop below ~0.3 m/s) so idle shuffling never counts as walking. |
| 79 | The newer zombie model still has arm spasms when walking | **Bug (v4.13):** the game draws ~60 frames a second but the simulation steps 30 times a second. On frames with no sim step, the speed check sees zero movement and switches the character to idle, then back to walking on the next frame, and each switch restarts the animation. So every walker flips walk ↔ idle about 30 times a second. | Keep each character's last measured speed on frames without a sim step and smooth it; never restart the animation clock on a brief switch (only on a real change of action, e.g. walk → attack); hysteresis as in #78. |
| 80 | All arms spasm when walking | Same as #79. | Same as #79. |
| 81 | With a group selected, ordering them into cover only gets one squad into cover | Several squads ordered behind one car are spread 4 m apart along it, but "in cover" requires being within 4.5 m of the car's centre, so only the middle squad qualifies. | Give each squad its own cover: the first gets the clicked car, the others the next-nearest cars/sandbags on the same side (within ~15 m); if there isn't enough cover, the rest line up as close as possible and the toast says so. |
| 82 | No parachute shadow during the supply drop | The crate casts a shadow but the parachute doesn't; at height, the crate's small shadow lands far off to the side. | Let the parachute cast a shadow, and add a soft shadow disc on the ground under the crate that sharpens as it comes down. |
| 83 | Infantry should pathfind around Bloater (boomer) gas clouds | Clouds only damage; squad pathfinding doesn't know they exist. | Clouds make their cells expensive for squad pathfinding while they last (route around if possible), and squads standing in a fresh cloud with no orders step out of it. |
| 84 | Clicking a squad's status (under its name) should select it too | Only the name text is a click target (v4.9 #39). | Make the whole label (name, status and bar) the click target. |

**Status after v4.16 (round 7):** all done. #76 rifle heard ~60 m (carbine ~49, MG ~87) · #77 a newly opened region seeds its dead ≥50 m from the cut fence and ≥40 m from any squad, and ignores gunfire further than 25 m for its first 30 s · #78–80 animation: speed is only measured on frames where the sim stepped, then smoothed, and walking starts/stops at separate thresholds (shuffling in place never counts as walking). *Verified in code and tests; the headless test browser runs too slowly to reproduce the 60 fps flicker, so confirm in the next playtest* · #81 group cover: each squad gets its own spot, **two squads per car, three per sandbag wall**, from cover within 25 m; holding squads can stand closer together so they don't shove each other out of cover · #82 the parachute casts a shadow, plus a soft shadow disc under the falling crate · #83 squads path around Bloater gas (expensive cells, re-plan when clouds appear/clear) and idle squads step out of fresh gas · #84 the whole squad label (name, status, bar) selects it.

### Round 8 [v4.19] (to-dos from the owner, not playtest-driven; logged, not started)

| # | Note | Current state (from the code) | Proposed approach |
|---|---|---|---|
| 85 | The Med Bay shouldn't build itself: it should unlock, then be bought, built and placed | **Already works this way.** Restoring power only *unlocks* it; engineers then buy and place it inside the base (N, $150 · 40▣) and build it like any structure. (A test screenshot showed one placed by the test script.) | Confirm in the playtest; nothing to change unless it behaves otherwise. |
| 86 | Riflemen should see a little further | Squads acquire targets within their weapon range: rifle 24 m, carbine 18 m (engineers). There's no separate sight radius for squads yet. | Rifle 24 → ~30 m (carbine 18 → ~22 m). Later, with fog of war, a sight radius separate from weapon range. |
| 87 | MG emplacements should see a decent bit further | MG nest range 22 m (within its 120° arc). | 22 → ~35 m, keeping the arc. It becomes the long-reach anchor of a defence line. |
| 88 | Zombies should wander between zones and attack outposts, so outposts and regions need fortifying and maintaining, especially once the world opens | Idle zombies only wander ~14 m around their home hive; horde pulses already go for the nearest outpost. Secured districts with no hive stay empty. | Roaming groups that drift between neighbouring districts (more often from districts with hives), sometimes in a secured district's direction; anything that finds an outpost attacks it. Secured districts slowly gain a little infestation from roamers that aren't killed, so a district has to be held, not just taken. Tune so a fortified outpost (sandbags, MG, tower) holds against roamers without the player babysitting it. ✔ v4.29: packs per difficulty tier (none in the tutorial region), 60% at an outpost; contested districts lose income; outposts got an all-round garrison so strays alone can't take one. |
| 89 | Police station: loot to find a decent amount of supplies | Not on the map. Building searches give 4–12 supplies. | A police station landmark building (open world, or one of the remaining starter districts): searching it takes longer (~15 s) and gives a large one-time haul (e.g. 40–60 supplies, some money); it may be guarded by a nest. |
| 90 | Fire station: loot to find a decent amount of supplies | "Fire Station" is in the doc's starter list (§2) but not built. | Same as #89: a landmark building with a big one-time haul. |
| 91 | Searching houses can sometimes find civilians. They're controllable, and you earn money and supplies for getting them back to the main HQ building. Introduced in tutorial region 3 | Civilians are Tier 4 #36 (not built); house search gives supplies, money, nothing, or a nest. | Region 3 onward: a search can turn up a small civilian group (a new unit type: no weapon, slow, a small health pool, the dead love them). Walk them to the Command Post to "evacuate" them for money + supplies. Introduced with a briefing in region 3. Later: civilians can also be recruited as Guerrillas (§10). ✔ v4.28 (Guerrillas still to come). |
| 92 | Once the world opens, the UI needs to show what's left to unlock | No such panel; unlocks happen silently plus a briefing card. | An "Unlocks" panel (e.g. on the ops map or a button in the top bar) listing what's unlocked and what's still locked, and how to get each (power station X, secure district Y, …), driven by the same data that gates them. |

### Round 9 [v4.22] (playtest of region 3 + design notes; logged, not started)

| # | Note | Likely cause / current state (from the code) | Proposed fix |
|---|---|---|---|
| 93 | The M4s are sideways in the hand; otherwise right | When fitting the rifle model to the hand, the barrel and magazine axes are right but it's rolled 90° around the barrel. | Roll it 90° around the barrel axis (one rotation in the rifle setup); check idle, walk and firing. |
| 94 | Walking looks OK | Confirms the round 7 animation fix (#79) at real frame rates. | ✔ Done. |
| 95 | Need a shooting animation, and shooting while moving | Firing uses Mixamo "Firing Rifle", a 0.25 s single shot; squads that move while engaged play the plain walk. | Owner downloads two Mixamo clips on the soldier: a longer **firing loop** (e.g. "Firing Rifle" variants / "Shooting") and a **walk while aiming/shooting** (e.g. "Walking While Shooting" / rifle walk with the gun up). The renderer then plays the moving-and-shooting clip when a squad is both moving and engaged. |
| 96 | Female zombie idle and dying look choppy, and so does the engineer building animation | **Cause:** every clip is sampled with a fixed number of poses whatever its length: female zombie idle 4 s / 12 poses ≈ 3 poses a second, death 3.7 s / 14 ≈ 4, engineer "Working On Device" 6.4 s / 10 ≈ 1.6. | Sample by length instead: ~10–12 poses per second of animation, with a cap for very long clips (and trim long idles to their best loop). Memory cost is modest at crowd LOD. |
| 97 | Getting in and out of a guard tower should take 2 seconds | Climbing in/out is instant. | 2 s to climb up and 2 s to climb down (the squad can't shoot or move during it, status "CLIMBING"). |
| 98 | A region shows 0% infestation while zombies are still alive in it | Once the hive is dead, every kill still subtracts from infestation, so it can reach 0 while zombies that wandered in, came out of buildings or were spawned by pulses are still there. (The v4.9 fix only stops it sitting *above* what's left.) | With no hive, infestation can't go below what's still alive: at least 1% while any zombie remains in the district, so "cleared" (and the outpost) really means empty. |
| 99 | The command cap should be a little lower | 16 to start, +4 per secured district (v4.9). | 14 to start, +3 per secured district; re-check the region bot runs. |
| 100 | FPS fine with a lot of zombies | First real-hardware performance check (T1). | ✔ Done; no Web Worker needed for now. |
| 101 | Only recon units can deploy the drone | Drone and recon are planned (fog of war, §21); not built. | Design decision: the drone is a **Recon Pair ability**, not a Command Post call-in. Recorded for the fog-of-war/recon item. |
| 102 | The drone circles for 30 seconds, clearing fog of war in a circle where it's placed | Not built. | Recon squad uses the ability on a point → the drone flies there and orbits for **30 s**, revealing a circle of fog (radius to tune, ~40–50 m); then it's gone, with a cooldown. |
| 103 | Medic Team: pistols/short-range weapons, plus a healing ability with a cooldown that has to be selected to use | ✔ v4.61 (STATUS #20). Was: the Medic Team existed only as roster data (§6). | Pistols (~15 m, weak). **Heal** is an active ability: select the medics, press the ability (or its button), click a squad in range → it heals a chunk of that squad's health (and can bring a fallen soldier back), then a cooldown. No passive healing, consistent with #48. |
| 104 | The engineer building menu should pop up in the bottom middle showing what they can build | Build buttons sit in the left-hand selection panel with the squad cards. | When engineers are selected, a build bar appears bottom-centre: one button per structure with its icon, hotkey and cost, greyed out when unaffordable or locked (with the reason). |

**Status after v4.23 (round 9):** done: #93 rifle rolled 90° (magazine down) · #96 clips sampled by length (10 poses per second of animation, max 48), with soldier poses kept indexed and colours shared across poses (all crowds ~99 MB, down from 241 MB on the first attempt) · #97 2 s to climb up/down a tower (no moving or shooting; CLIMBING status) · #98 with no hive, infestation can't reach 0% or count as cleared while any zombie is alive in the district · #99 command cap 14, +3 per secured district · #104 engineer build bar bottom-centre: icon, hotkey, cost; locked items show how to unlock them; the squad panel narrows while it's open. **Open:** #95 shooting animations (needs two Mixamo clips), #101–103 drone/recon and Medic Team (with fog of war and the Medic Team items).

### Round 10 [v4.25] (playtest + ideas; logged, not started)

| # | Note | Current state (from the code) | Proposed fix | Needs from owner |
|---|---|---|---|---|
| 105 | Pause menu with a Resume button and a keybinds page, so the controls screen at the start can go | Space pauses with no menu; the start screen lists all the controls. | Esc (when nothing else to cancel) or a top-bar button opens a pause menu: **Resume**, **Controls** (all keybinds, grouped), **Settings** (sound, UI scale), **Restart**. The start screen keeps only the briefing and the Deploy buttons. | — |
| 106 | Units need to stop floating around until there's an idle animation | Resting soldiers drift up to ~1.3 m around their spot by design (v4.2 "less stiff"), but with a still idle pose it reads as gliding. | Resting soldiers stand still (no drift) until a real idle-shuffle animation arrives; moving formations keep their looseness. | An idle animation with small weight shifts (later) |
| 107 | A soldier more than half the cover distance away from the cover plays a crouch instead of the cover pose | Every soldier of a squad in cover plays "Taking Cover Idle", which leans on the cover even when the soldier is metres away from it. | Per soldier: within half the cover distance (≈2.25 m of a car, half the reach for walls) → cover pose; further out → crouch. | **A rifle crouch idle** (Mixamo "Rifle Crouch Idle" / "Crouch Idle") ✔ v4.27: Mixamo "Idle Crouching Aiming"; leans on the cover within ~1.1 m of a car / 1.5 m of sandbags, crouches further out. |
| 108 | Bloater (boomer) death: wet explosion sound | No sound yet. | Play it on Bloater deaths (with the gas cloud). | A wet burst / splat sound ✔ v4.27: plastic pop layered over a gore rip (your suggestion). |
| 109 | Demo charge: explosion sound | No sound yet. | On every explosion (charges, and artillery later), louder for bigger blasts. | An explosion sound ✔ v4.27: satchel charge clip on every non-toxic explosion, louder for bigger blasts. |
| 110 | Hive: wet death noise | No sound yet. | When a hive is destroyed. | A wet, organic collapse sound ✔ v4.39: wet mud explosion |
| 111 | Building sound | No sound yet. | Looping hammering/sandbag sounds while engineers build or repair. | A building/hammering loop ✔ v4.38: three construction recordings layered into one loop |
| 112 | Power station turning on: sound | No sound yet. | When power is restored (a big electrical hum spin-up). | A power-on / generator start sound ✔ v4.41: owner's recording |
| 113 | Cargo drop: plane fly-by, parachute and crate landing sounds | Flyover is visual only. | Fly-by as the shadow passes, a parachute flutter as the crate falls, a thud on landing. | Plane fly-by, parachute, crate thud ✔ v4.39: jet fly-by + parachute; v4.41: crate thud |
| 114 | Engineers need a different gun model and sound | Engineers carry the M4 and fire the rifle sound. | A carbine/SMG model with its own fit file (the rifle fitter can handle any weapon) and a lighter gunshot. | An SMG/carbine model + its sound ✔ v4.27: the engineer model's own SCAR + your carbine sound. |
| 115 | New barbed wire model | Barbed wire is a simple procedural mesh. | Swap in the model. | A barbed wire / razor wire model ✔ v4.39: CliffUnderside (Sketchfab, CC BY 4.0), simplified |
| 116 | Roads and railroads in region 3 don't reach the edge of the map | Region 3's main road and rail start at x = 114 m (the region's west edge), not the map edge. | Run both to the west map edge (through the fence line, which gets barriers across them like the other crossings). | — |
| 117 | In region 3 the railroad should go on top of the roads | At the level crossings the rail is skipped where it meets a road. | Draw the rails across the road at crossings (the road stays drivable). | — |
| 118 | Elite squads get +1 soldier | Elite only adds health and damage (same as Veteran). | On reaching Elite, the squad gains a fifth soldier (and the pool grows by one soldier's share). | — |

**Status after v4.26 (round 10):** done: #105 pause menu (Esc backs out one step at a time: menu → mode → selection → opens the menu; Resume restores the previous paused state; Controls lists every keybind; Settings: sound, UI size; Restart asks first; start screen keeps the briefing and field notes only) · #106 resting soldiers stand still · #116 region 3 road and rail to the map edge · #117 rails drawn over roads at crossings · #118 Elite squads gain a fifth soldier (with one soldier's share of health). **Waiting on assets:** #107–115 (see the table above).


### Round 11 [v4.33] (playtest; bugs and tweaks done in v4.34)

| # | Note | Current state (from the code) | Proposed fix | Needs from owner |
|---|---|---|---|---|
| 119 | Crouching and leaning in cover works | Round 10 #107 (v4.27): soldiers lean on the cover when close, crouch further out. | ✔ Confirmed, nothing to do. | — |
| 120 | Allow an outpost at 1–2% infestation; the player sometimes gets stuck at 1%. Zombies still hidden in houses shouldn't count. | Outposts need exactly 0% (`commands.ts`). Once the hives are dead, infestation drains to what's still **walking** in the district, but it is held at 1% while even one zombie is alive inside the district's rectangle. Zombies still hidden in houses already don't count, so the stuck 1% is almost certainly one or two stragglers you can't find: stuck on scenery, in a corner, or arriving with a roaming pack. (A guess: I haven't caught it happening.) | Allow an outpost at **≤ 2%** once every hive in the district is dead (the radio line and objective say "≤ 2%"). Any dead left inside then make the district CONTESTED, which already handles stragglers. Also show "**N dead left**" in the district panel so a straggler can be hunted down. | Yes to both ✔ v4.34 |
| 121 | Visual sign that searching a house found something | A spray-painted X at the door (orange = searched, red = zombies) and a radio line. Nothing shows what was found. | A floating pop-up over the house: "+8 ▣ +$12", "3 survivors" or "Empty", which rises and fades over ~2 s. The X stays. | — |
| 122 | Region 2 has a good difficulty level (said twice) | Tier "Easy" (v4.13 #74). | ✔ Keep it as the reference point for the jump into region 3. | — |
| 123 | The cargo plane's shadow sometimes stays stuck at the edge of the map after a supply drop | **Bug found:** the shadow is moved only while its crate exists (`SupplyDrops.ts`). Collect the crate before the plane is 400 m past the drop and the shadow stops updating, but it isn't removed either (that only happens once it's "done"), so it freezes wherever it was. | Move the shadow on its own clock (from the drop time), independent of the crate, and remove it once it's off the map. | ✔ v4.34 |
| 124 | Searching one building sometimes counts as searching two when they're close together | The simulation only marks the one building that was ordered. But the X is painted where the **squad stood**, not on the building, so between two close buildings it can land by the other one. A second possibility: one visible building made of two building blocks. (A guess: I haven't reproduced it yet.) | Paint the X on the searched building's own wall, facing the squad. Check in the browser for buildings that overlap or are split in two. | If it still happens after v4.34, where (region, which houses)? ✔ v4.34 (X on the house's wall) |
| 125 | An option to crouch in "open cover" when not in cover, for half the cover bonus | A squad that isn't next to a car, pump or sandbags gets no cover and stands. The crouch pose exists (Idle Crouching Aiming, #107). | A **Crouch** order (hotkey, e.g. **G**, plus a button): the squad crouches where it stands, takes **half the damage reduction of cover** (≈ 22% vs 45%) and stands up when it moves. (I'd also suggest it makes them a bit slower to react; say if you don't want that.) | G, and yes, slower ✔ answered ✔ v4.37 |
| 126 | If more squads are sent into cover than it has room for, the extras crouch in open cover near where they were sent | Cover has no slots: it's anyone within 4.5 m of the cover. Extra squads get pushed apart (4 m spacing) and end up standing out in the open with no bonus. | Give each cover object a number of places (car 2, sandbags 3, as now in the design). Squads beyond that crouch in open cover (#125) next to it, and are listed as such. | ✔ v4.37 |
| 127 | Guns need a muzzle flash | Only a tracer line per shot. | A short flash (a bright billboard plus a small light, ~60 ms) at the gun's muzzle for every shot, bigger for the MG and the sniper. Cheap enough to do for every soldier. | ✔ v4.37 |
| 128 | Shooting while moving should do less damage (less accurate) | Already in: moving squads shoot at **60% accuracy** (`combat.ts`), so they hit less often, but each hit does full damage. It may not be noticeable. | Keep it as accuracy (that is what "less accurate" means in the simulation) but make it bite harder: **45%** while moving. Or a damage cut on top. | Accuracy only, 50% ✔ v4.34 |
| 129 | Outposts don't need a garrison; it could be an outpost upgrade | Since STATUS #11 (v4.29) every outpost has a built-in all-round garrison gun (26 m). | Outposts start unarmed. A **Garrison** upgrade (select the outpost: about $80 + 25 ▣) adds the gun. That makes a bare outpost weaker against roaming packs: in the v4.29 probe one already fell 4/4 even *with* the garrison, so the MG + sandbags remain the real defence. | Yes ✔ v4.34 |
| 130 | The closest target should always be #1 priority | Targeting (`targeting.ts`): a squad **locks** onto a target until it dies, and otherwise picks by threat class first (Bloaters and hives before Walkers), nearest only within a class. Only things within 6.4 m override the lock. | Always shoot the nearest target you can engage. Only a target you click yourself (forced attack) overrides that. The lock goes, so a Bloater at 25 m no longer beats a Runner at 8 m. | Yes ✔ v4.34 |
| 131 | Runners ("sprinters") should take one less shot to kill than Walkers | By the numbers this is already true at every tier and rank. Rifle 9 damage; Walker 36 hp vs Runner 22 hp → 4 vs 3 hits at Standard, 4 vs 3 in region 2, 3 vs 2 in region 1. Misses (62% accuracy) make it feel random. | Probably nothing to change; check it in the next playtest. If you mean one shot fewer **than now**, Runner hp 22 → 17 (2 hits in region 3). | One shot fewer than now ✔ v4.34 (17 hp) |
| 132 | Remove the drifter notifications | The radio says "Movement: a pack of N drifting out of X toward Y" when a pack heads for a secured district or outpost. | Remove that line. The "CONTESTED" alert when they arrive stays. | ✔ v4.34 |
| 133 | One of the two hives in region 3 should be stage 2 | Rail Siding's two hives both start at stage 1. | `hiveStage: [2, 1]` (the code already supports one stage per hive). | East ✔ v4.34 |
| 134 | Engineers should do slightly more damage than riflemen | Carbine: 7 damage, 1.0 s, 70% accuracy ≈ 4.9 damage/s per soldier; rifle: 9, 0.9 s, 62% ≈ 6.2. Engineers do about a fifth less per soldier (and have 2 soldiers to the rifle squad's 4). | Carbine damage 7 → **10** (≈ 7.0/s per soldier, ~13% above a rifleman). A Walker then takes 4 hits instead of 6. | Yes ✔ v4.34 |
| 135 | Hovering over a hive shows a progress bar or timer to its next stage | A hive's hover label shows its health. Its stage and next horde pulse are in the district panel, but not the time to the next stage. | Add a "Stage 2 → 3 in 4:12" line with a thin progress bar to the hive's hover label. | ✔ v4.37 |
| 136 | No cap on supplies | Supplies cap at 150 (`supplyCap`). | Remove the cap (the HUD drops the "/150"). Supplies can then be hoarded; if that makes things too easy, upkeep or costs can go up later. | ✔ v4.34 |

**Ranked in STATUS.md as:** bugs first (#123, #124, #120), then the quick tweaks (#132, #136, #133, #134, #130, #128, #129, #131), then feedback visuals (#127, #121, #135), then open cover (#125, #126).

**Status after v4.37 (round 11):** all done; v4.37 added #125–127 and #135 (barbed wire moved to Z to free G). **Earlier, after v4.34:** done: #120 outposts at ≤ 2% with the hives dead, "N dead left" · #123 plane shadow · #124 search X on the house (likely cause; check) · #128 moving fire 50% · #129 Garrison upgrade · #130 closest target first · #131 Runners 17 hp · #132 no pack radio line · #133 east hive stage 2 · #134 carbine 10 · #136 no supply cap. **Next:** #127 muzzle flash, #121 search pop-up, #135 hive stage timer, then #125/#126 open cover.


### Round 12 [v4.35] (playtest of v4.34; built in v4.36)

The first try at this round was on the old branch (`claude/magical-brown-7bsmza`, v4.32), which is why outposts still needed 0%, there was no dead-left counter, no Garrison, and region 3's hives were both stage 1. These notes are from v4.34 on `claude/awesome-einstein-oapvzq`.

| # | Note | Current state (from the code) | Proposed fix | Needs from owner |
|---|---|---|---|---|
| 137 | Soldiers still "float around": play the idle animation or walk a little, no floating | Resting soldiers don't drift any more (#106), but they still **slide** into their formation spots at up to ~1.2 m/s while showing the idle pose, by design (`CrowdLayer`: under 1.6 m/s counts as "not walking"). It happens when a squad stops (soldiers settling), when it turns to face a target (the whole formation rotates around the squad's centre), and when two squads push each other apart. | A resting soldier more than ~0.3 m from their spot **walks** there (walk animation at a real walking pace); closer than that, they stop dead. A resting squad turning to shoot **doesn't rotate its formation**: soldiers turn on the spot. | ✔ v4.36 |
| 138 | Upgrading an outpost should need a sapper (engineers) and take a few seconds | The Garrison is bought instantly from the outpost's panel (v4.34). | Engineers do it: select engineers and right-click the outpost (or press its button in their build menu), they walk over and work for **~6 s**, paid up front. The outpost's panel shows the cost and "Send engineers to install". Getting hit pauses the work, like building. | ✔ v4.36 |
| 139 | Zombies get stuck on buildings: they try to walk through them, not around them | Zombies that are **idle or wandering** (not chasing anything) walk in a straight line to their spot and are left out of both the "go around" routing and the "am I stuck?" check (`zombies.ts`), so they can push into a wall indefinitely. Chasing zombies already go around. | Wanderers use the same routing as chasers when the way is blocked, and get the stuck check too. (Wanderers don't pick spots inside buildings.) | ✔ v4.36 |
| 140 | Engineers **shouldn't** be able to shoot while building or planting a charge | Builders only shoot back at zombies within ~8 m (danger close); otherwise they keep working. | No shooting at all while building, repairing, deconstructing, installing or planting a charge (planting restarts when hit; building doesn't). Protecting them is the rifle squads' job. | Shouldn't ✔ v4.36 |
| 141 | Houses next to the one you search still get searched | **Cause found.** One "houses" block in the map is drawn as 1–3 separate houses (one per ~13 m of street frontage), but the game treats the whole block as **one building**: searching any house searches the block (and one X is painted). | Split every houses block into one building per house in the simulation, so each house is its own search (its own loot, nest or survivors, its own X). It changes the number of searchable buildings (53 → 68); loot per search is left as it was (owner decides balance). | ✔ v4.36 |
| 142 | Still no pop-up for a search; searches don't seem to find anything now | **Cause found.** Searches do find things (70% find supplies, sometimes money), but the result is a radio line from the **squad**, and only lines from Command/Overwatch/etc. become on-screen alerts. So you never see it. (The old branch's 150 supply cap could also have eaten the supplies.) The pop-up (#121) isn't built yet. | Build #121: a pop-up over the house ("+8 ▣ +$12", "3 survivors", "Empty", red "Contact!") that rises and fades over ~2 s, plus an alert line for anything found. | ✔ v4.36 |
| 143 | There was no command cap for region 2 but there is one for region 3; it should be the opposite | The cap is 14 at the start, +3 for each secured district: 17 while you fight region 2, 20 in region 3. It's the same rule everywhere, so I can't tell what you saw. My guess: in region 2 you didn't have the money to reach 17, and in region 3 you did. | Depends on what you meant: a **lower** cap in region 3? A cap that rises less, or later? | No command cap from region 3 (Rail Siding) on ✔ v4.36 |
| 144 | Dead left over in a zone should eventually make their way to outposts or other built structures | Leftover dead stand or shuffle where they are. Roaming packs (every few minutes, from region 2 on) only leave districts **with** a crowd, and region 1 never roams. | Any zombie idle for **~2 minutes** heads for the nearest player structure in its own district (outpost, sandbags, MG, tower), or the nearest neighbouring outpost if there's none. That flushes out stragglers and keeps outposts busy. Applies in every region, region 1 included. | Yes ✔ v4.36 |
| 145 | The MG emplacement should do more damage | 8 damage a round, 5 rounds/s, 60% accuracy (~24 dmg/s); a Walker takes 5 hits. | **8 → 12** a round (~36 dmg/s, 3 hits for a Walker). Your playtest decides from there. | ✔ v4.36 |
| 146 | The "TREATED" status should say "TREATING" | The status label above a squad healing at the Med Bay reads TREATED. | Change it to **TREATING**. | ✔ v4.36 |
| 147 | Engineers sometimes get stuck in the things they build | A build site blocks the ground **as soon as it's placed**, and placement only checks for zombies in the way, not your own squads. Sandbags placed where engineers (or any squad) stand trap them inside. Soldiers also drift around their spot without collision checks, so they can end up inside walls. | Placing a structure pushes any squad standing on it to the nearest free spot; engineers work from the edge of the site. Soldiers' positions are checked against walls like the squad's. | ✔ v4.36 |
| 148 | Deconstructing sometimes picks the thing next to the one you click | `deconstructAt` takes the **first** structure in the list whose circle (radius + 1 m) contains the click. Sandbags and wire are 9 m long, so their circles overlap neighbours'. The older one wins. | Pick the structure whose footprint contains the click; if none, the **nearest** one within a metre. Same rule for repair and clicking structures. | ✔ v4.36 |
| 149 | Noise pulses need a cooldown. Fighting a stage 3 or 4 hive's noise pulse makes enough noise to trigger the next one, so pulses never end | Confirmed: a full noise meter sets off a pulse and empties the meter, but the gunfire against that pulse refills it, with **no cooldown**. Each noise pulse is also 4 bigger than a timed one. | After a noise pulse, that district's meter is **locked for 45 s** (owner's call; 90 s proposed) (it shows as cooling down) and starts filling again only after that. The hive's normal timed pulses carry on as usual. | 45 s ✔ v4.36 |
| 150 | Clicking a district's name in the Districts panel should move the camera there | The names aren't clickable. | Click a district name → the camera pans to the district's centre (or its outpost, if it has one). | ✔ v4.36 |

**Status after v4.36 (round 12):** all done (#137–150). #143 answered: no command cap from Rail Siding on. Side effect of #140 to watch: a lone zombie on engineers stops a demo charge until someone shoots it.


### Round 13 [v4.42] (playtest of v4.41; built in v4.43 except assets)

| # | Note | Current state (from the code) | Proposed fix | Needs from owner |
|---|---|---|---|---|
| 151 | The ambient city noise needs to be a bit quieter | Suburban ambience bed at 0.3 of master volume (v4.38). | 0.3 → **0.2**. | ✔ v4.43 |
| 152 | The sci-fi ambient audio is nonexistent | The horror drone plays at 0.05 (v4.38, "very quiet"), so it's lost under the suburban bed. | 0.05 → **0.12**, so it's audible under the quieter city bed (#151). | ✔ v4.43 |
| 153 | Zombie attacks: once every 2 s for Walkers, once a second for Runners | Walkers every 1.2 s (7 damage), Runners every 0.8 s (5 damage). | Walkers **2.0 s**, Runners **1.0 s**. That's less damage per second: a Walker ~5.8 → 3.5/s, a Runner ~6.3 → 5/s. | Keep damage per hit ✔ v4.43 |
| 154 | Sometimes one soldier of a squad gets stuck on a building | **Cause found, and it's mine:** since v4.36 (#147) a soldier won't step into a wall, but soldiers don't path-find, they head straight for their spot in the formation. When a building is in the way, that soldier stops at the wall and stays there while the squad moves on. | Soldiers slide along walls instead of stopping. Any soldier blocked (or more than ~6 m behind) for over a second follows the squad's own route, or steps to a free spot beside the squad. | ✔ v4.43 |
| 155 | The power station's start-up sound didn't play | It plays in the current build: I ran the real restore in the browser (engineers finish restoring → the power-on sound fires). Two likely reasons it didn't for you: the sound arrived in v4.41 (the last push), or the camera was more than ~140 m from the station (sounds fade out with distance; at the time I'd also briefly made it play everywhere, then placed it at the station as you asked). | Retest on the latest pull with the camera near the station. If it's still silent, I'll dig further. | Retest please |
| 156 | Power coming on should attract zombies | Restoring power makes no noise. | When the power comes on, a big noise at the station (as loud as a demo charge: heard ~260 m away), so the dead in range come to investigate. | ✔ v4.43 |
| 157 | Extra district tasks, like saving civilians, for future regions? | The only side task is survivors from house searches (Rail Siding on). | Ideas to pick from: **survivors holed up** in a marked building (clear it, escort them out); **supply cache** in a locked building (engineers breach it, big one-off haul); **radio mast / relay** to restore (reveals the next district, ties in with fog of war later); **downed helicopter crew** to reach before a horde does; **convoy escort** (needs vehicles); **nest building** to burn out (needs flame team). | All six; on the roadmap (STATUS) |
| 158 | Unit labels aren't visible until you hover over them | Squad **names and status** (IN COVER, MOVING…) are always shown, at 10 px. The **health bar and soldier pips** only show on hover or when selected (by design since v4.x, "hover-only health bars"). | Owner: the whole label (name, status, health) only shows while the mouse is over the squad. | The whole label, only while hovering ✔ v4.43 |
| 159 | Ambient car models | Parked cars are procedural boxes. The model library can swap them for a real model (`car` key in `public/models/manifest.json`). | Drop in 2–4 low-poly car models (I'd simplify them as I did the barbed wire). CC0 options: Kenney's Car Kit, Quaternius' cars. | The car models (CC0 or CC-BY) |
| 160 | The MG nest model doesn't match its orientation: the opening in the sandbags should be opposite the forward arrow | **Cause found:** the sandbag ring is built with its opening on the west side and never turned to match the aim you set with R. Only the gun turns. | Turn the whole nest to its aim, so the opening is always at the back, opposite the arrow. | ✔ v4.43 |
| 161 | Crouched movement, crouch firing, and crouch firing while moving animations | Crouched soldiers use "Idle Crouching Aiming" standing still (it doubles as firing) and the normal walk, slowed, on the move. | Wire them in when they arrive: crouch walk, crouch fire, crouch walk + fire. | Mixamo clips (rifle, FBX, Without Skin): search Mixamo for "crouch": a crouch walk forward, a crouched rifle firing, and if there is one, a crouch walk while firing. (Names from memory; I haven't checked Mixamo's current list.) |

**Status after v4.43 (round 13):** done: #151–154, #156, #158, #160. #155 retest. #157 on the roadmap. Waiting on assets: #159 car models, #161 crouch animations.


### Round 14 [v4.50] (playtest of v4.49, the moderate horde; logged, not started)

| # | Note | Current state (from the code) | Proposed fix | Needs from owner |
|---|---|---|---|---|
| 162 | Make Runners faster | Runners run 7.6 m/s (Walkers 2.7; soldiers 6.4). | **7.6 → 9.5 m/s** (half again as fast as a soldier). | ✔ v4.51 |
| 163 | Hives should spawn in a random place in each region | Each region's hive sites are fixed spots in the map data (`hiveSites`). | A new game picks each hive's spot at random inside its region: open ground, away from the fence and the region's entrance, and apart from the other hive. Seeded per game, so a saved game keeps its hives where they were. The map editor's hive sites become "allowed areas" if you want to steer it (optional). | ✔ v4.53 |
| 164 | A sound when units finish training | Nothing plays when a squad leaves the Barracks (the game does know: `unitProduced`). | Play a short radio burst with the "ready" message. Or a dedicated "unit ready" sound if you send one. | Owner will send a sound |
| 165 | Remove pulse timers | Two things could be meant: the **"next pulse 9:59"** countdown in the Districts panel, or the **timed horde pulses** themselves (each hive sends a wave every few minutes; noise sets one off early). | Either remove the countdown from the panel, or remove timed pulses so waves only come from noise (the panel line goes too). | The countdown text ✔ v4.51 |
| 166 | Zombies should roam farther from their hives | Idle zombies wander within 14 m of their hive. | Up to **40 m** from the hive. | ✔ v4.51 |
| 167 | Zombies still pile up on walls instead of finding a new way round | **Likely cause:** within 8 m of their target, zombies walk straight at it even with a wall in between (the go-around routing only kicks in further out), and the "I'm stuck" check only fires when one has barely moved for 0.8 s. In a crowd they keep getting jostled, so they never count as stuck and keep pressing on the wall. | Route around whenever a wall is between a zombie and its target, at any distance; count a zombie as stuck when it makes no progress *towards* its target (not just when it stands still). | ✔ v4.51 |
| 168 | "Hive pulse" sounds weird: needs a new name | The waves are called "horde pulses" in the HUD, radio and briefings. | A new name everywhere, e.g. **Surge** ("a surge from the hive"), **Swarm**, **Outpouring** or **Horde wave**. | Horde wave ✔ v4.51 |
| 169 | Hives need a texture | A hive is a plain procedural blob with a glowing core. | Map a texture (or swap in a model) when you send one. | A hive texture (tileable organic/flesh, ≤512 px) or a hive model |
| 170 | Zombie health needs to go down | `HORDE.toughness` 0.6 (v4.49). A Rail Siding Walker takes 3 rifle hits, a Runner 2. | **0.6 → 0.45**: Walkers 2 hits in every region, Runners 1. | ✔ v4.51 |
| 171 | Demo charge plant time a little shorter | 3 s to plant (getting hit restarts it). | **3 → 2 s**. | ✔ v4.51 |
| 172 | Hives shouldn't spawn zombies as often (a 10 s timer?) | Spawn intervals run 4–18 s by tier and hive stage (a stage-4 Standard hive every 4 s), and since v4.49 each spawn is twice as many. | **Never faster than every 5 s** (owner's number), at any stage (slower ones stay as they are). | 5 s ✔ v4.51 |
| 173 | The Barracks queue should say "Rifle Squad ×5", not list it five times | Each queued squad is its own line. | Group runs of the same unit: "Rifle Squad ×5", with the first one's progress bar. | ✔ v4.51 |
| 174 | The current waypoint feature should be a patrol feature | **Today:** Shift+right-click queues points; the squad goes to each in turn and stops at the last. There's no patrol yet (the order type exists, unused). | **Patrol:** a Patrol button / hotkey, then click points: the squad walks them in a loop until given another order, fighting what it meets. | P ✔ v4.52 |
| 175 | New waypoint feature: go to each waypoint and stop at the last | That's what Shift+right-click does today (#174). | Keep it as the waypoint feature (or tell me what's different from what you want). | Is the current Shift+click what you mean here? ✔ v4.52 (kept) |
| 176 | Show waypoints and patrol points | Queued points aren't drawn (only a brief click marker). | For the selected squads: numbered markers joined by a line for waypoints; a closed loop in another colour for patrols. | ✔ v4.52 |
| 177 | A formation maker for multiple groups | Several squads moved together form a line, fighters in front and engineers behind, 6 m apart. | A formation picker for multi-squad moves: **line, column, wedge, box, spread**; right-drag to set the facing. Remembered per selection or group. | Preset shapes, dragged with right-click ✔ v4.54 |
| 178 | Sometimes overlapping units' labels don't pop up | Hovering picks only the **one** squad nearest the cursor, so others under it never show their label. | Show the label of every squad under the cursor, stacked so they don't overlap. | ✔ v4.51 |
| 179 | UI clean-up: no "cooling down" on the noise meter | Since v4.36 the Districts panel shows "cooling down 45s" after a noise pulse. | Remove that text. | Just this for now ✔ v4.51 |
| 180 | New models and animations are coming | — | Wire them in when they land, then re-bake the cast (`bake-cast.cjs`). | The uploads |

**Status after v4.54 (round 14):** done: #162, #163, #165–168, #170–179. Waiting on the owner: #164 (a squad-ready sound), #169 (a hive texture or model), #180 (the new models and animations, partly uploaded).

### Round 15 [v4.67] (playtest of v4.66; logged, not started)

| # | Note | Current state (from the code) | Proposed fix | Needs from owner |
|---|---|---|---|---|
| 181 | A tool to tune difficulty without Claude: hive starting level, ambient zombies per region, spawn pools and their sizes, etc. | Every number is in code: `src/config/balance.ts` (horde toughness/damage, hive broods and pools, spawn intervals, roaming packs per difficulty tier) and the region data (`hiveStage`). Changing one needs a code edit. | **`dev-balance.html`**, like the weapon fitter: every knob grouped (per region: hive start stage, ambient zombies, the hive's two pools and their sizes, spawn interval, roaming packs; global: zombie health/damage, horde waves), with the current value and the default. Changes apply to the next game in that browser at once (test right away), and **Download balance.json** makes them everyone's defaults once uploaded to `public/`. "Reset to defaults" per knob and for all. | ✔ v4.68 (owner: no others in mind; more knobs can be added to the list any time) |
| 182 | List the map editing tool in the GitHub readme next to the weapon fitter | README.md lists only the "Rifle fitter" (and still calls its file `m4.json`). | Add the **map editor** (`dev-map.html`: what it edits, how to save), update the fitter (any unit/gun, one `.json` per gun) and add the balance tool (#181) once it exists. | ✔ v4.68 (also in STATUS.md, with links) |
| 183 | Use the zombie pile-ups to make the climbing feature | Zombies stopped by a structure: chasing a squad they go round for 2.5 s, then claw through; at the base wall they take the flow field to the gate (#167). The pile-up/climb is a "Tier 2 hook" comment in `zombies.ts`, not built. | When enough zombies (e.g. 8+) press against the same stretch of wall/sandbags/tower for a few seconds, the front ones **pile up** (bodies stacking, drawn rising), and once the pile reaches the top the rest **walk up and over** it (or onto a tower's platform to attack the garrison). The pile collapses a few seconds after the press ends. | Which structures can be climbed (base wall? sandbags, wire, towers, outposts?). If the base wall can be climbed, the #167 "go round to the gate" behaviour gives way to piles when a big crowd presses. Threshold (crowd size, seconds)? **Owner: pretty much anything can be climbed.** |
| 184 | Region 3 needs spice: bored by then. More incentive to build? Maybe the Humvee | Region 3 plays like region 2 with more zombies. The **Gun Jeep** (the Humvee role: MG, fast) exists only as roster data, behind the `vehicles` feature (off), made at an Armor Station that doesn't exist yet. Nothing in region 3 forces fortifying. | **Humvee** (the Gun Jeep, renamed, Humvee model wanted) from a **Vehicle Bay** (#185). Build incentives, pick any: (a) region 3 hordes **go for structures** and outposts, so defences matter; (b) a **"hold the line" event**: a survivor convoy/evac arrives at a district and has to be defended for a few minutes; (c) **outposts earn per minute held** (income for expanding); (d) **night**: bigger waves at night, so a fortified line pays off. | Which of (a)–(d); a Humvee model (Sketchfab/Mixamo-free GLB). (Owner wasn't sure what was meant; explained again after v4.68.) |
| 185 | Lootable **hospital** in region 2 unlocks the Med Bay; the Med Bay is in the base from the start but **run down** until the hospital is looted. Restoring region 3's power unlocks the **Vehicle Bay**. Looting the hospital shows a **tutorial pop-up** about significant buildings (hospitals, police stations, fire stations) | The Med Bay unlocks when region 3's power is restored, and engineers build it anywhere in the base. There's no hospital in the map. Police/fire stations as loot landmarks are STATUS #18 (open). No Vehicle Bay. | A **hospital landmark** in region 2 (placed in the map editor, movable): searching it takes longer and finds supplies plus medical equipment → the base's **run-down Med Bay** (pre-placed, dark/broken, does nothing) becomes a working one (and medics unlock, as now). Region 3's power → **Vehicle Bay** (same pattern: run down in the base until then). First landmark looted → a tutorial pop-up: "Significant buildings (hospitals, police and fire stations) hold big hauls and unlock things." Police/fire stations (#18) use the same landmark system. | **Owner:** the Med Bay is **fixed** (engineers repair it once the hospital is looted); the Vehicle Bay is **built** by engineers, unlocked by region 3's power the way the Med Bay unlocks today. ✔ v4.72 (the Med Bay runs without power now, so the hospital helps right away) |
| 186 | Waypoint and patrol paths should only be visible for selected units | The route lines and numbered waypoints already draw **only for selected squads** (`RouteLayer`, since round 14). What everyone sees briefly is the click marker (a ring where you clicked, fading in about a second). | Need to know what you saw: if it's the click rings, hide those for patrol points after placing; if routes stay up after deselecting, that's a bug to chase. | **Owner: ignore** (dropped) |
| 187 | Remove hive stage from the HUD | The Districts panel shows "Hive stage n/4" per hive. | Remove the line (the hive's growth still shows on the hive itself). | ✔ v4.71 |
| 188 | Haven't noticed any muzzle flash or explosion flash | Muzzle flash: a 1.4 m star sprite for 0.05 s (big guns 2.4 m, 0.07 s), timed in real time: 3 frames at 60 fps, and at a choppy frame rate it can be **skipped entirely** (likely why it's invisible with the frame drops). Explosions: an orange ball that grows and fades (0.45 s) and a scorch mark; **no bright flash or light**. | Flashes always drawn for at least 2 frames, ~1.5× bigger, 0.08 s. Explosions: a white-yellow flash (0.12 s) plus a short **point light** that lights the ground and walls around it, and a puff of smoke. | ✔ v4.71 |
| 189 | Trees shouldn't grow out of the sidewalk | Street trees are placed on the sidewalk's centre line on purpose (they were palms in tree slots); with real tree models it looks like they sprout from concrete. | Move each street tree onto the grass verge or front yard beside the sidewalk where there's grass; where there isn't, give it a **tree pit** (a square of soil with a kerb) in the sidewalk. | ✔ v4.71 (pits where there's no grass) |
| 190 | Starting to notice frame drops | The start view: **159 draw calls, 270k triangles, 616 meshes, 593 casting shadows**; the 218 tree meshes are each drawn on their own (twice with shadows), and since v4.66 they're alpha-tested, which costs more in the shadow pass. The character cast grew in v4.62 (civilians unsimplified). Likely culprits: the new trees first. | (1) **Draw trees instanced**: one draw per tree type (~20 instead of ~220, and the same for shadows). (2) An **FPS / frame-time readout** (toggle in Settings) so you can tell me numbers and where. (3) Lighter civilians in the crowd bake. Then measure on your machine. | **Owner: the drops were there before the new trees.** v4.69: readout and quality setting in; numbers from the owner's machine next. |
| 191 | Stop spending usage on screenshots | None were sent, but I took private ones to check the trees and the medic (they cost usage). | **No screenshots at all**, private ones included (CLAUDE.md updated); anything only eyes can judge goes to you as "please look at X". | – |

### Round 16 [v4.73] (playtest of v4.72; logged, not started)

| # | Note | Current state (from the code) | Proposed fix | Needs from owner |
|---|---|---|---|---|
| 192 | Boomers shouldn't make an explosion flash | A Bloater bursting is an `explosion` event (type `toxic`); since v4.71 every explosion starts with the bright flash and ground glow, the toxic one included. | No flash or glow for toxic bursts: just the green puff and the gas cloud as before. | ✔ v4.74 |
| 193 | Cars need to be duller | The parked cars are the owner's car pack with its texture colours baked in at full strength (v4.56). | Tone them down when drawn: ~30% less saturated and ~15% darker (one setting, easy to adjust after a look). | ✔ v4.74 |
| 194 | Trade the interrupting splash screens for smaller HUD pop-ups | Region opening, power restored and the first significant building each open a **centred dialog that pauses the game**; so does every tutorial step's prompt. | A small **card at the side of the HUD** (no pause, the game keeps running): a title, two or three lines, and "Got it" to close; older cards stack and fade. The start screen and the win/lose screens stay as they are. | ✔ v4.74 (owner: tutorial unchanged for now) |
| 195 | Hive name and stage should be hover only | Every hive always shows "HIVE · stage n/4" above it; hovering adds health and time to the next stage. | Nothing above a hive until it's hovered (or selected); then the name, stage, health and next-stage bar as now. | ✔ v4.74 |
| 196 | Don't mark the hospital | Since v4.72 a "✚ HOSPITAL" label floats over it until it's looted. | Remove the label; the roof cross (#197) and the objective line stay. | ✔ v4.74 (owner: keep the objective line) |
| 197 | The hospital's cross and white panel float above the roof | They're placed at the building's full height + 0.9 m, but an apartment's roof is lower than that figure (it includes the parapet), so they hover ~1.7 m up. | Put them on the roof surface, inside the parapet. | ✔ v4.74 |
| 198 | Pause prompts need to be condensed, and about the game's functions rather than what's coming next | The briefings and tutorial prompts are paragraphs of story and outlook ("Expect a step up…"). | Rewrite them short and practical: what's new, **how to use it** (keys, clicks, costs), one line each; no lore. Goes with #194. | ✔ v4.74 |
| 199 | Medics should get XP from healing | XP only comes from kills (1 per kill), so medics barely level. | A heal earns XP by how much it restored: e.g. 1 XP per 5% of the patient's health healed, +2 per soldier brought back (a full 40% heal ≈ 8 XP, like 8 kills). | ✔ v4.74 (owner: OK) |
| 200 | Need a new cargo drop plane sound | The supply plane uses a commercial jet fly-by (v4.41). | Swap in a propeller cargo plane (C-130 type) fly-by once there's a recording. | ✔ v4.75 (the owner's C-130 recording) |

### Round 17 [v4.79] (playtest of v4.78; logged, not started)

| # | Note | Current state (from the code) | Proposed fix | Needs from owner |
|---|---|---|---|---|
| 201 | Need Humvee audio | The Humvee is silent except its MG (the emplacement's loop). | An engine loop while it drives (quiet idle when parked), placed at the Humvee like the other sounds. | An engine recording (a diesel truck/Humvee idling and driving), ideally under 25 MB |
| 202 | Can the Humvee's gun rotate? | Yes, possible. The model is baked into one piece, gun included; the gun doesn't move, and the whole vehicle doesn't turn to shoot either. | Split the gun/turret out of the owner's model when exporting it (its parts are separate in the file) and turn it toward the target, back to the front when idle. | – (I'd find the turret's parts in the file) |
| 203 | Can the Humvee turn like a real car instead of spinning on the spot? | It turns instantly to face where it's heading (squads do the same), so it can pivot in place. | Car steering: it only turns while moving, with a turning circle (~6 m), a top turning rate and speed that drops in tight turns; the path is followed by steering toward a point ahead; it backs up a few metres when a turn is too tight. | Fine if it can't squeeze through spots a squad can? |
| 204 | Infantry shouldn't be able to push vehicles | Squads that get too close push each other apart equally, Humvees included. | Vehicles don't get pushed by infantry; infantry steps aside for a vehicle instead. | – |
| 205 | Ground texture is slightly different around buildings | The ground under a building's footprint is painted a flat grey; where the building is smaller than its footprint (house yards, rows split into houses) that grey shows as a band around it. | Paint under-building ground like what surrounds it (lawn, dirt, lot), so nothing shows at the edges. | – |
| 206 | Duller cars look good | v4.74's tone (30% less saturated, 15% darker). | ✔ Keep. | – |
| 207 | Humvee driving sound once when it's given a move | Nothing plays on orders (squads have no order acknowledgement sounds). | A short "drive off" sound (engine revving up) when a Humvee is ordered to move, once per order, at the Humvee. | A recording (could be cut from the same engine recording as #201) |
| 208 | Humvees shouldn't drive through lamp posts | Street furniture (lamp posts, hydrants) is decoration only: nothing collides with it. | Either (a) lamp posts block vehicles (they steer around them), or (b) a Humvee knocks a lamp post over when it hits it (it falls and stays down). | (a) or (b)? |
| 209 | More trees? | Trees and shrubs come from the open-ground scatter (≈18% of 700 tries), the street trees and the house yards; ~200 on the starter map. | More of them: roughly double in open ground, small clusters/tree lines in parks and along the rail and the map edges. Trees are drawn one by one, so if it costs frame rate I'd draw them in batches (one draw per tree type). | How many more: a bit, or a lot? |

