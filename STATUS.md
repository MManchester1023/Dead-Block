# Status

Short version of the roadmap (design doc §21). Ranked by importance in my opinion: what makes the game most complete and fun soonest. Updated with each round of work.

## Next, in order

1. **Playtest region 3, the power station and the Med Bay**, and tune region 3's difficulty from that (the bots say it's beatable with losses; that needs a human check).
2. **Longer sight**: riflemen 24 → ~30 m, MG emplacements 22 → ~35 m. Quick tuning.
3. **Civilians from house searches**, introduced in region 3: controllable, walk them back to HQ for money and supplies.
4. **Zombies roam between districts and attack outposts**, so outposts have to be fortified and maintained.
5. **Open-world unlock** (the rest of the starter districts open after region 3, §17), **with an unlock-progress panel** showing what's left to unlock.
6. **Police station and fire station** loot landmarks with a big one-time supply haul.
7. **Last model bits.** ✔ Riflemen, engineers (with a working animation) and female zombies are now Mixamo-rigged models with Mixamo animations; no cartoon models left. Every soldier and engineer carries a real M4 model, and female zombies have their attack. Still open (optional): a distinct look for engineers (currently the soldier, tinted).
8. **Confirm the walking-animation fix in a playtest** (round 7 #79). Fixed in code but not visually verified at full frame rate.
9. **Save / load.** A persistent city needs it before the open world opens.
10. **Medic Team**: field healing, the mobile partner to the Med Bay (could also be unlocked by power).
11. **Fog of war and recon**: unexplored areas show estimates; recon units reveal.
12. **Special (medium) zombies**: Screamer, Brute, Dragger, Puker. The medium spawn pool is ready for them.
13. **Vehicles**: Gun Jeep, Supply Truck, LAV, tank; overrun by pile-ups, re-crewable at half health (#64).
14. **Outpost resupply** via Supply Truck.
15. **Day/night cycle and flares.**
16. **Building destruction and rubble**; tanks crushing cars.
17. **Artillery tier**: unlocks the Command Post barrage (built, currently locked), Mortar Team, strike patterns.
18. **Rooftops and pile-ups**, tall concrete walls, loudspeaker.
19. **Air support**: gun run, bombing run, AC-130, drone (the supply-drop flyover is the template), then the Airfield units.
20. **Bosses** (the uploaded muscular zombie is the first candidate model).
21. **Human enemy faction.**
22. **Polish**: armory customisation, Elite cosmetics, civilians and evacuation, vehicle levelling, airdrop upgrades, reward items, full campaign balance.

**Already works (confirm in the playtest):** the Med Bay unlocks with power and then has to be bought, placed and built by engineers in the base (N).
**Parked** until better-animated soldier models: idle fidgeting, engineer build animation, leaning against cover.
**Tabled:** Last Stand defeat mode.
**Optional housekeeping:** remove the uploaded models from git history (needs a force-push, only if you ask); move the sim to a Web Worker if real-hardware testing shows it's the bottleneck.

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
