Document history



Version	Notes



v3	November 2026 design review: map sequence, engineer construction rules, Elite armory access, hive progression. Revision addendum (§17–20): tutorial, open-world transition, region takeover.



v4	Addendum merged into the main body. Added: rooftops, tall walls, building destruction and rubble, vehicle crushing, AC-130, colored smoke, target priority, human faction (placeholder), day/night with flares, Little Bird, knockback, sheet-metal armor, artillery vehicles, Last Stand defeat, outpost resupply, artillery strike patterns, loudspeaker, Hawk rappelling, Elite cosmetics. New §21 priority roadmap. Table formatting fixed.



v5.03	Round 23 #279: every gun's flash lights the ground briefly (owner; STATUS #92). No code changes.



v5.02	Round 23 #278: Boomers hurt vehicles by hitting them as well as by exploding (owner; STATUS #93). No code changes.

v5.01	Round 23 answers recorded (level bonuses and zombies vs vehicles as proposed) and #279 logged: muzzle flashes are 2–3 pixels because point sizes are pixels under the orthographic camera (STATUS #92). No code changes.

v5.00	Round 23 logged (§22, #271–278): clickable radio messages, easier selection, power station repairs under attack, structures block fire, damaged idle vehicles move off, ops-map labels, bigger level bonuses, zombies vs vehicles. No code changes.

v4.99	Round 22 answers recorded: "Engineer Alpha" names; right-click aims every targeted command, building placement included; hive health 3,000 / 4,500 / 6,000 / 8,000, explosives and fire ×3, lost levels grow back; hurt sounds for soldiers and zombies; an SMG cut from a model we have. No code changes.

v4.98	Round 22 #270 logged: a button (and the Home key) to jump the camera back to the main base (STATUS #87). No code changes.

v4.97	Round 22 logged (§22, #257–269): no command points, see-through gas-station roofs, crouch icon, charges not interrupted, search bar, hurt sounds, medics from the Med Bay, right-click to aim abilities, engineers round gas, no "Sapper", hive weak spot, hives hurt by gunfire and losing levels, medic SMG and animations. No code changes.

v4.96	Plans written (§21 "Technical and polish plans", STATUS #77–#85): docs split, repo size (assets-src is 470 MB of every download), splitting orders.ts and Hud.ts, faster pathfinding, a proper vehicle planner, end-of-region summary card, level-up sound, idle squad button, minimap. No code changes.

v4.95	STATUS #70 (round 21 #249, #250, #253, #255, #256): region 2's hive at stage 1; noise cooldown 60 s; hive stages 15 / 10.5 / 12 min; "Heavy MG Nest"; horde waves only from noise (no timer).

v4.94	Round 21 #246: the owner picked all five bottom-HUD ideas (STATUS #76): an RTS command grid with the build menu as a page of it, a compact selection strip, objectives as one line under the top bar, radio as one line with the log on hover, and nothing at the bottom until something is selected. No code changes.

v4.93	Round 21 answers recorded, plus #256 (no timed horde waves, noise only): troops = soldiers, clock from 06:00, pause/speed stay; the tutorial covers all three starter regions and pauses per prompt; open-world start later (with a bit more money and supplies); hive stages 15 / 10.5 / 12 min. No code changes.

v4.92	Playtest round 21 logged (§22, #245–255, a second player): top bar and bottom HUD, tutorial rewrite, open-world start, region 2 hive stage, noise cooldown, zombie path variety, kill counter, Heavy MG Nest, infantry routes, hive upgrade times. No code changes.

v4.91	STATUS #68 (round 20 #234, #235, #236, #240, #244): dev menu switch in Settings (off by default); vague hospital line; no X after searching; no per-soldier dots in labels; faint region borders on the ops map.

v4.90	STATUS #67 (round 20 #232, #233, #238, #239, #243): Vehicle Bay $150, Humvee $180 (supplies unchanged); Humvee MG and MG emplacement 15 a hit; Humvee MG reaches 45 m; Humvees out of the far-right door.

v4.89	STATUS #66 (round 20 #241, #242): vehicle routes go round trees and lamp posts (walls, not costs) and keep off buildings and parked cars; trees 1.2 m round to vehicles; a stuck Humvee backs off and tries other ways, and only stops (radioing in) after 4 goes; an unreachable spot: it drives to the nearest point.

v4.88	Round 20 answers recorded (§22 #232–243): far-right door, Humvee $180, Vehicle Bay $150 (supplies unchanged), Humvee and MG emplacement both 15 damage, dev menu off by default, hospital line without the red cross, no search X at all, squad dots removed, Humvee range 45 m; reload clips and sound to come. No code changes.

v4.87	Playtest round 20 logged (§22, #232–244): Humvee door, prices, MG emplacement damage, dev menu setting, hospital wording, search X, reloading, head dots, Humvee pathing and giving up, Humvee range, ops-map borders. No code changes.

v4.86	STATUS #63 (round 18 #221): the dev menu spawns every friendly unit (free; the ones not in the game yet as stand-ins) and places every buildable structure finished and free, unlocked or not, with the normal placement ghost.

v4.85	Round 19 built (STATUS #64, #65): Humvees steer round trees, remember what they hit and plan round it, back out properly, don't cut corners into parked cars, reverse to close spots, drive through queued waypoints, run over only what's under them; MG 20 a hit (Humvee and emplacement) and weapon damage on the tuning page; the turret aims in the game and the gun waits for it; drive-off and MG sounds follow zoom; "REPAIRING" on vehicles.

v4.84	Playtest round 19 logged (§22, #222–231): MG damage, Humvee run-over reach, drive sound distance, trees, getting stuck, reversing, "Repairing" status, queued waypoints, MG sound with zoom, turret aiming before firing. No code changes.

v4.83	Round 18 built (STATUS #60–#62): Humvee shots from the gun, one drive-off at a time, seamless WAV loops, no circling, selection and medic-boarding bugs fixed; running zombies over, right-drag parking direction (ghost + arrow, K-turn shuffle), engineer repair with N; the Vehicle Bay repairs parked vehicles and builds them out of its door; XP bars.

v4.82	Playtest round 18 logged (§22, #210–221): Humvee bullets from the gun, sound overlap and loop seams, running over zombies, right-drag parking direction, circling, selection and medics boarding (bugs), XP bars, engineers repairing vehicles, the dev menu spawning units and buildings. No code changes.

v4.81	STATUS #59: an in-game dev menu (` key): drop zombies of any type (1–50, hunting or wandering) or a hive at stage 1–4 by clicking the map, clear all zombies, +$1000 · +500▣.

v4.80	Round 17 built (STATUS #56–#58): vehicle classes (light / armored); Humvees drive like cars, a turning turret, no pushing by infantry, steer around lamp posts; the owner's engine idle and drive-off sounds (zoomed in only), 50 cal MG and power-on sounds; ground under buildings matches its surroundings; \~3× the trees, drawn in batches. Street furniture placement moved into the sim (sim/decor.ts) so vehicles know where lamp posts are. Next: #59, an in-game spawning dev tool.

v4.79	Playtest round 17 logged (§22, #201–209): Humvee engine and drive-off sounds, a turning gun, car steering, no pushing vehicles, Humvees vs lamp posts; ground around buildings; more trees; duller cars confirmed. No code changes.

v4.78	Why the owner never heard the power-on sound: the first restore opened the power briefing, which paused the game a moment before the sound played (and nothing plays while paused), so it was always silent. Fixed by v4.74's non-pausing cards; sound.cjs now checks it plays.

v4.77	STATUS #51 (part): the Humvee (owner's model, SIpriv, CC BY 4.0): made at the Vehicle Bay (its own production panel), the MG emplacement's weapon firing all round, room for one squad of up to 5 (board by right-click, unload with U; riders hidden and safe; bail out if it's destroyed). The roster's "Gun Jeep" placeholder became the Humvee. MG sound loops now follow their gun.

v4.76	Owner: frame rates fine now (STATUS #47 closed); region 3 spice (#51) feels OK for now, to decide later. No code changes.

v4.75	Round 16 #200: the supply plane is the owner's C-130 propeller fly-by (timed to peak over the drop at 10 s into the clip).

v4.74	Round 16 built (STATUS #53–#55): no flash for Bloater bursts, duller cars, hive labels on hover, no hospital label and the cross on its roof; briefings are non-pausing HUD cards with short how-to text (tutorial unchanged); medics earn XP from healing (a full heal = 8 XP).

v4.73	Playtest round 16 logged (§22, #192–200): no flash for Bloater bursts, duller cars, HUD pop-ups instead of pausing dialogs, hive labels on hover, no hospital label, roof cross on the roof, shorter how-to prompts, medic XP from healing, a new cargo plane sound. No code changes.

v4.72	STATUS #50 (round 15 #185): significant buildings: the hospital in region 2 (15 s search, guaranteed haul, unlocks the Med Bay repair; roof cross and label; map editor field); the Med Bay in the base from the start, run down until engineers repair it (no power needed any more), drawn with the owner's Medical Tent; region 3's power unlocks the Vehicle Bay (engineers build it, Y), drawn with the owner's garage; first-landmark briefing, objectives, hospital tuning knobs. Tools: export-prop.cjs (building models → structure GLBs).

v4.71	STATUS #48, round 15 quick fixes: hive stage off the HUD (#187); visible muzzle flashes (bigger, longer, at least two frames) and an explosion flash + ground glow (#188); street trees on the grass beside the sidewalk or in tree pits (#189); finished effects free their GPU memory.

v4.70	Dev tools upgraded to clear npm install's security warnings: Vite 5 → 8, Vitest 2 → 5 (0 vulnerabilities; esbuild no longer needed, so the install-scripts warning goes too). Development-only: the game itself is unchanged; tests, build, probes and the browser checks pass on the new versions.

v4.69	STATUS #47 part 1: Performance readout and Graphics quality (High/Medium/Low) in Settings; tools/browser/perf.cjs profiles a busy scene (475 zombies: sim \~2 ms/tick, scene \~1.5 ms, 1.24 M triangles + shadows: GPU-bound).

v4.68	Round 15 #181: difficulty tuning tool dev-balance.html (every difficulty knob, Save for this browser, Download balance.json to keep; the game applies public/balance.json then the browser's edits and says so). #182: README and STATUS list the map editor, weapon fitter and tuning tool with links. Round 15 answers recorded (#183, #185, #186, #190).

v4.67	Playtest round 15 logged (§22, #181–191): difficulty tuning tool, README tools, pile-up climbing, region 3 spice (Humvee, build incentives), hospital → Med Bay and power → Vehicle Bay with run-down base buildings, routes for selected only, hive stage off the HUD, invisible muzzle/explosion flashes, trees in the sidewalk, frame drops, no screenshots. No code changes.

v4.66	Every tree is from the owner's new forest pack (99.Miles): 13 trees (pines, plus four with separate trunk and branches) and 3 bushes, with real textures and cut-out leaf cards (shadows follow the leaves); scaled to street-tree height (6–9.5 m), bushes 1–1.6 m. Replaces the v4.58 packs.

v4.65	The owner's gun fits from dev-rifle.html: the medics' pistol and the riflemen's M4 sit as he placed them.

v4.64	The owner's medic model, re-rigged on Mixamo, replaces the red-tinted engineer stand-in; the owner's pistol clip (a steady aim, no recoil) is the medics' shooting pose.

v4.63	Squads leave a guard tower by jumping down (owner's Mixamo "Jumping Down", replacing "Climbing Down"): 2.5 s with the landing (was a 2 s climb); the clip and the fall are timed together so they touch down as it lands, soldiers one after another.

v4.62	Owner uploads wired in (#41): the re-rigged civilians (male and female, alternating); the straight Rifle Crouch Walk for crouched squads; a medic character (engineer body as a stand-in, the owner's pistol model, Mixamo pistol idle/run/kneel/stand-up, the healing animation while treating) and pistol sounds. The medic model itself is exported for a Mixamo re-rig. Gun and OBJ exporters read FBX now.

v4.61	STATUS #20 / round 9 #103: the Medic Team is in. Unlocks with the Med Bay; pistols (15 m); Heal (K / button / right-click a hurt squad): walk over, treat 2 s without shooting, +40% of the squad's health and fallen soldiers back, 30 s cooldown. Engineer body tinted red and a pitched-up carbine sound as stand-ins.

v4.60	Design: the Medic Team unlocks with the Med Bay (owner); recorded on STATUS #20, not built yet.

v4.59	All trees are the owner's models now: the street palms and the house-yard trees use them too (procedural trees only as a fallback).

v4.58	The owner's two tree packs (free use) as the street trees and shrubs: 20 trees and 3 shrubs, colours baked, ≤ 900 triangles, picked per spot; palms stay procedural.

v4.57	Fix: the OBJ export for Mixamo's auto-rigger laid "Z up" models (the civilians) flat on their face; it now stands them up (and the right way up). Civilian zips re-exported.

v4.56	Round 14 uploads, part 2: the owner's car pack (Comrade1280, CC BY 4.0) as the parked cars: ten models merged, texture colours baked, \~1,500 triangles each, picked per car; civilians exported skeleton-free for a Mixamo re-rig.

v4.55	Round 14 uploads, part 1: soldiers kneel to fire when crouched, crouch-walk, stand up from a crouch, die crouched when hit low, and climb guard-tower ladders; survivors breathe while waiting and run; MG emplacements fire a looping 50-cal burst. Cast re-baked (8.6 → 12.5 MB, 131 → 68 MB in memory vs a live bake).

v4.54	Formation maker (§22 #177): line, column, wedge, box, spread from the squad panel; right-drag places the formation and sets its facing (with a preview); plain right-click unchanged.

v4.53	Random hive sites (§22 #163): hives placed at random open spots each game (seeded, saved), apart and away from fence, base and squads; ordered west to east so per-hive stages keep their meaning.

v4.52	Waypoints and patrol (§22 #174–176): Shift+right-click waypoints unchanged (stop at the last); new Patrol order (P, click points, Shift+click to add), looping and fighting on the way; routes drawn for selected squads (green numbered waypoints, amber patrol loops).

v4.51	Round 14 fixes and tweaks (§22 #162, #165–168, #170–173, #178, #179): zombies route round walls at any distance and use headway for the stuck check; overlapping squads' labels stack on hover; Runners 9.5 m/s; toughness 0.45; demo charge 2 s; wander 40 m; hive spawns ≥ 5 s apart; grouped Barracks queue; no pulse countdown or cooling-down text; "Horde wave".

v4.50	Round 14 playtest logged (§22 #162–180), not started. Causes found: zombies within 8 m of their target walk straight at it through walls, and the stuck check misses jostled zombies (#167); hovering shows only the nearest squad's label (#178). Shift+right-click already does "go to each, stop at the last" (#174/#175).

v4.49	More zombies, but weaker (owner: "the current state is a little underwhelming"): HORDE setting (count 2, toughness 0.6, damage 0.75) scales every crowd, brood, pulse, pack and nest; per-kill money, supplies, XP and infestation halved to keep the economy.

v4.48	Footsteps removed (owner's call).

v4.47	STATUS #15: characters pre-baked into public/models/baked/cast.bin (tools/assets/bake-cast.cjs): loaded in 0.4 s instead of a \~5 s bake at launch, half the memory (99 → 52 MB), identical poses within 0.5 mm; live bake kept as the fallback.

v4.46	STATUS #14: the city streams in 192 m chunks (ground textures, buildings, props) built as the camera nears them, ground painted within a per-frame budget, low detail far away and on the ops map, far chunks freed past a budget. Tested on a 1.8 km map.

v4.45	STATUS #13: the map is data (src/data/maps/starter.json, built by buildMap()), proven identical to the hand-coded map; map editor dev-map.html (edit, check, save, play the edit). STATUS items get fixed numbers (originals #1–32 restored; rounds 11–13 are #33–40).

v4.44	Footsteps: the owner's boots-on-gravel recording as a quiet seamless loop under up to 4 moving squads near the camera (crouched: softer, slower).

v4.43	Round 13 built (§22 #151–156, #158, #160): soldiers slide along walls and rejoin when stuck; MG nests face their aim; ambience levels; Walkers attack every 2 s, Runners every 1 s; power coming on draws the dead; squad labels only on hover. #157 side tasks added to the roadmap.

v4.42	Round 13 playtest logged (§22 #151–161), not started. Causes found: soldiers stuck on buildings come from v4.36's no-walking-into-walls rule (#154); the MG nest model never turns to its aim (#160). The power-on sound plays in the current build (#155, retest).

v4.41	Power station start-up sound from the owner's recording (§22 #112), placed at the station like other sounds; supply crate landing thud (#113).

v4.40	New Bloater burst from the owner's recording replaces the layered pop + gore (§22 #108).

v4.39	Owner's uploads: hive death = wet mud blast (§22 #110), supply plane fly-by timed to peak over the drop + parachute opening (#113), barbed wire model (CliffUnderside, CC BY 4.0) simplified 245k → 3.5k triangles (#115). The new Bloater sound (a video) had silent audio: old burst kept.

v4.38	Sounds from the owner's uploads: engineers' construction loop (three recordings layered; §22 #111), soldier deaths (3), UI click, ambience (suburban bed + very quiet horror drone, seamless loops), radio chatter (8 clips cut from one recording: on Command/Overwatch radio lines and now and then in the background).

v4.37	Round 11 leftovers built (§22 #125–127, #135): muzzle flashes; hive hover shows time to its next stage; G = crouch (half cover anywhere, 60% speed), cover room (car 2, sandbags 3, MG nest 2) with overflow squads crouching in the open; squads in cover hold their ground; barbed wire hotkey G → Z.

v4.36	Round 12 built (§22 #137–150 except #143's open question, now answered): noise-pulse cooldown 45 s; one building per house (53 → 68); search pop-ups; wanderers stop walking into buildings; build sites push squads off; footprint clicks; soldiers walk or stand (no sliding); engineers don't shoot at work; Garrison installed by engineers (6 s); idle leftovers go for your structures after 2 min; MG 12 damage; TREATING; district names move the camera; no command cap from Rail Siding on.

v4.35	Round 12 playtest logged (§22 #137–150), not started. Causes found: houses blocks searched as one building (#141), search results never shown on screen (#142), no cooldown after a noise pulse (#149), deconstruct picks the first overlapping structure (#148), build sites trap squads standing on them (#147), wandering zombies skip the go-around routing (#139), resting soldiers slide in the idle pose (#137).

v4.34	Round 11 bugs and quick tweaks (§22 #120, #123, #124, #128–134, #136): plane shadow no longer freezes; search X on the searched house; outposts at ≤ 2% with the hives dead, "N dead left" shown; closest target first; Runners 17 hp; carbine 10 damage; moving fire 50%; outpost Garrison is a $80 + 25 ▣ upgrade; east Rail Siding hive at stage 2; no supply cap; no pack-drifting radio line.

v4.33	Round 11 playtest logged (§22 #119–136), not started: confirmed cover crouch/lean (#119) and region 2 difficulty (#122); bugs: cargo-plane shadow freezing (#123, cause found), search marking the wrong house (#124), stuck at 1% infestation (#120); tweaks: closest-target priority, engineer damage, no supply cap, region 3 stage-2 hive, outpost garrison as an upgrade, quieter radio; muzzle flash, search pop-ups, hive stage timer; crouch in open cover.

v4.32	Hand-off for a new chat: CLAUDE.md (working agreements, asset workflow, checks) and tools/ (probes, browser checks, asset scripts), all tested.

v4.31	Quick wins, no visible change: compact animation clips and a trimmed main zombie (build 28 → 11 MB, load \~8.9 → \~6.3 s, every baked pose identical), zombies skip the base wall when picking targets (simulation identical), dev clutter removed.

v4.30	Code restructure (STATUS #12), no behaviour change: the renderer split into layers (city, crowds, squads, structures, hives, supply drops, effects, build preview); World's rules moved to sim/rules/ (campaign, commands, damage, buildings). Verified with identical simulation state hashes and matching screenshots.

v4.29	Roaming packs (STATUS #11, §22 #88): idle dead drift between neighbouring districts in packs, likelier at outposts; dead inside a secured district contest it (infestation up to 30%, income cut to match); outposts get a small all-round garrison. Save / load (STATUS #16): 3 slots + autosave, Continue on the start screen, exact replay after loading.

v4.28	Civilians from house searches built (STATUS #10, §22 #91): Rail Siding on, 25% of non-nest searches find 2–4 survivors; walk them to the Command Post for $20 + 8 supplies each; unarmed, slow, preferred prey. Placeholder look until a civilian model + unarmed animations arrive.

v4.27	New soldier models (round 10): riflemen = Kolos Studios' low poly soldier, engineers = MadTrollStudio's SCAR soldier, both re-rigged on Mixamo and carrying their own guns (cut out of the model files); crouch for soldiers away from their cover (#107); sounds for Bloater bursts (#108), explosions (#109) and the engineers' carbine (#114); rifle fitter picks any unit and gun.

v4.26	Round 10 quick fixes (#106, #116–118) and the pause menu (#105) built.

v4.25	Playtest round 10 logged (§22, #105–118): pause menu with keybinds (replacing the start-up controls screen), no idle floating, crouch when not hugging cover, Elite squads +1 soldier, region 3 roads/rails to the map edge with rails over the roads; asset requests (sounds, barbed wire model, engineer weapon, crouch/idle animations). No code changes.

v4.24	First sound pass (owner's Pixabay clips: gunfire, zombie deaths, groans, screams; positional, volume button), shooting-while-moving and cover animations (#95), owner-set rifle fit via the rifle fitter.

v4.23	Round 9 fixes (#93, #96–#99) and the engineer build menu (#104) built.

v4.22	Playtest round 9 logged (§22, #93–104): rifle orientation, shooting animations, choppy long clips, tower climb time, 0% infestation with zombies alive, lower command cap; walking fix and real-hardware FPS confirmed; drone (recon only, 30 s fog-clearing orbit), Medic Team design, engineer build menu. No code changes.

v4.21	Longer sight (#86, #87): rifle 24 → 30 m, carbine 18 → 22 m, MG emplacement 22 → 35 m.

v4.20	Sound and a technical track added to the roadmap (§21 T1–T7): code split, map data format, chunked world, pre-baked animations, save/load moved up, real-hardware performance check, repo size. No code changes.

v4.19	Round 8 to-dos logged (§22, #85–92): longer sight for riflemen and MG emplacements, zombies roaming between districts and hitting outposts, police/fire station loot, civilians from house searches (introduced in region 3), an unlock-progress UI for the open world. Ranked into §21. No code changes.

v4.18	Character models replaced: riflemen and engineers (Military RTS Character 1) and female zombies rigged on Mixamo with Mixamo animations, real M4 rifle model.

v4.17	Tutorial region 3 (Rail Siding), the power system and the Med Bay built (§17, §21 Tier 1 #14–16).

v4.16	Round 7 fixes built (#76–84). Next up: tutorial region 3 with the power system.

v4.15	Playtest round 7 logged (§22, #76–84): both regions cleared first try. Round 7 fixes ranked next on the roadmap, ahead of region 3. No code changes.

v4.14	Round 6 fixes and the region 2 rework built: animation twitch, noise decay, zombie classes and pools, guaranteed Bloaters, MG field of fire, artillery locked, guard towers (introduced by region 2), region 2 difficulty step. Next up: tutorial region 3 with the power system.

v4.13	Zombie classes decided (§9): normal (Walker, Runner), medium (every other zombie type except bosses), boss. Normal and medium have separate spawn pools that together make up a district's total. MG field of fire (#71) and the region 2 difficulty plan (#74) approved.

v4.12	Playtest round 6 logged (§22, #66–74). Roadmap re-ranked: round 6 fixes first; region 2 gets a real difficulty step and a new feature (guard towers); region 3 introduces the power system, which unlocks the Med Bay; artillery becomes a later unlock; Last Stand tabled; replacing the cartoon character models moves up the visual track. No code changes.

v4.11	Tutorial region 2 built: Gas Station Strip (§17). Roadmap Tier 1 #10 done; next up is region 3.

v4.10	Playtest rounds 4–5 implemented except #54, #58, #64. §21 roadmap re-ranked: every open item (including parked playtest notes) is now in one ordered list, with done items marked. Uploaded models catalogued (§21 visual track).

v4.9	Round 5 design decisions recorded: one shared squad health pool (§5), three tutorial regions instead of seven (§17), medics keep their place in the roadmap, "Shriekers" in #59 meant Bloaters.

v4.8	Playtest round 5 logged (§22): 20 notes from a two-person playtest, with likely causes, proposed fixes and the design conflicts they raise. No code changes in this revision.

v4.7	Playtest round 4 logged (§22): 13 notes with likely causes and proposed fixes. No code changes in this revision.

v4.6	See-through buildings (any building hiding a squad, hive or build site fades out). Crowd navigation via shared flow fields (zombie sim \~30% cheaper; profiling says the sim isn't the bottleneck yet, so the Web Worker move is deferred until real-hardware tests say otherwise). Tutorial system + mission 1 script.

v4.5	Playtest round 3 (§22): continuous supply income (fixes outposts becoming unaffordable), Quonset barracks and roofed MG nest, tough base walls, full-length avenues, status badges, blood. Model-dependent notes parked.

v4.4	Playtest round 2 (§22): fixed hand-authored world layout confirmed (§2), engine/porting notes (§23), repair and resume building, Command Post support powers, shooter aggro, kill salvage, wider gunfire hearing, calmer hives, crowds of hundreds to thousands. Animated CC0 characters (Quaternius) with flipbook crowd rendering.

v4.3	Art direction: isometric first, pixel art dropped (only a loose influence). First procedural city pass: houses, apartments, motel, shops, warehouse, trees, streetlights, vehicles, painted roads. Optional glTF model overrides.

v4.2	Playtest feedback round 1 (§22): force-attack, middle-mouse camera rotation, rifle range, time-then-distance zombie aggro, HUD click fix, looser squads, weaker basic zombies, engineer deconstruction, car wheels, 12-minute days. Plus hive alarm and 3 s charge planting.

v4.1	§14 "Target look for the finished game" (art direction from reference images, scale, crowd tech, camera rotation). §16 adds the open production questions. MVP: gunfire is now heard well beyond sight.

Where earlier wording conflicts with a v4 rule, the v4 rule wins. Every v4 change is marked \[v4].

