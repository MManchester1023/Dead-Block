21. Feature priority roadmap [v4, re-ranked v4.10]
Every feature, ranked by importance to the game being fun and shippable. Work goes top to bottom: within a tier, items are in priority order, and the next thing to build is the first open item. ✔ = done. Playtest note numbers (#) point to §22. The code has extension hooks for many later items (see README_old.md → Architecture).

Tier 0: MVP core ✔
✔ Isometric 3D world, camera pan/zoom/rotate (WASD, MMB), fixed-step persistent simulation, pause and 4× speed
✔ Selection, move, attack-move, hold, stop, Shift-waypoints, cover, disband
✔ Squads with one shared health pool, soldiers dropping at thresholds, permanent wipes
✔ Threat-priority focus fire, forced targets
✔ Walker, Runner, Bloater; hive with stages; noise (with hold) and horde pulses
✔ Money, supplies, daily upkeep, command cap, Barracks production and rally point
✔ District infestation, engineer outposts, field fortifications (sandbags, barbed wire, MG emplacement)
✔ Static cars as cover; house searching and zombies holed up in buildings
✔ Per-district difficulty tiers (tutorial → easy → standard)
Tier 1: The campaign loop (next)
✔ Tutorial region 2: Gas Station Strip (v4.11). Fenced off east of the motel until the motel is secured, then the wire is cut, the region is seeded and its hive wakes (#58, §17)
✔ Playtest round 6 fixes (v4.14): animation twitch (#67), noise decay (#72), zombie classes and pools + Bloaters in region 1 (#70, #75), artillery locked for later (#73), MG field of fire + ghost arrow (#71)
✔ Region 2 rework (v4.14, #74): a real difficulty step, and guard towers (#54) as region 2's new feature: unlocked when the region opens, explained in a briefing card. Engineer-built (V, $120 · 40▣); one squad mans it for +40% range, sight over cars and walls, and half damage from ranged threats; melee goes to the tower, which the dead must tear down; any other order brings the squad down
✔ Playtest round 7 fixes (v4.16, #76–84)
✔ Tutorial region 3: Rail Siding (v4.17). The open-world unlock after it is still to come (#58, §17)
✔ Power stations: the first one, in region 3 (v4.17). The wider network and the other base unlocks power drives come with the open world (§12)
✔ Med Bay (v4.17), unlocked by restoring region 3's power. ✔ Medic Team (v4.61), unlocked by the Med Bay. Round 8 to-dos [v4.19], ranked (§22 #85–92):
16a. ✔ Longer sight (v4.21, #86, #87): rifle 24 → 30 m, carbine 18 → 22 m, MG emplacement 22 → 35 m (120° arc kept); guard-towered squads ~42 m.
16b. ✔ (v4.28) Civilians found by searching houses (#91), introduced in tutorial region 3: a controllable civilian group that earns money and supplies when walked back to HQ. (Moves the civilians part of Tier 4 #36 forward.)
16c. Zombies roam between districts and attack outposts (#88). Needed before the open world: holding ground has to mean defending it.
16d. Open-world unlock (§17) with an unlock-progress panel (#92) showing what's left to unlock.
16e. Police station and fire station as loot landmarks (#89, #90) with a decent amount of supplies.
✔ Region takeover → hive (§19)
Save / load (a persistent city needs it before the open world)
Fog of war and recon
Outpost resupply via Supply Truck
✔ XP and leveling (Recruit → Elite); Elite paths (Grenadier/Cinder) still open
✔ Explosion knockback
Tier 2: Escalation and spectacle
Vehicles: Gun Jeep, Supply Truck, LAV, Battle Tank; sheet-metal armour. Includes overrun and re-crewing (#64): zombie pile-ups kill the crew, the empty hull stays, any infantry squad can board it, it starts at 50% HP and engineers repair it
Special zombies: Screamer, Brute, Dragger, Puker; reanimation
Day/night cycle and flares
Building destruction, permanent rubble, tank crushing of cars
Artillery (v4.12, #73: a later unlock, not available from the start): the Command Post barrage unlocks here, alongside the Mortar Team and strike patterns. The barrage itself is already built and just gets locked until then
Elite rooftop access and pile-ups onto roofs
Tall concrete walls, loudspeaker
Tabled (v4.12, #69): Last Stand defeat mode (was Tier 2 #28). Kept in the doc (§13) for later; not scheduled.

Tier 3: Air power and late game
Air-support call-ins with coloured smoke: gun run, bombing run, AC-130, drone (supply-drop flyover ✔ is the template)
Airfield: Hawk (with rappelling), Sparrow, Hauler, Hornet, Anvil
Bosses (the uploaded "muscular zombie" is the first candidate model)
Human enemy faction (Airport, Downtown Core)
Howitzer / HIMARS-style artillery vehicles (if kept)
Visual production track (runs alongside the tiers) [v4.1, updated v4.10]
V1. ✔ World scale; ✔ camera rotation; ✔ glTF model loading
V2. ✔ Instanced, animated crowds + flow-field pathing; ✔ smoother flipbooks (more poses, stable simplification), ✔ corpses fall. Web Worker deferred until real-hardware testing shows the sim is the limit
V3. Real assets, in this order:
✔ Main zombie: "Zombie" by pxltiger (Idle/Walk/Run/Attack/FallingBack)
Replace all three cartoon Quaternius models (v4.12, #66): the big-headed female zombie, the rifleman and the engineer. This is now the top visual item. Every replacement needs, at minimum, idle, walk, a shooting or attack loop, and a death that ends on the ground (plus a work/build loop for the engineer). None of the uploaded soldier models have animations, so the practical route is Mixamo (free, Adobe account, licence allows use in games): upload the chosen model or pick a Mixamo character, download each clip as FBX "with skin", and drop them in. The loader already handles multi-part glTF/FBX and texture colours. If an uploaded model won't rig cleanly, use a Mixamo stock soldier instead
Aircraft for call-ins and flyovers (A-10, Huey, Chinook, Tiger, Reaper drone, fighter jet), compressed when wired in
Ground vehicles for Tier 2 (Bradley, tank, Ural truck)
V4. Lighting pass: dusk grade, night lights/flares, smoke columns, fire
V5. UI restyle toward the §14 direction (unit-card strip, minimap, day clock). ✔ UI scale and collapsible panels
Parked until better-animated soldier models: idle realism (#22), engineer build animation (#23), leaning against cover (#25)
Technical track (v4.20) — groundwork the open world depends on
These get more expensive the longer they wait, so they're scheduled before the open-world unlock (ranked together with the features in STATUS.md).

T1. ✔ Real-hardware performance check (v4.22, round 9 #100): frame rate fine with a lot of zombies on the owner's machine. Web Worker not needed for now.
T2. Sound (first pass ✔ v4.24: gunfire, deaths, groans, screams). Still to add: explosions, building, footsteps, UI, ambience. Originally: gunfire per weapon, zombie groans/attacks, explosions, UI, ambience (CC0 packs). Noise is a core mechanic and the game is silent. The radio lines are ready for voice later.
T3. Split the oversized code: the renderer (~1,200 lines) and the World class into focused modules. No behaviour change.
T4. Map data format (+ simple editor or an existing tile editor). The layout is hand-typed coordinates in code today; a city needs data files.
T5. Chunked ground and streaming. One ground texture (2,550 × 2,280 px) won't survive a growing city; chunks that load near the camera.
T6. Pre-baked character animations. Bake the flipbooks offline instead of processing ~20 MB of models on every launch.
T7. Save / load, moved up from Tier 1 #18: the state keeps growing (searches, unlocks, power, crates, hives), so it only gets harder.
Housekeeping: ~200 MB of uploaded models in git history (rewrite needs a force-push and the owner's OK); Web Worker for the sim if T1 shows the sim is the bottleneck.
Tier 4: Polish and attachment
Armory weapon customization and Elite cosmetics
Civilians, evacuation and Guerrillas
Vehicle leveling paths
Airdrop upgrades
Reward items catalogue, full campaign balancing
Design status: v3 decisions remain confirmed. v4 additions are confirmed direction except where marked "candidate", "proposed" or "open question". All numbers are subject to playtesting.

Technical and polish plans [v4.96] (owner asked for plans; STATUS #77–#85)
#77 Docs. The design doc is 1,322 lines, about 430 of them the playtest log (§22) and ~100 the version table.

Move §22 (every round, as is) to docs/Playtest_Log.md; §22 here keeps a short summary and a link.
Move the version table to docs/Changelog.md (newest first, same rows); the design doc keeps a line saying where it is.
Tidy the design doc's own sections where later rounds changed them (e.g. horde waves are noise-only since v4.95, the Heavy MG Nest's name), so it reads as the game today.
Group the tests by feature instead of by round (r14, humvee19, r21 → vehicles, hives, hud, …), same tests, nothing dropped; the browser checks keep their round names (they're a record of each round).
Update CLAUDE.md, STATUS.md and tools/README.md to point at the new places. No game changes.
#78 Repo size (measured). The download is big because of the current files, not just history: assets-src/ (the original downloads: model packs, sound zips, recordings) is 470 MB and is in every ZIP you download; the game itself (public/ + src/) is ~38 MB. The history adds ~180 MB packed (deleted models, six old 17 MB copies of cast.bin).

Step 1 (the big win, no history rewrite): move assets-src/ into a separate repository (e.g. dead-block-assets), where you upload originals from now on; this repo keeps only what the game ships plus a note of where each original lives (CREDITS.md already lists them). ZIP downloads drop from ~510 MB to ~40 MB. I'd add the assets repo to a session when an upload needs converting.
Alternative to step 1: Git LFS for assets-src/ (ZIPs then contain small pointer files instead). Simpler for uploads, but GitHub's free LFS allowance is 1 GB of storage and 1 GB of downloads a month, and every new cloud session would download them again: I'd rather not.
Step 2 (optional, needs your OK): rewrite the history to drop the deleted big files and old cast.bin copies (clone ~180 MB → a few tens of MB). Every branch gets rewritten; old copies must be re-downloaded; links to old commits stop working.
Also: cast.bin (17 MB) is re-committed after each character change; that's fine for now (a few times a year).
#79 Two oversized files.

src/sim/systems/orders.ts (1,099 lines): split into orders.ts (the order dispatcher and infantry), vehicles.ts (all the driving: route, steering, reversing, parking, getting unstuck, running over) and engineering.ts (build, repair, demo charges). Pure move: checked with the sim-hash probe (identical before and after) and the tests.
src/ui/Hud.ts (965 lines): split as part of #71 and #76 into ui/hud/ pieces: top bar, districts, objectives line, selection strip, command grid, menu and settings, cards, dev panel, with Hud.ts just wiring them.
Do the orders.ts split before #81.
#80 Pathfinding speed. Each route search builds fresh lookup tables (maps and sets) and stops after 6,000 squares.

Rewrite the search on reused fixed-size arrays (no allocation per search), same results.
A benchmark (1,000 random routes on the starter map) before and after; I'd expect several times faster (a guess until measured).
With the time saved: a bigger search budget (fixes long routes that stop short, #75) and a straighter first leg.
For the open world later: a coarse region-to-region route first, then the detailed one (only if the map grows enough to need it).
#81 Vehicle driving, properly. Today it's a coarse route plus a dozen special rules (settle, orbit, K-turn, reverse, bump memory, unstuck). Plan: a planner that knows how a car moves (hybrid A*: it searches over position and heading using short forward and reverse arcs at the vehicle's turning circle, checks the vehicle's real outline against buildings, cars, trees and posts, and charges extra for reversing and changing direction). It produces a drivable path that already includes K-turns, backing up and the final facing; a simple follower drives it. Long trips keep the coarse route for the far part and plan the last ~40 m (or any tight part) properly. Most special rules go; bump memory and re-planning stay as a safety net. Measured on the 40-drive soak test (today: 40/40 arrive, 23 bumps). When: with the second vehicle class (LAV or tank), after #79.

#82 End-of-region summary card. When a region is secured, a card at the side (not pausing, like the others): time taken, zombies killed (this region and the campaign total), hives destroyed, buildings searched, supplies and money found, civilians rescued, soldiers and squads lost, the top squad (most kills) and promotions. Needs a small per-region tally in the game state (saved with the game); the same tally gives the total kill counter (#252) in the top bar.

#83 Squad level-up sound. A short sting (under ~1.5 s) when a squad is promoted, placed at the squad and heard at any zoom, plus a brief gold flash on its label. Needs a sound: a bugle note, a radio chirp or a short "rank up" chime (free-licence; Pixabay or Freesound). Until then, nothing (no placeholder).

#84 Idle squad button. A small "IDLE n" button with the bottom HUD (#76) and a key (., as in many RTS games, if it's free): each press selects the next squad with nothing to do (no orders, not riding, not in a tower, not working) and centres the camera on it; Shift+click selects all of them. Hidden when nobody's idle.

#85 Minimap. A small square map in a corner (about 180 px, bottom left, with the radio line above it):

drawn once from the map (roads, buildings, the base), then 4–10 times a second: region outlines (infestation tint, locked dimmed), your squads (blue), structures (squares), hives (red), zombies as faint red dots, and the camera's view as an outline (it turns with the camera);
click or drag on it to move the camera; later, right-click on it to send selected squads;
a Settings switch to hide it; it stays on the ops map too.
Cheap: a 2D canvas, a fraction of a millisecond per update.