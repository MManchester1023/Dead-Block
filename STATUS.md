# Status

Short version of the roadmap (design doc §21). Ranked by importance in my opinion: what makes the game most complete and fun soonest. Updated with each round of work.

## Next, in order

1. ✔ **Round 10 quick fixes** (v4.26): soldiers stand still while resting; region 3 road and rail run to the map edge, rails drawn across roads at level crossings; Elite squads gain a fifth soldier.
2. ✔ **Pause menu** (v4.26): Esc (once there's nothing to cancel) or MENU: Resume, Controls (every keybind), Settings (sound, UI size), Restart (with confirm); the start screen lost its controls list.
3. ✔ **New soldier models** (v4.27): riflemen = Kolos Studios' soldier with his own M4, engineers = MadTrollStudio's SCAR soldier with his SCAR (both re-rigged on Mixamo by you; guns cut out of the model files). Crouch for soldiers away from their cover (#107). Sounds: Bloater burst (pop + gore), explosions, engineer carbine (#108, #109, #114). The rifle fitter now has Unit and Gun pickers (the Barrett is in there for the sniper). Gun fits set by you. Crowd memory 99 → 88 MB.
4. **Round 10 assets still waiting on you:** sounds for hive death, building, power-on, cargo plane/parachute/crate (#110–113); barbed wire model (#115).
5. ✔ **Round 9 fixes** (v4.23): rifle rolled upright in the hand; long animations sampled by length (10 poses/s), with crowd memory kept to ~99 MB; 2 s to climb in/out of a guard tower; no 0% infestation while zombies remain; command cap 14 (+3 per secured district).
6. ✔ **Shooting and cover animations** (v4.24): walking while firing (Mixamo Shoot Rifle); squads in cover play Taking Cover once, then Taking Cover Idle, and stand to fire. Rifle fit set by you with the rifle fitter.
7. ✔ **Engineer build menu** (v4.23): pops up bottom-centre for an engineers-only selection, with icon, hotkey and cost; locked items show how to unlock them.
8. ✔ **Longer sight** (v4.21): rifles 24 → 30 m, carbines (engineers) 18 → 22 m, MG emplacements 22 → 35 m (still a 120° arc); squads in a guard tower now reach ~42 m.
9. **Sound** (first pass ✔ v4.24): gunfire (3 shot variants; MG lower and louder), zombie deaths, ambient groans near the camera, a scream when a horde wave starts or the noise meter fills; quieter with distance from where you're looking, panned by screen position; SOUND button cycles 100/60/30%/off. Round 10 added Bloater bursts, explosions and the engineer carbine. **Still to add:** building sounds, footsteps, UI clicks, ambience, radio voice.
10. ✔ **Civilians from house searches** (v4.28): from Rail Siding on, a search can turn up 2–4 survivors (25% of searches that aren't nests). Select them like a squad and walk them to the Command Post: $20 + 8 supplies each. Unarmed, slow, fragile, and the dead go for them first. Explained in the Rail Siding briefing; an objective line tracks survivors waiting. **Placeholder look** (the rifleman in civilian colours, no gun, soldier walk/idle) until you find a civilian model and Mixamo unarmed animations: *Walking*, *Idle* (or *Scared*/*Nervously Look Around*), *Dying*. Later: some can join as Guerrillas (§10).
11. ✔ **Roaming packs** (v4.29): every few minutes a district's idle dead drift off in a pack (region 2: 3–5 every 5–7 min; region 3 and on: 4–8 every 3–4½ min; the tutorial region doesn't roam) to a neighbouring open district, 60% of the time at its outpost. Packs settle where they end up. Dead loose inside a secured district make it **CONTESTED**: its infestation climbs (up to 30%) and its income drops with it, until you clear them out. Outposts now have a small all-round **garrison** (26 m) that handles strays; a pack needs an MG and sandbags (in the probe: a bare outpost fell to repeated packs 4/4, an MG + sandbags outpost held 4/4, nobody defending).
12. ✔ **Split the two oversized code files** (v4.30), no behaviour change. **Renderer** 1,304 → 252 lines: a coordinator over layers (city, crowds, squads, structures, hives, supply drops, effects, build preview), plus the mesh builders and shared label code in their own files. **World** 891 → 432 lines: state, entity registry and the step loop; the rules moved to `sim/rules/` (campaign setup and regions, player commands, damage, building searches), with World's methods kept as the public API. Checked: the simulation's full state matches the old code exactly at 6 checkpoints over 5 minutes, screenshots match within run-to-run noise, all tests pass, survivors and save/load still work in the browser.
13. **Map data format (+ a simple editor or an existing tile editor).** Today every building, car and district is a hand-typed coordinate in one code file. Fine for three regions, unworkable for a city. Move the layout into data files the game loads, so new districts are drawn, not coded.
14. **Chunked ground and streaming.** The ground is one big texture (2,550 × 2,280 px now) and the map only grows; it will hit graphics-card texture limits. Split the world into chunks (ground, buildings, props) that load as the camera approaches.
15. **Pre-bake the character animations.** Every launch loads ~20 MB of model and animation files and turns them into thousands of poses before the game starts. Do that once, offline, and ship the compact result: faster loading, smaller download.
16. ✔ **Save / load** (v4.29): pause menu → **Save / Load**: three slots plus an **autosave** (every 3 minutes of play and whenever a district is secured), each showing day, region and money; load and delete ask to confirm. The start screen offers **CONTINUE** (latest save). Saves live in this browser, gzipped (~40 KB with a few hundred zombies, ~200 KB at the 1,500-zombie cap). A loaded game comes back paused, camera and speed included, and plays on exactly as it would have (tested tick for tick).
17. **Open-world unlock** (the rest of the starter districts open after region 3, §17), **with an unlock-progress panel** showing what's left to unlock.
18. **Police station and fire station** loot landmarks with a big one-time supply haul.
19. **Last model bits.** ✔ Riflemen, engineers (with a working animation) and female zombies are now Mixamo-rigged models with Mixamo animations; no cartoon models left. Every soldier and engineer carries a real M4 model, and female zombies have their attack. Round 10: riflemen and engineers are now two different models, each with his own gun.
20. **Medic Team** (#103): pistols (short range), and an active **Heal** ability with a cooldown: select medics, use the ability, click a squad in range.
21. **Fog of war and recon**: unexplored areas show estimates; recon units reveal. **Drone = a Recon Pair ability only** (#101): it orbits a chosen point for 30 s, clearing fog in a circle (#102), then a cooldown.
22. **Special (medium) zombies**: Screamer, Brute, Dragger, Puker. The medium spawn pool is ready for them.
23. **Vehicles**: Gun Jeep, Supply Truck, LAV, tank; overrun by pile-ups, re-crewable at half health (#64).
24. **Outpost resupply** via Supply Truck.
25. **Day/night cycle and flares.**
26. **Building destruction and rubble**; tanks crushing cars.
27. **Artillery tier**: unlocks the Command Post barrage (built, currently locked), Mortar Team, strike patterns.
28. **Rooftops and pile-ups**, tall concrete walls, loudspeaker.
29. **Air support**: gun run, bombing run, AC-130, drone (the supply-drop flyover is the template), then the Airfield units.
30. **Bosses** (the uploaded muscular zombie is the first candidate model).
31. **Human enemy faction.**
32. **Polish**: armory customisation, Elite cosmetics, civilians and evacuation, vehicle levelling, airdrop upgrades, reward items, full campaign balance.

**Already works (confirm in the playtest):** the Med Bay unlocks with power and then has to be bought, placed and built by engineers in the base (N).
**Parked:** idle fidgeting (needs an idle animation with weight shifts).
**Tabled:** Last Stand defeat mode.
**Quick wins (v4.31), no visible change:** download 28 → 11 MB and load ~8.9 → ~6.3 s: animation clips are compact `.clip.json` files instead of whole Mixamo FBXs (16.8 → 1.4 MB, every baked pose verified identical), the main zombie keeps only its 5 used animations and the 512 px colour texture the game samples (6.2 → 2.75 MB). Zombies no longer scan the ~130 base-wall segments when picking a target (simulation verified identical). Removed the unused retargeting code, the developer roadmap on the start screen, and leftover asset files. How to add a new Mixamo clip: `assets-src/README.md`.
**Fixed along the way (v4.29):** engineers' working pose came out as broken geometry since the new models (simplification reused a plan made with the gun in hand); the random-number generator no longer loses precision in long games (same numbers, now kept to 32 bits).
**Optional housekeeping:** **repo size**: ~200 MB of uploaded models sit in git history, so every fresh copy of the repo downloads them; rewriting the history fixes it but needs a force-push, so only with your OK. Move the simulation to a Web Worker if real-hardware testing shows it's the bottleneck.

## Done

**Confirmed in the round 9 playtest:** walking animations look right (round 7 fix), frame rate fine with a lot of zombies on real hardware, region 3 and the Med Bay played through.

**World and camera**
- Fixed, hand-built city at real scale (1 unit = 1 m): main base and the three tutorial regions, each fenced off until the previous one is secured: **Roadside Motel**, **Gas Station Strip** (introduces guard towers), **Rail Siding** (big, two hives, introduces the power system).
- **Power system**: restore Rail Siding's power station (engineers, with the yard clear); if the dead wreck it, it goes offline until restored again.
- **Med Bay** (unlocked by power, built in the base): resting squads heal for supplies and lost soldiers rejoin.
- Isometric camera: WASD/arrows/edge pan, zoom, rotate (MMB or Q/E), ops-map view. Pause and 1×/2×/4× speed.
- Procedural buildings, cars, gas stations, street furniture; buildings fade when they hide units; shadows follow the camera.

**Squads and orders**
- Rifle squads and engineers with one shared health pool (soldiers drop out as it falls); permanent wipes; XP and promotions (no free heal).
- Move, attack-move (Ctrl+A), hold, stop (Ctrl+S), waypoints, groups, disband; threat-priority focus fire and forced targets.
- Cover behind cars, pumps and sandbags: two squads per car, three per sandbag wall.
- Search buildings for supplies; some hide zombies that burst out.
- Pathing around Bloater gas.

**Engineers and structures**
- Sandbags, barbed wire (slows everyone), MG emplacement (120° field of fire, aimed with R), outposts, **guard towers** (region 2), demo charges for hives.
- Build/resume/repair/deconstruct; placement preview with direction arrow and range arc.

**Zombies**
- Walkers and Runners (normal), Bloaters (medium) with separate spawn pools; new animated main zombie model; corpses fall.
- Noise system (gunfire heard ~60 m, meter holds 3 s then drains), time-then-distance aggro, hives with 4 stages, alarms and horde pulses, zombies go for units before structures and for HQ before walls.
- Difficulty tiers: region 2 is a real step up (bigger crowd, Runner packs, stage-2 hive).

**Economy and base**
- Money, supplies (continuous income), command cap (grows with secured districts), daily upkeep, kill salvage.
- Barracks menu (B) with rally point; Command Post support: supply drop with cargo-plane flyover and parachute (artillery locked for later).
- District infestation, clearing, securing, region takeover (a lost outpost becomes a hive).

**UI**
- Tutorial for region 1 (skip step / skip tutorial), briefing card when a region opens, objectives follow the current region.
- Hover-only health bars, clickable squad labels, UI scale setting, collapsible panels, important radio lines as alerts (full radio kept for future audio).

**Quality**
- 50 automated tests; scripted balance bots per region; unused models kept out of the build (13 MB).
