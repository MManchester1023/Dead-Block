# Status

Short version of the roadmap (design doc §21). Ranked by importance in my opinion: what makes the game most complete and fun soonest. Updated with each round of work.

## Next, in order

1. **Playtest region 3, the power station and the Med Bay**, and tune region 3's difficulty from that (the bots say it's beatable with losses; that needs a human check). **While playing, note the frame rate with a big horde on screen**: performance has only ever been measured in a slow software browser, never on real hardware.
2. **Confirm the walking-animation fix in a playtest** (round 7 #79). Fixed in code but not visually verified at full frame rate.
3. ✔ **Longer sight** (v4.21): rifles 24 → 30 m, carbines (engineers) 18 → 22 m, MG emplacements 22 → 35 m (still a 120° arc); squads in a guard tower now reach ~42 m.
4. **Sound.** The biggest gap: noise is a core mechanic and the game is silent. Gunfire per weapon, zombie groans and attack sounds, explosions, UI clicks, ambient city wind; free CC0 packs. The radio lines are already written for voice later.
5. **Civilians from house searches**, introduced in region 3: controllable, walk them back to HQ for money and supplies.
6. **Zombies roam between districts and attack outposts**, so outposts have to be fortified and maintained.
7. **Split the two oversized code files** before the open-world work: the renderer (~1,200 lines: crowds, structures, effects, labels, overlays in one class) and the World class (rules, spawning, damage, orders, unlocks). Pure restructuring, no behaviour change; makes everything after it cheaper.
8. **Map data format (+ a simple editor or an existing tile editor).** Today every building, car and district is a hand-typed coordinate in one code file. Fine for three regions, unworkable for a city. Move the layout into data files the game loads, so new districts are drawn, not coded.
9. **Chunked ground and streaming.** The ground is one big texture (2,550 × 2,280 px now) and the map only grows; it will hit graphics-card texture limits. Split the world into chunks (ground, buildings, props) that load as the camera approaches.
10. **Pre-bake the character animations.** Every launch loads ~20 MB of model and animation files and turns them into thousands of poses before the game starts. Do that once, offline, and ship the compact result: faster loading, smaller download.
11. **Save / load.** A persistent city needs it before the open world opens.
12. **Open-world unlock** (the rest of the starter districts open after region 3, §17), **with an unlock-progress panel** showing what's left to unlock.
13. **Police station and fire station** loot landmarks with a big one-time supply haul.
14. **Last model bits.** ✔ Riflemen, engineers (with a working animation) and female zombies are now Mixamo-rigged models with Mixamo animations; no cartoon models left. Every soldier and engineer carries a real M4 model, and female zombies have their attack. Still open (optional): a distinct look for engineers (currently the soldier, tinted).
15. **Medic Team**: field healing, the mobile partner to the Med Bay (could also be unlocked by power).
16. **Fog of war and recon**: unexplored areas show estimates; recon units reveal.
17. **Special (medium) zombies**: Screamer, Brute, Dragger, Puker. The medium spawn pool is ready for them.
18. **Vehicles**: Gun Jeep, Supply Truck, LAV, tank; overrun by pile-ups, re-crewable at half health (#64).
19. **Outpost resupply** via Supply Truck.
20. **Day/night cycle and flares.**
21. **Building destruction and rubble**; tanks crushing cars.
22. **Artillery tier**: unlocks the Command Post barrage (built, currently locked), Mortar Team, strike patterns.
23. **Rooftops and pile-ups**, tall concrete walls, loudspeaker.
24. **Air support**: gun run, bombing run, AC-130, drone (the supply-drop flyover is the template), then the Airfield units.
25. **Bosses** (the uploaded muscular zombie is the first candidate model).
26. **Human enemy faction.**
27. **Polish**: armory customisation, Elite cosmetics, civilians and evacuation, vehicle levelling, airdrop upgrades, reward items, full campaign balance.

**Already works (confirm in the playtest):** the Med Bay unlocks with power and then has to be bought, placed and built by engineers in the base (N).
**Parked** until better-animated soldier models: idle fidgeting, engineer build animation, leaning against cover.
**Tabled:** Last Stand defeat mode.
**Optional housekeeping:** **repo size**: ~200 MB of uploaded models sit in git history, so every fresh copy of the repo downloads them; rewriting the history fixes it but needs a force-push, so only with your OK. Move the simulation to a Web Worker if real-hardware testing shows it's the bottleneck.

## Done

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
