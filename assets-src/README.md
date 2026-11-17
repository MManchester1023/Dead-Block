# Source assets (not shipped)

Models uploaded for the game but **not used yet**. Everything in `public/` is copied into every build,
so models wait here until a feature needs them. When one is wired in, it gets compressed (smaller
textures, simplified mesh) and the shipped copy goes in `public/models/`.

Authors and licences for every file are in `../CREDITS.md`. Planned uses are in the design doc,
§21 → *Visual production track* (V3).

| Use | Files |
|---|---|
| Zombie bodies (style match for the crowd) | `zombie (1).glb`, `zombie (2).glb`, `zombie.glb`, `zombie_woman.glb`, `puller.glb`, `bloater.glb`, `zombie_crawl.glb`, `zombie_screamanimation.glb`, `polyart_zombies_with_animations_free_pack.glb` |
| Bloater candidate (only an idle animation; 50k triangles, needs heavy simplifying) | `fat_zombie_idle_animated.glb` |
| Power station (region 3, power system) | `emergency_power_station_ps1.glb` (38 triangles, low-poly; ready to use) |
| Boss candidate | `tankzombie.glb` |
| Soldiers (no animations; need retargeting) | `military_rts_character_1_cc0.glb`, `rts_mercenaries_1_cc0.glb`, `rts_mercenaries_2_cc0.glb` |
| Aircraft (call-ins, flyovers) | `a-10_thunderbolt_ii.glb`, `bell_huey_helicopter.glb`, `boeing_ch-47_chinook.glb`, `eurocopter_tiger_attack_helicopter.glb`, `helicopter.glb`, `helicopter_military.glb`, `low-poly_fighter_jet.glb`, `mq-9_reaper_drone__game_ready_military_asset.glb` |
| Ground vehicles | `m2_bradley_ifv.glb`, `fictional_lowpoly_pbr_tank_lowpole.glb`, `ural-4320.glb` |
| Not planned | `fps_guns_4k_-_rifle_1.glb` (CC-BY-ND: can't be modified/compressed, and a gun is a few pixels at our camera distance) |

## Mixamo (`mixamo/`)

Rigged on Mixamo's standard skeleton (`mixamorig`), so any of these animations can be put on any Mixamo-rigged character.

| Folder | What's there | Still missing |
|---|---|---|
| `shooter-pack/` | Mixamo "Basic Shooter Pack": the **X Bot** mannequin plus rifle idle (aiming), walking, rifle run, firing, reloading, hit reaction, grenade toss, strafes, turns | A soldier-looking character to put them on (X Bot is a grey mannequin) |
| `soldier/` | `Dying.fbx` (death) | |
| `zombie/` | Zombie Idle, Zombie Run, Zombie Crawl, Zombie Dying (animation only, no mesh) | A zombie **walk** and **attack**, and a female zombie character mesh |

Engineer: still needs a working loop (e.g. hammering / kneeling and working).

### `mixamo/to-rig/`

`military_rts_character_1.zip`: the Military RTS Character 1 soldier (middle detail level, ~2,700 triangles) converted to OBJ + texture, Y-up, T-pose, feet on the ground, facing +Z. **Mixamo doesn't accept .glb**, so this zip is what to upload to Mixamo's auto-rigger. It will be used for both riflemen and engineers (engineers recoloured).

