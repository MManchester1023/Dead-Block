# Status

Short version of the roadmap (design doc §21). Ranked by importance in my opinion: what makes the game most complete and fun soonest. Updated with each round of work.

## Next, in order

1. **Playtest region 3, the power station and the Med Bay**, and tune region 3's difficulty from that (the bots say it's beatable with losses; that needs a human check).
2. **Open-world unlock**: what happens after region 3 is secured (the rest of the starter districts open up, §17).
3. **Replace the cartoon models**: rifleman, engineer, big-headed female zombie. *Waiting on Mixamo downloads* (rigged characters + animations; list of clips in the design doc §21 V3).
4. **Confirm the walking-animation fix in a playtest** (round 7 #79). Fixed in code but not visually verified at full frame rate.
5. **Save / load.** A persistent city needs it before the open world opens.
6. **Medic Team**: field healing, the mobile partner to the Med Bay (could also be unlocked by power).
7. **Fog of war and recon**: unexplored areas show estimates; recon units reveal.
8. **Special (medium) zombies**: Screamer, Brute, Dragger, Puker. The medium spawn pool is ready for them.
9. **Vehicles**: Gun Jeep, Supply Truck, LAV, tank; overrun by pile-ups, re-crewable at half health (#64).
10. **Outpost resupply** via Supply Truck.
11. **Day/night cycle and flares.**
12. **Building destruction and rubble**; tanks crushing cars.
13. **Artillery tier**: unlocks the Command Post barrage (built, currently locked), Mortar Team, strike patterns.
14. **Rooftops and pile-ups**, tall concrete walls, loudspeaker.
15. **Air support**: gun run, bombing run, AC-130, drone (the supply-drop flyover is the template), then the Airfield units.
16. **Bosses** (the uploaded muscular zombie is the first candidate model).
17. **Human enemy faction.**
18. **Polish**: armory customisation, Elite cosmetics, civilians and evacuation, vehicle levelling, airdrop upgrades, reward items, full campaign balance.

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
