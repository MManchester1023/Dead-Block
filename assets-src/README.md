# Source assets (not shipped)

Models uploaded for the game but **not used yet**. Everything in `public/` is copied into every build,
so models wait here until a feature needs them. When one is wired in, it gets compressed (smaller
textures, simplified mesh) and the shipped copy goes in `public/models/`.

Authors and licences for every file are in `../CREDITS.md`. Planned uses are in the design doc,
§21 → *Visual production track* (V3).

| Use | Files |
|---|---|
| Zombie bodies (style match for the crowd) | `zombie (1).glb`, `zombie (2).glb`, `zombie.glb`, `zombie_woman.glb`, `puller.glb`, `bloater.glb`, `zombie_crawl.glb`, `zombie_screamanimation.glb`, `polyart_zombies_with_animations_free_pack.glb` |
| Boss candidate | `tankzombie.glb` |
| Soldiers (no animations; need retargeting) | `military_rts_character_1_cc0.glb`, `rts_mercenaries_1_cc0.glb`, `rts_mercenaries_2_cc0.glb` |
| Aircraft (call-ins, flyovers) | `a-10_thunderbolt_ii.glb`, `bell_huey_helicopter.glb`, `boeing_ch-47_chinook.glb`, `eurocopter_tiger_attack_helicopter.glb`, `helicopter.glb`, `helicopter_military.glb`, `low-poly_fighter_jet.glb`, `mq-9_reaper_drone__game_ready_military_asset.glb` |
| Ground vehicles | `m2_bradley_ifv.glb`, `fictional_lowpoly_pbr_tank_lowpole.glb`, `ural-4320.glb` |
| Not planned | `fps_guns_4k_-_rifle_1.glb` (CC-BY-ND: can't be modified/compressed, and a gun is a few pixels at our camera distance) |
