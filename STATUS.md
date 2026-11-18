# Status

Short version of the roadmap (design doc §21). Ranked by importance in my opinion: what makes the game most complete and fun soonest. Updated with each round of work.

## Next, in order

1. **Round 10 quick fixes** (no assets needed): soldiers stop drifting while resting (#106); region 3 roads and rails run to the map edge, rails drawn over roads at crossings (#116, #117); Elite squads gain a fifth soldier (#118).
2. **Pause menu** (#105): Resume, Controls (all keybinds), Settings (sound, UI scale), Restart; the controls list leaves the start screen.
3. **Round 10 assets (waiting on you):** crouch idle animation for soldiers away from their cover (#107); sounds for Bloater death, explosions, hive death, building, power-on, cargo plane/parachute/crate (#108–113); engineer carbine/SMG model + sound (#114); barbed wire model (#115).
4. ✔ **Round 9 fixes** (v4.23): rifle rolled upright in the hand; long animations sampled by length (10 poses/s), with crowd memory kept to ~99 MB; 2 s to climb in/out of a guard tower; no 0% infestation while zombies remain; command cap 14 (+3 per secured district).
5. ✔ **Shooting and cover animations** (v4.24): walking while firing (Mixamo Shoot Rifle); squads in cover play Taking Cover once, then Taking Cover Idle, and stand to fire. Rifle fit set by you with the rifle fitter.
6. ✔ **Engineer build menu** (v4.23): pops up bottom-centre for an engineers-only selection, with icon, hotkey and cost; locked items show how to unlock them.
7. ✔ **Longer sight** (v4.21): rifles 24 → 30 m, carbines (engineers) 18 → 22 m, MG emplacements 22 → 35 m (still a 120° arc); squads in a guard tower now reach ~42 m.
8. **Sound** (first pass ✔ v4.24): gunfire (3 shot variants; MG lower and louder), zombie deaths, ambient groans near the camera, a scream when a horde wave starts or the noise meter fills; quieter with distance from where you're looking, panned by screen position; SOUND button cycles 100/60/30%/off. **Still to add:** explosions, building/engineer sounds, footsteps, UI clicks, ambience, radio voice.
9. **Civilians from house searches**, introduced in region 3: controllable, walk them back to HQ for money and supplies.
10. **Zombies roam between districts and attack outposts**, so outposts have to be fortified and maintained.
11. **Split the two oversized code files** before the open-world work: the renderer (~1,200 lines: crowds, structures, effects, labels, overlays in one class) and the World class (rules, spawning, damage, orders, unlocks). Pure restructuring, no behaviour change; makes everything after it cheaper.
12. **Map data format (+ a simple editor or an existing tile editor).** Today every building, car and district is a hand-typed coordinate in one code file. Fine for three regions, unworkable for a city. Move the layout into data files the game loads, so new districts are drawn, not coded.
13. **Chunked ground and streaming.** The ground is one big texture (2,550 × 2,280 px now) and the map only grows; it will hit graphics-card texture limits. Split the world into chunks (ground, buildings, props) that load as the camera approaches.
14. **Pre-bake the character animations.** Every launch loads ~20 MB of model and animation files and turns them into thousands of poses before the game starts. Do that once, offline, and ship the compact result: faster loading, smaller download.
15. **Save / load.** A persistent city needs it before the open world opens.
16. **Open-world unlock** (the rest of the starter districts open after region 3, §17), **with an unlock-progress panel** showing what's left to unlock.
17. **Police station and fire station** loot landmarks with a big one-time supply haul.
18. **Last model bits.** ✔ Riflemen, engineers (with a working animation) and female zombies are now Mixamo-rigged models with Mixamo animations; no cartoon models left. Every soldier and engineer carries a real M4 model, and female zombies have their attack. Still open (optional): a distinct look for engineers (currently the soldier, tinted).
19. **Medic Team** (#103): pistols (short range), and an active **Heal** ability with a cooldown: select medics, use the ability, click a squad in range.
20. **Fog of war and recon**: unexplored areas show estimates; recon units reveal. **Drone = a Recon Pair ability only** (#101): it orbits a chosen point for 30 s, clearing fog in a circle (#102), then a cooldown.
21. **Special (medium) zombies**: Screamer, Brute, Dragger, Puker. The medium spawn pool is ready for them.
22. **Vehicles**: Gun Jeep, Supply Truck, LAV, tank; overrun by pile-ups, re-crewable at half health (#64).
23. **Outpost resupply** via Supply Truck.
24. **Day/night cycle and flares.**
25. **Building destruction and rubble**; tanks crushing cars.
26. **Artillery tier**: unlocks the Command Post barrage (built, currently locked), Mortar Team, strike patterns.
27. **Rooftops and pile-ups**, tall concrete walls, loudspeaker.
28. **Air support**: gun run, bombing run, AC-130, drone (the supply-drop flyover is the template), then the Airfield units.
29. **Bosses** (the uploaded muscular zombie is the first candidate model).
30. **Human enemy faction.**
31. **Polish**: armory customisation, Elite cosmetics, civilians and evacuation, vehicle levelling, airdrop upgrades, reward items, full campaign balance.

**Already works (confirm in the playtest):** the Med Bay unlocks with power and then has to be bought, placed and built by engineers in the base (N).
**Parked** until better-animated soldier models: idle fidgeting, engineer build animation, leaning against cover.
**Tabled:** Last Stand defeat mode.
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
