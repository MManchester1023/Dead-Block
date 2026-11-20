22\. Playtest feedback log \[v4.2]

First hands-on playtest of the browser MVP (November 2026). Every note, and what was done about it.



\#	Note	Status

1	Zombies don't react to gunfire, only to sight	Fixed (v4.1). Hearing radius was below sight range. Gunfire is now heard \~73 m (rifle) to \~106 m (MG) and zombies path around buildings toward it.

2	Right-click a zombie to force units to attack it	Done. Forced target overrides threat priority (§5).

3	Rotate the camera with middle mouse held	Done. Middle-drag rotates freely; Q/E snap 90°; Shift + middle-drag pans.

4	Riflemen need a bit more range	Done. 18 → 24 m (carbines 14 → 18 m).

5	Zombie aggro should be time-based first, then distance-based; they give up too easily if you run	Done. 20 s hunt after losing sight, then a 60 m leash (§9).

6	UI buttons sometimes need several clicks; rotating sandbags only updates when the mouse moves	Fixed. The HUD re-rendered 8×/s and swallowed clicks; panels now only redraw when their content changes, and buttons act on press. The placement preview refreshes every frame.

7	Units are too stiff; they should move around a bit instead of a strict formation	Done. Loose, drifting, individually paced squad members (§5).

8	Normal zombies (walkers, runners, screamers) should be a bit weaker	Done. HP: Walker 45 → 36, Runner 28 → 22, Screamer 50 → 40.

9	Engineers should be able to deconstruct things they've built	Done. X / Deconstruct button; refunds per §6.

10	Static cars have no wheels	Fixed. Wheels (some flat), bumpers, head/tail lights.

11	Day/night cycle is really fast	Done. 12 real minutes per in-game day; daily supply income raised to match.

Balance after this round (scripted bots, 6 seeds): a careful "advance, let the wave come, clear, advance" push wins 6/6 with no losses, so careful play is now on the easy side for a starter zone. Blob-rushing the hive and the lone-sapper sprint both fail 6/6. Watch whether human play feels too safe; the knobs are walker HP, hive spawn rate and the alarm radius in config/balance.ts.



Round 2 \[v4.4]

\#	Note	Status

12	Map regions should be the same every time (no procedurally generated layouts)	Confirmed and written down (§2). The layout was already fixed; only building visuals are code-generated, seeded per building.

13	Similar games use C# in Unity; will this be easy to move over?	Answered in §23.

14	Engineers stop building if given an order mid-build	Done. The site keeps its progress; right-click it to resume; progress bar shows. (A new order still takes priority, as in most RTS games; Shift-queue to add orders after a build.)

15	Gunshots should be heard further still	Done. Rifle \~110 m (was \~73), MG \~160 m; cap 260 m.

16	Zombies should eventually reach overwhelming numbers: hundreds to thousands in places	First pass done. Crowd renderer handles thousands; cap 1,500; Overrun hives grow to 300; bigger late-stage pulses. Next: move the sim to a Web Worker and test on real hardware.

17	Engineers should repair built structures	Done (§6).

18	Boomers (Bloaters) don't aggro when shot, sometimes	Fixed. Zombies now turn on whoever shoots them.

19	Command structure clickable with power-ups	Done. Artillery Barrage and Supply Drop; air call-ins shown locked (§6).

20	Hives spawn zombies far too often	Done. Spawn interval roughly doubled at every stage, smaller groups; big hordes come from pulses instead.

21	A little money and supplies per kill	Done (§11).

23\. Engine, platform and porting \[v4.4]

Question: similar games are built in C# with Unity (or similar engines). Will this be easy to move over?



Honest answer: the game's logic will move over fairly easily; the visuals and UI will be rebuilt, not moved.



Simulation (easy to port). All the rules (combat, targeting, zombies, hives, noise, economy, orders, districts) live in src/sim/ and src/config/. They're plain TypeScript with no browser or graphics code in them, deterministic, and covered by tests. TypeScript and C# are close cousins; this code translates almost line by line, and the tests translate with it (they become the proof the port behaves the same). Config tables become JSON or ScriptableObjects. Roughly \~3,000 lines today.

Assets (port as-is). Characters are standard FBX; Unity imports them directly. The procedural buildings and props would either be re-implemented as an editor script or exported once to models.

Rendering, input and UI (rebuild). Three.js and the HTML HUD don't exist in Unity. These get rebuilt with Unity's renderer, its input system and its UI toolkit. This is the bulk of a port, and it's also where Unity would help: lighting, shadows, particles, animation blending and big crowds (ECS/DOTS, GPU instancing) are its strengths.

What keeps it portable: the strict rule that the sim never touches rendering, all numbers in config, the event bus between sim and presentation, and tests on the sim. Keep following these.

When to decide. Stay in the browser while the core is being found (fast iteration, nothing to install, easy to share). The real trigger is the crowd target: if thousands of zombies plus lighting and effects can't hold a steady frame rate on mid-range hardware after moving the sim to a Web Worker, that's the point to port. A middle option, if the only goal is "a desktop app", is wrapping the browser build (Electron/Tauri) with no port at all.



Round 3 \[v4.5]

\#	Note	Status

22	Infantry idle movement should be more realistic	Waiting on better 3D models (needs richer idle/look-around/fidget animations than the current pack has).

23	Engineers should play a building animation while erecting structures	Waiting on better 3D models. Currently they use the pack's "pick up" animation as a stand-in.

24	MG emplacement model is missing its roof	Done. Sandbag ring with a rear entrance, corrugated roof on posts, bags on top.

25	Units in cover should look like they're in cover (leaning against it)	Open. Needs crouch/lean-on-cover poses (also benefits from better models); positioning members along the cover edge can come first.

26	Zombies should bleed when shot and when dying	Done. Droplet sprays thrown away from the shooter on every hit; a dark pool spreads under each body and dries over \~45 s.

27	Still not getting supplies from kills; after building a few things you can't afford an outpost	Fixed. Kills did pay (0.5 supplies per Walker), but too little to notice. The real cause: v4.2 made days 12 min long while supply income only arrived at day's end, so for the first 12 minutes almost no supplies came in. Now supplies trickle in continuously (+9/min base, +5/min per secured district), Walkers/Runners salvage 1 supply each, and the top bar shows income rates. Upkeep is still paid once per day.

28	Barracks model is only half rendered	Fixed. The Quonset hut was rotated half underground; rebuilt with ribs, door and windows.

29	Concrete main-base walls should have a lot of health	Done. 3,000 → 15,000 HP per section.

30	The text saying what a unit is actively doing should be more obvious	Done. A coloured status badge (MOVING, ENGAGING, BUILDING, IN COVER · FIRING, PLANTING CHARGE…) on each unit card and above each squad in the world; blue = moving, orange = fighting, yellow = working.

31	Not all roads in the test level go to the edge of the map	Fixed. Both avenues now run the full height of the map.

Round 4 \[v4.7] (logged, not started)

\#	Note	Likely cause (from the code)	Proposed fix

32	The hive is now a bit slow and zombies don't spawn enough; you can drag most of the motel's zombies to the base just by shooting at the entrance	Two v4.4/v4.5 changes stacked: hive spawn intervals were roughly doubled, and gunfire is now heard \~110 m, so a few shots at the gate pull nearly the whole district into a kill zone. The starting population (\~45) is finite and the young hive refills it slowly.	Bring hive output partway back up (especially stage 1–2), let a hive "reinforce" faster when its district population drops, and make the response to distant noise partial: louder/closer sounds pull more, a share of zombies stay put or guard the hive. Re-run the balance probes with a "shoot from the gate" bot.

33	Soldier and zombie animations are very twitchy at the arms and legs	The flipbook has few poses per clip (walk 10, idle 6, shoot 4), so limbs snap between poses; the zombie mesh simplification runs separately on every pose, so vertices shift slightly between frames and shimmer.	More poses per clip (walk \~20), blend between neighbouring poses in the vertex shader, and simplify once on the rest pose (then reuse that mapping for every frame) so the mesh is identical frame to frame.

34	Dead zombies stay standing	The pack has no fall-over death animation; the "Defeat" clip used for death ends standing/slumped.	Procedural death: tip the body over onto the ground over \~0.5 s (rotate the corpse instance), then lie flat; optionally blend the last Defeat pose.

35	Health bars shouldn't float over everything; only show when hovering with the mouse	Squad pips, hive bars and structure bars are always drawn.	Show world-space bars only on hover (and for the current selection). Keep the unit cards as the always-on readout.

36	Set the Barracks rally point by clicking the Barracks and choosing it from a Barracks menu	Rally point is fixed in the map data; the Barracks isn't selectable.	Make the Barracks selectable (like the Command Post) with a panel: production queue plus "Set rally point" → click the map. Show the rally flag in the world.

37	Airdrops: a C-130's shadow should fly over before the crate starts falling	Crate currently just appears and parachutes down on the green smoke.	Before the drop, a large aircraft shadow (and engine audio later) sweeps across the map along a line through the smoke; the crate releases as it passes overhead. Reuse the same flyover for the other air call-ins.

38	The UI takes up a lot of the screen; add a UI scaling option	Fixed pixel sizes; no settings menu.	Settings menu with UI scale (e.g. 75–125%), plus collapsible panels (radio, roster, objectives).

39	Should be able to select a unit by clicking its name	The name labels over squads in the world ignore the mouse; only the Forces panel chips are clickable.	Make the in-world name labels clickable (select; double-click to centre the camera), and let clicking a unit card in a multi-selection narrow the selection to that unit.

40	Infestation stuck at 5% with no zombies and no hive	Infestation only drops per kill. If the last zombies die from causes that don't count, or the starting infestation is higher than the zombies can "pay off", the meter can't reach 0 with nothing left to kill.	When a district has no hive, infestation should track what's actually there: decay to 0 when no zombies remain (and generally be derived from the live population plus hive state). Add a test that a cleared, hive-free district reaches 0%.

41	Road shouldn't be visible under the main base	The ground painter lays the main road and its sidewalks across the whole map width before the base concrete is painted, and only rows 34–37 inside the base get repainted; the sidewalk rows and the strip west of the base still show road.	Stop the road and sidewalks at the base wall (the road should end at the gate), and paint the base footprint last.

42	Orientation arrows on building placement ghosts	The ghost is a plain box.	Draw an arrow on the ghost showing which way the structure faces (the side squads take cover on, the MG's field of fire), updated live with R.

43	Noise meter goes up and immediately back down; it should build for a set time before deteriorating. Clarified: the rise is fine, it just falls too quickly. It should go up, hold for a bit, then fall.	District noise decays at a constant 4/s every tick, so it drains as fast as it fills between volleys.	Keep the current rise. Add a hold: after the last sound the meter stays at its level for \~10–15 s, then decays (more gently than today's 4/s). Sustained fighting then actually builds it up, which matches the doc ("fill it and the whole district comes").

44	Move the camera with WASD; move conflicting keybinds to Ctrl+ versions	A (attack-move) and S (stop) are single letters; W and D are free.	WASD pans the camera. Attack-move → Ctrl+A, Stop → Ctrl+S (both can be intercepted in the browser). Browser caveat: Ctrl+W closes the tab and can't be overridden by a web page, so nothing should ever be bound to Ctrl+W, and a desktop build would lift that limit.

Round 5 \[v4.8] (logged, not started; two testers)

\#	Note	Likely cause / current state	Proposed fix

45	Separate Skip step and Skip tutorial buttons	Both buttons today ("Skip tutorial" on the prompt, "Skip" on the banner) end the whole tutorial.	Two buttons on both the prompt and the banner: Skip step (marks the current step done, moves on) and Skip tutorial (ends it, asks to confirm).

46	Units can search houses for a small amount of supplies sometimes; takes 5 s	Not in the game. Buildings are scenery only.	New order: right-click a house with a squad → it stands at the door for 5 s (interrupted if attacked) → a random small supply reward, or nothing. Each house can be searched once; searched houses get a marker. Searching is mildly noisy. Ties into the doc's "zombies come out of buildings" (#64): a search can sometimes flush a few out.

47	Barracks options (recruiting) should only pop up when you click the Barracks	The production panel is always on screen.	Make the Barracks a selectable building (same pattern as the Command Post). Its panel holds recruiting, the queue, and the rally point from #36.

48	No passive healing; only medics or a med bay heal	There's no regen code. What looks like healing is probably levelling up: a promotion raises max HP and adds the difference to current HP.	Promotions raise max HP only; current HP stays put. Healing comes only from the Medic Team (already in the roster, doc §6) and a new Med Bay base structure (squads standing in it heal over time, costs supplies). Medics / Med Bay need to come forward in the roadmap, or the starter zones have no way to heal at all.

49	Barbed wire should slow zombies and infantry	Wire only slows zombies (slow: 0.35 applied in zombie movement only).	Apply the slow to every infantry unit too (including yours). Vehicles crush it later. Players have to plan their own lanes through it.

50	Infantry health should be one squad health bar, not per soldier	Each member has their own HP and dies individually (doc §5).	Design change: one health pool per squad. Members still drop visually at thresholds (a 4-man squad loses a soldier at 75/50/25%) so the squad's firepower still shrinks as it's hurt, and reaching 0 is still a permanent wipe. Doc §5 needs rewriting to match.

51	Pulses come too often in the easy stages	Pulses fire every 240 s from the 8-minute mark regardless of hive stage.	Scale the pulse interval by hive stage and zone difficulty, e.g. stage 1 \~6 min, stage 2 \~4.5 min, stage 3–4 \~3 min, and push the first pulse later on tutorial maps.

52	Zombies shouldn't go for structures while there are units nearby	A zombie that runs into a structure on its way locks onto it and keeps scratching; units are only preferred when within its acquisition check.	Units within \~15 m always win over structures; a zombie scratching a wall re-checks every second and leaves it the moment a soldier is in reach. Structures are a fallback target only.

53	Cap how many mid-tier zombies a region can have at once	Only a global cap (1,500) and per-hive local caps exist; specials are a share of each spawn.	Per-district caps per type, e.g. Runners and Bloaters ≤ 10% of the district's zombies (and a hard number per zone difficulty). Hives roll a Walker instead when the cap is hit.

54	Buildable guard towers	Not in the game (doc has rooftops/garrisons as a later tier).	New engineer structure: a tall tower a squad can garrison for extra range and line of sight over cars and walls. Zombies can't climb it but can tear the base down. Reuses the garrisonedIn hook that's already there for rooftops.

55	Disband units: they run into the Barracks and disappear	Not in the game.	"Disband" button on a selected squad → it walks to the Barracks and despawns, freeing its command points and upkeep, with a partial refund. Cancelled if the squad is ordered elsewhere.

56	Allow more than 8 squads; a level 4 hive is overwhelming	Command cap is 8.	Raise the starting cap (e.g. 12) and let it grow with secured districts (doc §11's cap mechanic). Combined with #51/#57/#61, so the starter zones are beatable without needing a huge army.

57	Hive stage 3+ spawns far too often for beginner levels	Spawn intervals are 18/11/7/4 s for stages 1–4 on every map.	Hive output scales with the zone's difficulty tier. Tutorial zones get a much gentler stage 3–4 (e.g. 12 s / 9 s), and maybe tutorial hives only reach stage 2–3 at most.

58	Tutorial = two small maps and then one big map, ramping up; finishing one region attaches the next to HQ so you can travel there	The doc currently says seven tutorial missions (§17: three 64 × 64 zones plus two larger maps). Only Roadside Motel is built.	Design change: three tutorial regions: small → small → big, each harder. Clearing region 1 opens a road from HQ to region 2; clearing region 2 opens the big one. The world stays one continuous city (doc §2), and each new region is added beside the existing map, not loaded as a separate level. §17–18 need rewriting from seven missions to three.

59	Walkers, Runners and Shriekers (clarified: Bloaters) should be easier to kill and fewer on the easy maps	Walker 36 HP, Runner 22 HP, Bloater 120 HP, the same on every map.	Per-zone difficulty scaling: tutorial zones get lower zombie HP (\~70%) and lower spawn counts, rising map by map. One table of difficulty tiers instead of per-map tweaks.

60	Zombies should go for HQ buildings before walls	Walls block the way, so zombies scratch at them; the base wall is excluded from target picking, but whatever's physically in the way gets attacked.	When a pulse targets the base, zombies path around walls to the gate and go for the Command Post and Barracks; they only attack walls they're stuck against for a while (or the gate). This also makes defending the gate matter.

61	Only engineers can build	The build buttons only act on the engineers in a selection, but they still show when a mixed selection is picked.	Show build buttons and hotkeys only when the selection is engineers only, and send all build orders through engineers.

62	Remove the radio panel but keep all the dialogue for when audio is added	The radio panel shows every line as text.	Hide the panel. Keep the Radio system and every line in place, firing events with nothing displayed, ready for voice audio. Important messages (hive spotted, outpost lost) move to brief toasts.

63	MG emplacements should cost more	$80 + 25▣.	Raise to about $140 + 45▣, and maybe a higher command cap or a limit per district. Re-check the economy probe afterwards.

64	Vehicles can be overrun by piled-up zombies; the crew dies, leaving an empty vehicle another squad can crew. Recovered vehicles start at half health and need repair	Vehicles aren't in the MVP (Tier 2).	Add to the vehicle design (doc §6/§21): zombie pile-ups on a vehicle (N zombies touching it for a few seconds) kill the crew, and the empty hull stays on the map. An infantry squad can board it to become the new crew; it starts at 50% HP and engineers can repair it.

65	Zombies can sometimes come out of buildings	Buildings are solid scenery; zombies only come from hives and the starting population.	Some buildings act as small "nests": a few zombies spill out of a door when units get close or make noise nearby, once or on a timer. Pairs with house searching (#46).

Design decisions (v4.9):



\#50 — DECIDED: one shared squad health pool; soldiers drop out at thresholds (75/50/25% for 4 members). This was the original intent; §5 updated.

\#58 — DECIDED: three tutorial regions (small, small, big), each attached to the map when the previous one is cleared; §17 rewritten.

\#48 — DECIDED: medics and the Med Bay stay where they are in the roadmap. No passive healing, and promotions stop topping up HP.

\#59 — CLARIFIED: "Shriekers" meant Bloaters. The note is about Walkers, Runners and Bloaters being easier and fewer on the easy maps.

Grouping for when coding starts: (a) difficulty pass: #51, #53, #56, #57, #59, #63 plus round 4 #32/#43; (b) zombie targeting: #52, #60; (c) UI: #45, #47, #61, #62 plus round 4 UI items; (d) rules: #48, #49, #50, #55; (e) new content: #46, #54, #58, #64, #65.



Status after v4.10 (rounds 4 and 5)

Done: #32 hive output and gate lure · #33 smoother animation · #34 corpses fall · #35 hover-only health bars · #36 Barracks rally point · #37 cargo-plane flyover · #38 UI scale · #39 clickable names · #40 infestation stuck · #41 road under the base · #42 ghost arrows (structures have no front, so it's a wall-direction arrow plus the MG's range ring) · #43 noise hold · #44 WASD (attack-move/stop → Ctrl+A/Ctrl+S) · #45 skip step / skip tutorial · #46 house searching · #47 Barracks menu · #48 no heal on promotion · #49 wire slows soldiers · #50 shared squad health · #51 pulse timing · #52 units before structures · #53 Runner/Bloater cap · #55 disband · #56 command cap 16 (+4 per secured district) · #57 calmer late hives on easy maps · #59 weaker/fewer zombies on easy maps · #60 HQ before walls · #61 engineers-only building · #62 radio hidden (lines kept for audio) · #63 MG cost · #65 zombies holed up in buildings



Open, on the roadmap (§21): #58 tutorial regions 2 and 3 → Tier 1 #10–11 · #54 guard towers → Tier 1 #13 · #64 vehicle overrun → Tier 2 #21 · parked #22, #23, #25 → visual track



Balance after v4.10 (scripted bots, 6 seeds, tutorial tier): careful advancing wins 5–6/6 with no losses; charging straight in wins 1–2/6 with heavy losses.



Round 6 \[v4.12] (logged, not started)

\#	Note	Likely cause (from the code)	Proposed fix

66	Replace the big-headed zombie, the rifleman and the engineer with new models	They're the cartoon Quaternius models; only the main zombie was swapped (v4.10).	Top of the visual track (§21 V3.2). Needs animated replacements: Mixamo is the practical source, since none of the uploaded soldier models have animations. See §21 for the clips each one needs.

67	Zombie and infantry arms still jump up and down rapidly, about every second	Two causes. (a) Soldiers: a rifleman fires every 0.9 s, but the shooting pose is only shown for 0.7 s after each shot, so the arms flip between the aim pose and idle about once a second. (b) Everyone: the walk/run speed multiplies a global animation clock that keeps counting up for the whole session, so any small change in speed (every frame, from noisy velocity) jumps the animation to a completely different frame.	(a) Stay in the aim/shoot pose while the squad has a target, with the recoil as a small part of the loop, not the whole pose. (b) Give each character its own animation phase that advances by dt × speed factor, so changing speed changes the tempo smoothly and never jumps. Also blend between neighbouring poses.

68	The final, large tutorial map should introduce the power system, which is how the player unlocks the Med Bay	Power stations are Tier 1 #17 and not built; the Med Bay doesn't exist.	Design decision, recorded in §17 and §21. Region 3 introduces power: restore its power station and the Med Bay unlocks at the base.

69	Table Last Stand mode (§21 #28) for now	—	Done in the doc: taken off the roadmap and marked tabled; §13 keeps the design for later.

70	Haven't seen any Bloaters in region 1 recently	The motel's starting mix is only 3% Bloaters (about 1 in a starting crowd of \~39), the stage-1 hive rolls a Bloater 2% of the time, and the tutorial cap on Runners + Bloaters (about 5 at once) is mostly used up by Runners. Bloaters are also now drawn as a scaled-up version of the new zombie model, which may not read as a Bloater at a glance.	Guarantee a few in region 1 (e.g. 2–3 placed in the starting crowd), give Bloaters their own share of the cap so Runners can't crowd them out, and make them unmistakable visually (much fatter, sickly colour, maybe a dedicated model).

71	The MG still has no arrow showing its front on the placement ghost	The MG nest is square, and the turret currently turns a full 360°, so it has no front; the v4.10 ghost arrow only appears on long walls.	Design change: give the MG emplacement a field of fire (e.g. a 120° arc) that you aim with R while placing, shown on the ghost as an arrow plus the arc (instead of a full circle). The nest only engages inside its arc, so placement matters and flanks matter.

72	Noise should start to go down slowly after about 3 seconds; it stays up for a long time	v4.9 set the hold to 12 s (for #43, "it falls too quickly").	Hold 3 s, then drain slowly (≈1–1.5 per second instead of 2.5). Together that keeps sustained fights filling the meter, but quiet comes back sooner.

73	Artillery should be a later unlock	The Command Post barrage has been available from the start since v4.4 (playtest convenience).	Lock it until the Artillery tier (§21 Tier 2 #27). During the tutorial the Command Post shows it as locked with its unlock condition; the Supply Drop stays available.

74	No real difficulty step in region 2, and it didn't introduce anything new	The Easy tier only nudges the numbers (zombie HP 70% → 85%, a busier hive), while the player arrives stronger: more squads, the +4 command cap from securing the motel, motel income and veteran squads. Nothing new is taught there.	Difficulty: a bigger step than the numbers alone. Larger starting crowd, the hive starts at stage 2, early Runner packs (doc §2 has Runner packs as the next threat), and pulses that target the player's new motel outpost so holding ground matters. New feature: region 2 introduces guard towers (#54, §21 Tier 1 #12), with a short tutorial prompt when the region opens. Re-run the bot balance test with the player's realistic post-motel force.

Decisions after round 6 \[v4.13]:



\#	Note	Decision

75	Walkers and Runners are normal zombies; every other zombie type except the planned bosses is a medium zombie. Normal and medium zombies have separate spawn pools that both contribute to the total pool	Decided (§9). Each district's population cap is split into a normal pool and a medium pool; a hive fills each pool on its own, and the two together are the district's total. Runners no longer compete with Bloaters for room. Bosses stay outside both pools.

71	MG field of fire with a ghost arrow	Approved as proposed: a 120° arc aimed with R while placing.

74	Region 2 difficulty plan	Approved as proposed: bigger starting crowd, hive starts at stage 2, early Runner packs, pulses at the motel outpost, and guard towers as region 2's new feature.

Status after v4.14 (round 6): done: #67 animation twitch (per-character animation clocks; soldiers hold the firing pose while engaged) · #70 Bloaters (at least 3 in region 1's starting crowd, own spawn pool, drawn wider and sickly green) · #71 MG 120° field of fire, aimed with R, arrow + arc on the ghost · #72 noise holds 3 s then drains at 1.25/s · #73 artillery locked until the Artillery tier · #74 region 2 rework + guard towers · #75 normal/medium spawn pools. Open: #66 new character models (needs Mixamo-animated replacements, §21 V3.2) · #68 power system in region 3 (§21 Tier 1 #14–16).



Round 7 \[v4.15] (logged, not started)

Both tutorial regions cleared on the first try.



\#	Note	Likely cause (from the code)	Proposed fix

76	Gunfire should only be heard about 60 m away	Hearing is 50 m per loudness point: a rifle (2.2) carries \~110 m, an MG (3.2) \~160 m (set in v4.4 when shots weren't drawing enough).	Rifle → \~60 m: about 27 m per loudness point, so carbine \~50 m, MG \~85 m, explosions further. Re-check the bot balance runs, since fights will draw smaller crowds.

77	Unlocking the second region shouldn't aggro the zombies	When the region opens, its crowd is placed anywhere from 12 m inside the fence, which is exactly where the player's squads wait, so some start within sight and charge. Rifle fire heard \~110 m away (#76) then pulls in the rest.	Seed the new region's crowd away from the opened border (nothing within \~50 m of it, none in sight of a squad), start them idle, and give the region a short grace period before noise counts. The 60 m hearing (#76) helps too.

78	The arm fix applies to some members of a squad but not all	Same root cause as #79–80 (below): soldiers shuffling around their spot in the squad keep crossing the "walking" speed threshold, so they flip between walk and aim/idle.	Fixed by #79–80; plus hysteresis (start walking above \~0.6 m/s, stop below \~0.3 m/s) so idle shuffling never counts as walking.

79	The newer zombie model still has arm spasms when walking	Bug (v4.13): the game draws \~60 frames a second but the simulation steps 30 times a second. On frames with no sim step, the speed check sees zero movement and switches the character to idle, then back to walking on the next frame, and each switch restarts the animation. So every walker flips walk ↔ idle about 30 times a second.	Keep each character's last measured speed on frames without a sim step and smooth it; never restart the animation clock on a brief switch (only on a real change of action, e.g. walk → attack); hysteresis as in #78.

80	All arms spasm when walking	Same as #79.	Same as #79.

81	With a group selected, ordering them into cover only gets one squad into cover	Several squads ordered behind one car are spread 4 m apart along it, but "in cover" requires being within 4.5 m of the car's centre, so only the middle squad qualifies.	Give each squad its own cover: the first gets the clicked car, the others the next-nearest cars/sandbags on the same side (within \~15 m); if there isn't enough cover, the rest line up as close as possible and the toast says so.

82	No parachute shadow during the supply drop	The crate casts a shadow but the parachute doesn't; at height, the crate's small shadow lands far off to the side.	Let the parachute cast a shadow, and add a soft shadow disc on the ground under the crate that sharpens as it comes down.

83	Infantry should pathfind around Bloater (boomer) gas clouds	Clouds only damage; squad pathfinding doesn't know they exist.	Clouds make their cells expensive for squad pathfinding while they last (route around if possible), and squads standing in a fresh cloud with no orders step out of it.

84	Clicking a squad's status (under its name) should select it too	Only the name text is a click target (v4.9 #39).	Make the whole label (name, status and bar) the click target.

Status after v4.16 (round 7): all done. #76 rifle heard \~60 m (carbine \~49, MG \~87) · #77 a newly opened region seeds its dead ≥50 m from the cut fence and ≥40 m from any squad, and ignores gunfire further than 25 m for its first 30 s · #78–80 animation: speed is only measured on frames where the sim stepped, then smoothed, and walking starts/stops at separate thresholds (shuffling in place never counts as walking). Verified in code and tests; the headless test browser runs too slowly to reproduce the 60 fps flicker, so confirm in the next playtest · #81 group cover: each squad gets its own spot, two squads per car, three per sandbag wall, from cover within 25 m; holding squads can stand closer together so they don't shove each other out of cover · #82 the parachute casts a shadow, plus a soft shadow disc under the falling crate · #83 squads path around Bloater gas (expensive cells, re-plan when clouds appear/clear) and idle squads step out of fresh gas · #84 the whole squad label (name, status, bar) selects it.



Round 8 \[v4.19] (to-dos from the owner, not playtest-driven; logged, not started)

\#	Note	Current state (from the code)	Proposed approach

85	The Med Bay shouldn't build itself: it should unlock, then be bought, built and placed	Already works this way. Restoring power only unlocks it; engineers then buy and place it inside the base (N, $150 · 40▣) and build it like any structure. (A test screenshot showed one placed by the test script.)	Confirm in the playtest; nothing to change unless it behaves otherwise.

86	Riflemen should see a little further	Squads acquire targets within their weapon range: rifle 24 m, carbine 18 m (engineers). There's no separate sight radius for squads yet.	Rifle 24 → \~30 m (carbine 18 → \~22 m). Later, with fog of war, a sight radius separate from weapon range.

87	MG emplacements should see a decent bit further	MG nest range 22 m (within its 120° arc).	22 → \~35 m, keeping the arc. It becomes the long-reach anchor of a defence line.

88	Zombies should wander between zones and attack outposts, so outposts and regions need fortifying and maintaining, especially once the world opens	Idle zombies only wander \~14 m around their home hive; horde pulses already go for the nearest outpost. Secured districts with no hive stay empty.	Roaming groups that drift between neighbouring districts (more often from districts with hives), sometimes in a secured district's direction; anything that finds an outpost attacks it. Secured districts slowly gain a little infestation from roamers that aren't killed, so a district has to be held, not just taken. Tune so a fortified outpost (sandbags, MG, tower) holds against roamers without the player babysitting it. ✔ v4.29: packs per difficulty tier (none in the tutorial region), 60% at an outpost; contested districts lose income; outposts got an all-round garrison so strays alone can't take one.

89	Police station: loot to find a decent amount of supplies	Not on the map. Building searches give 4–12 supplies.	A police station landmark building (open world, or one of the remaining starter districts): searching it takes longer (\~15 s) and gives a large one-time haul (e.g. 40–60 supplies, some money); it may be guarded by a nest.

90	Fire station: loot to find a decent amount of supplies	"Fire Station" is in the doc's starter list (§2) but not built.	Same as #89: a landmark building with a big one-time haul.

91	Searching houses can sometimes find civilians. They're controllable, and you earn money and supplies for getting them back to the main HQ building. Introduced in tutorial region 3	Civilians are Tier 4 #36 (not built); house search gives supplies, money, nothing, or a nest.	Region 3 onward: a search can turn up a small civilian group (a new unit type: no weapon, slow, a small health pool, the dead love them). Walk them to the Command Post to "evacuate" them for money + supplies. Introduced with a briefing in region 3. Later: civilians can also be recruited as Guerrillas (§10). ✔ v4.28 (Guerrillas still to come).

92	Once the world opens, the UI needs to show what's left to unlock	No such panel; unlocks happen silently plus a briefing card.	An "Unlocks" panel (e.g. on the ops map or a button in the top bar) listing what's unlocked and what's still locked, and how to get each (power station X, secure district Y, …), driven by the same data that gates them.

Round 9 \[v4.22] (playtest of region 3 + design notes; logged, not started)

\#	Note	Likely cause / current state (from the code)	Proposed fix

93	The M4s are sideways in the hand; otherwise right	When fitting the rifle model to the hand, the barrel and magazine axes are right but it's rolled 90° around the barrel.	Roll it 90° around the barrel axis (one rotation in the rifle setup); check idle, walk and firing.

94	Walking looks OK	Confirms the round 7 animation fix (#79) at real frame rates.	✔ Done.

95	Need a shooting animation, and shooting while moving	Firing uses Mixamo "Firing Rifle", a 0.25 s single shot; squads that move while engaged play the plain walk.	Owner downloads two Mixamo clips on the soldier: a longer firing loop (e.g. "Firing Rifle" variants / "Shooting") and a walk while aiming/shooting (e.g. "Walking While Shooting" / rifle walk with the gun up). The renderer then plays the moving-and-shooting clip when a squad is both moving and engaged.

96	Female zombie idle and dying look choppy, and so does the engineer building animation	Cause: every clip is sampled with a fixed number of poses whatever its length: female zombie idle 4 s / 12 poses ≈ 3 poses a second, death 3.7 s / 14 ≈ 4, engineer "Working On Device" 6.4 s / 10 ≈ 1.6.	Sample by length instead: \~10–12 poses per second of animation, with a cap for very long clips (and trim long idles to their best loop). Memory cost is modest at crowd LOD.

97	Getting in and out of a guard tower should take 2 seconds	Climbing in/out is instant.	2 s to climb up and 2 s to climb down (the squad can't shoot or move during it, status "CLIMBING").

98	A region shows 0% infestation while zombies are still alive in it	Once the hive is dead, every kill still subtracts from infestation, so it can reach 0 while zombies that wandered in, came out of buildings or were spawned by pulses are still there. (The v4.9 fix only stops it sitting above what's left.)	With no hive, infestation can't go below what's still alive: at least 1% while any zombie remains in the district, so "cleared" (and the outpost) really means empty.

99	The command cap should be a little lower	16 to start, +4 per secured district (v4.9).	14 to start, +3 per secured district; re-check the region bot runs.

100	FPS fine with a lot of zombies	First real-hardware performance check (T1).	✔ Done; no Web Worker needed for now.

101	Only recon units can deploy the drone	Drone and recon are planned (fog of war, §21); not built.	Design decision: the drone is a Recon Pair ability, not a Command Post call-in. Recorded for the fog-of-war/recon item.

102	The drone circles for 30 seconds, clearing fog of war in a circle where it's placed	Not built.	Recon squad uses the ability on a point → the drone flies there and orbits for 30 s, revealing a circle of fog (radius to tune, \~40–50 m); then it's gone, with a cooldown.

103	Medic Team: pistols/short-range weapons, plus a healing ability with a cooldown that has to be selected to use	✔ v4.61 (STATUS #20). Was: the Medic Team existed only as roster data (§6).	Pistols (\~15 m, weak). Heal is an active ability: select the medics, press the ability (or its button), click a squad in range → it heals a chunk of that squad's health (and can bring a fallen soldier back), then a cooldown. No passive healing, consistent with #48.

104	The engineer building menu should pop up in the bottom middle showing what they can build	Build buttons sit in the left-hand selection panel with the squad cards.	When engineers are selected, a build bar appears bottom-centre: one button per structure with its icon, hotkey and cost, greyed out when unaffordable or locked (with the reason).

Status after v4.23 (round 9): done: #93 rifle rolled 90° (magazine down) · #96 clips sampled by length (10 poses per second of animation, max 48), with soldier poses kept indexed and colours shared across poses (all crowds \~99 MB, down from 241 MB on the first attempt) · #97 2 s to climb up/down a tower (no moving or shooting; CLIMBING status) · #98 with no hive, infestation can't reach 0% or count as cleared while any zombie is alive in the district · #99 command cap 14, +3 per secured district · #104 engineer build bar bottom-centre: icon, hotkey, cost; locked items show how to unlock them; the squad panel narrows while it's open. Open: #95 shooting animations (needs two Mixamo clips), #101–103 drone/recon and Medic Team (with fog of war and the Medic Team items).



Round 10 \[v4.25] (playtest + ideas; logged, not started)

\#	Note	Current state (from the code)	Proposed fix	Needs from owner

105	Pause menu with a Resume button and a keybinds page, so the controls screen at the start can go	Space pauses with no menu; the start screen lists all the controls.	Esc (when nothing else to cancel) or a top-bar button opens a pause menu: Resume, Controls (all keybinds, grouped), Settings (sound, UI scale), Restart. The start screen keeps only the briefing and the Deploy buttons.	—

106	Units need to stop floating around until there's an idle animation	Resting soldiers drift up to \~1.3 m around their spot by design (v4.2 "less stiff"), but with a still idle pose it reads as gliding.	Resting soldiers stand still (no drift) until a real idle-shuffle animation arrives; moving formations keep their looseness.	An idle animation with small weight shifts (later)

107	A soldier more than half the cover distance away from the cover plays a crouch instead of the cover pose	Every soldier of a squad in cover plays "Taking Cover Idle", which leans on the cover even when the soldier is metres away from it.	Per soldier: within half the cover distance (≈2.25 m of a car, half the reach for walls) → cover pose; further out → crouch.	A rifle crouch idle (Mixamo "Rifle Crouch Idle" / "Crouch Idle") ✔ v4.27: Mixamo "Idle Crouching Aiming"; leans on the cover within \~1.1 m of a car / 1.5 m of sandbags, crouches further out.

108	Bloater (boomer) death: wet explosion sound	No sound yet.	Play it on Bloater deaths (with the gas cloud).	A wet burst / splat sound ✔ v4.27: plastic pop layered over a gore rip (your suggestion).

109	Demo charge: explosion sound	No sound yet.	On every explosion (charges, and artillery later), louder for bigger blasts.	An explosion sound ✔ v4.27: satchel charge clip on every non-toxic explosion, louder for bigger blasts.

110	Hive: wet death noise	No sound yet.	When a hive is destroyed.	A wet, organic collapse sound ✔ v4.39: wet mud explosion

111	Building sound	No sound yet.	Looping hammering/sandbag sounds while engineers build or repair.	A building/hammering loop ✔ v4.38: three construction recordings layered into one loop

112	Power station turning on: sound	No sound yet.	When power is restored (a big electrical hum spin-up).	A power-on / generator start sound ✔ v4.41: owner's recording

113	Cargo drop: plane fly-by, parachute and crate landing sounds	Flyover is visual only.	Fly-by as the shadow passes, a parachute flutter as the crate falls, a thud on landing.	Plane fly-by, parachute, crate thud ✔ v4.39: jet fly-by + parachute; v4.41: crate thud

114	Engineers need a different gun model and sound	Engineers carry the M4 and fire the rifle sound.	A carbine/SMG model with its own fit file (the rifle fitter can handle any weapon) and a lighter gunshot.	An SMG/carbine model + its sound ✔ v4.27: the engineer model's own SCAR + your carbine sound.

115	New barbed wire model	Barbed wire is a simple procedural mesh.	Swap in the model.	A barbed wire / razor wire model ✔ v4.39: CliffUnderside (Sketchfab, CC BY 4.0), simplified

116	Roads and railroads in region 3 don't reach the edge of the map	Region 3's main road and rail start at x = 114 m (the region's west edge), not the map edge.	Run both to the west map edge (through the fence line, which gets barriers across them like the other crossings).	—

117	In region 3 the railroad should go on top of the roads	At the level crossings the rail is skipped where it meets a road.	Draw the rails across the road at crossings (the road stays drivable).	—

118	Elite squads get +1 soldier	Elite only adds health and damage (same as Veteran).	On reaching Elite, the squad gains a fifth soldier (and the pool grows by one soldier's share).	—

Status after v4.26 (round 10): done: #105 pause menu (Esc backs out one step at a time: menu → mode → selection → opens the menu; Resume restores the previous paused state; Controls lists every keybind; Settings: sound, UI size; Restart asks first; start screen keeps the briefing and field notes only) · #106 resting soldiers stand still · #116 region 3 road and rail to the map edge · #117 rails drawn over roads at crossings · #118 Elite squads gain a fifth soldier (with one soldier's share of health). Waiting on assets: #107–115 (see the table above).



Round 11 \[v4.33] (playtest; bugs and tweaks done in v4.34)

\#	Note	Current state (from the code)	Proposed fix	Needs from owner

119	Crouching and leaning in cover works	Round 10 #107 (v4.27): soldiers lean on the cover when close, crouch further out.	✔ Confirmed, nothing to do.	—

120	Allow an outpost at 1–2% infestation; the player sometimes gets stuck at 1%. Zombies still hidden in houses shouldn't count.	Outposts need exactly 0% (commands.ts). Once the hives are dead, infestation drains to what's still walking in the district, but it is held at 1% while even one zombie is alive inside the district's rectangle. Zombies still hidden in houses already don't count, so the stuck 1% is almost certainly one or two stragglers you can't find: stuck on scenery, in a corner, or arriving with a roaming pack. (A guess: I haven't caught it happening.)	Allow an outpost at ≤ 2% once every hive in the district is dead (the radio line and objective say "≤ 2%"). Any dead left inside then make the district CONTESTED, which already handles stragglers. Also show "N dead left" in the district panel so a straggler can be hunted down.	Yes to both ✔ v4.34

121	Visual sign that searching a house found something	A spray-painted X at the door (orange = searched, red = zombies) and a radio line. Nothing shows what was found.	A floating pop-up over the house: "+8 ▣ +$12", "3 survivors" or "Empty", which rises and fades over \~2 s. The X stays.	—

122	Region 2 has a good difficulty level (said twice)	Tier "Easy" (v4.13 #74).	✔ Keep it as the reference point for the jump into region 3.	—

123	The cargo plane's shadow sometimes stays stuck at the edge of the map after a supply drop	Bug found: the shadow is moved only while its crate exists (SupplyDrops.ts). Collect the crate before the plane is 400 m past the drop and the shadow stops updating, but it isn't removed either (that only happens once it's "done"), so it freezes wherever it was.	Move the shadow on its own clock (from the drop time), independent of the crate, and remove it once it's off the map.	✔ v4.34

124	Searching one building sometimes counts as searching two when they're close together	The simulation only marks the one building that was ordered. But the X is painted where the squad stood, not on the building, so between two close buildings it can land by the other one. A second possibility: one visible building made of two building blocks. (A guess: I haven't reproduced it yet.)	Paint the X on the searched building's own wall, facing the squad. Check in the browser for buildings that overlap or are split in two.	If it still happens after v4.34, where (region, which houses)? ✔ v4.34 (X on the house's wall)

125	An option to crouch in "open cover" when not in cover, for half the cover bonus	A squad that isn't next to a car, pump or sandbags gets no cover and stands. The crouch pose exists (Idle Crouching Aiming, #107).	A Crouch order (hotkey, e.g. G, plus a button): the squad crouches where it stands, takes half the damage reduction of cover (≈ 22% vs 45%) and stands up when it moves. (I'd also suggest it makes them a bit slower to react; say if you don't want that.)	G, and yes, slower ✔ answered ✔ v4.37

126	If more squads are sent into cover than it has room for, the extras crouch in open cover near where they were sent	Cover has no slots: it's anyone within 4.5 m of the cover. Extra squads get pushed apart (4 m spacing) and end up standing out in the open with no bonus.	Give each cover object a number of places (car 2, sandbags 3, as now in the design). Squads beyond that crouch in open cover (#125) next to it, and are listed as such.	✔ v4.37

127	Guns need a muzzle flash	Only a tracer line per shot.	A short flash (a bright billboard plus a small light, \~60 ms) at the gun's muzzle for every shot, bigger for the MG and the sniper. Cheap enough to do for every soldier.	✔ v4.37

128	Shooting while moving should do less damage (less accurate)	Already in: moving squads shoot at 60% accuracy (combat.ts), so they hit less often, but each hit does full damage. It may not be noticeable.	Keep it as accuracy (that is what "less accurate" means in the simulation) but make it bite harder: 45% while moving. Or a damage cut on top.	Accuracy only, 50% ✔ v4.34

129	Outposts don't need a garrison; it could be an outpost upgrade	Since STATUS #11 (v4.29) every outpost has a built-in all-round garrison gun (26 m).	Outposts start unarmed. A Garrison upgrade (select the outpost: about $80 + 25 ▣) adds the gun. That makes a bare outpost weaker against roaming packs: in the v4.29 probe one already fell 4/4 even with the garrison, so the MG + sandbags remain the real defence.	Yes ✔ v4.34

130	The closest target should always be #1 priority	Targeting (targeting.ts): a squad locks onto a target until it dies, and otherwise picks by threat class first (Bloaters and hives before Walkers), nearest only within a class. Only things within 6.4 m override the lock.	Always shoot the nearest target you can engage. Only a target you click yourself (forced attack) overrides that. The lock goes, so a Bloater at 25 m no longer beats a Runner at 8 m.	Yes ✔ v4.34

131	Runners ("sprinters") should take one less shot to kill than Walkers	By the numbers this is already true at every tier and rank. Rifle 9 damage; Walker 36 hp vs Runner 22 hp → 4 vs 3 hits at Standard, 4 vs 3 in region 2, 3 vs 2 in region 1. Misses (62% accuracy) make it feel random.	Probably nothing to change; check it in the next playtest. If you mean one shot fewer than now, Runner hp 22 → 17 (2 hits in region 3).	One shot fewer than now ✔ v4.34 (17 hp)

132	Remove the drifter notifications	The radio says "Movement: a pack of N drifting out of X toward Y" when a pack heads for a secured district or outpost.	Remove that line. The "CONTESTED" alert when they arrive stays.	✔ v4.34

133	One of the two hives in region 3 should be stage 2	Rail Siding's two hives both start at stage 1.	hiveStage: \[2, 1] (the code already supports one stage per hive).	East ✔ v4.34

134	Engineers should do slightly more damage than riflemen	Carbine: 7 damage, 1.0 s, 70% accuracy ≈ 4.9 damage/s per soldier; rifle: 9, 0.9 s, 62% ≈ 6.2. Engineers do about a fifth less per soldier (and have 2 soldiers to the rifle squad's 4).	Carbine damage 7 → 10 (≈ 7.0/s per soldier, \~13% above a rifleman). A Walker then takes 4 hits instead of 6.	Yes ✔ v4.34

135	Hovering over a hive shows a progress bar or timer to its next stage	A hive's hover label shows its health. Its stage and next horde pulse are in the district panel, but not the time to the next stage.	Add a "Stage 2 → 3 in 4:12" line with a thin progress bar to the hive's hover label.	✔ v4.37

136	No cap on supplies	Supplies cap at 150 (supplyCap).	Remove the cap (the HUD drops the "/150"). Supplies can then be hoarded; if that makes things too easy, upkeep or costs can go up later.	✔ v4.34

Ranked in STATUS.md as: bugs first (#123, #124, #120), then the quick tweaks (#132, #136, #133, #134, #130, #128, #129, #131), then feedback visuals (#127, #121, #135), then open cover (#125, #126).



Status after v4.37 (round 11): all done; v4.37 added #125–127 and #135 (barbed wire moved to Z to free G). Earlier, after v4.34: done: #120 outposts at ≤ 2% with the hives dead, "N dead left" · #123 plane shadow · #124 search X on the house (likely cause; check) · #128 moving fire 50% · #129 Garrison upgrade · #130 closest target first · #131 Runners 17 hp · #132 no pack radio line · #133 east hive stage 2 · #134 carbine 10 · #136 no supply cap. Next: #127 muzzle flash, #121 search pop-up, #135 hive stage timer, then #125/#126 open cover.



Round 12 \[v4.35] (playtest of v4.34; built in v4.36)

The first try at this round was on the old branch (claude/magical-brown-7bsmza, v4.32), which is why outposts still needed 0%, there was no dead-left counter, no Garrison, and region 3's hives were both stage 1. These notes are from v4.34 on claude/awesome-einstein-oapvzq.



\#	Note	Current state (from the code)	Proposed fix	Needs from owner

137	Soldiers still "float around": play the idle animation or walk a little, no floating	Resting soldiers don't drift any more (#106), but they still slide into their formation spots at up to \~1.2 m/s while showing the idle pose, by design (CrowdLayer: under 1.6 m/s counts as "not walking"). It happens when a squad stops (soldiers settling), when it turns to face a target (the whole formation rotates around the squad's centre), and when two squads push each other apart.	A resting soldier more than \~0.3 m from their spot walks there (walk animation at a real walking pace); closer than that, they stop dead. A resting squad turning to shoot doesn't rotate its formation: soldiers turn on the spot.	✔ v4.36

138	Upgrading an outpost should need a sapper (engineers) and take a few seconds	The Garrison is bought instantly from the outpost's panel (v4.34).	Engineers do it: select engineers and right-click the outpost (or press its button in their build menu), they walk over and work for \~6 s, paid up front. The outpost's panel shows the cost and "Send engineers to install". Getting hit pauses the work, like building.	✔ v4.36

139	Zombies get stuck on buildings: they try to walk through them, not around them	Zombies that are idle or wandering (not chasing anything) walk in a straight line to their spot and are left out of both the "go around" routing and the "am I stuck?" check (zombies.ts), so they can push into a wall indefinitely. Chasing zombies already go around.	Wanderers use the same routing as chasers when the way is blocked, and get the stuck check too. (Wanderers don't pick spots inside buildings.)	✔ v4.36

140	Engineers shouldn't be able to shoot while building or planting a charge	Builders only shoot back at zombies within \~8 m (danger close); otherwise they keep working.	No shooting at all while building, repairing, deconstructing, installing or planting a charge (planting restarts when hit; building doesn't). Protecting them is the rifle squads' job.	Shouldn't ✔ v4.36

141	Houses next to the one you search still get searched	Cause found. One "houses" block in the map is drawn as 1–3 separate houses (one per \~13 m of street frontage), but the game treats the whole block as one building: searching any house searches the block (and one X is painted).	Split every houses block into one building per house in the simulation, so each house is its own search (its own loot, nest or survivors, its own X). It changes the number of searchable buildings (53 → 68); loot per search is left as it was (owner decides balance).	✔ v4.36

142	Still no pop-up for a search; searches don't seem to find anything now	Cause found. Searches do find things (70% find supplies, sometimes money), but the result is a radio line from the squad, and only lines from Command/Overwatch/etc. become on-screen alerts. So you never see it. (The old branch's 150 supply cap could also have eaten the supplies.) The pop-up (#121) isn't built yet.	Build #121: a pop-up over the house ("+8 ▣ +$12", "3 survivors", "Empty", red "Contact!") that rises and fades over \~2 s, plus an alert line for anything found.	✔ v4.36

143	There was no command cap for region 2 but there is one for region 3; it should be the opposite	The cap is 14 at the start, +3 for each secured district: 17 while you fight region 2, 20 in region 3. It's the same rule everywhere, so I can't tell what you saw. My guess: in region 2 you didn't have the money to reach 17, and in region 3 you did.	Depends on what you meant: a lower cap in region 3? A cap that rises less, or later?	No command cap from region 3 (Rail Siding) on ✔ v4.36

144	Dead left over in a zone should eventually make their way to outposts or other built structures	Leftover dead stand or shuffle where they are. Roaming packs (every few minutes, from region 2 on) only leave districts with a crowd, and region 1 never roams.	Any zombie idle for \~2 minutes heads for the nearest player structure in its own district (outpost, sandbags, MG, tower), or the nearest neighbouring outpost if there's none. That flushes out stragglers and keeps outposts busy. Applies in every region, region 1 included.	Yes ✔ v4.36

145	The MG emplacement should do more damage	8 damage a round, 5 rounds/s, 60% accuracy (\~24 dmg/s); a Walker takes 5 hits.	8 → 12 a round (\~36 dmg/s, 3 hits for a Walker). Your playtest decides from there.	✔ v4.36

146	The "TREATED" status should say "TREATING"	The status label above a squad healing at the Med Bay reads TREATED.	Change it to TREATING.	✔ v4.36

147	Engineers sometimes get stuck in the things they build	A build site blocks the ground as soon as it's placed, and placement only checks for zombies in the way, not your own squads. Sandbags placed where engineers (or any squad) stand trap them inside. Soldiers also drift around their spot without collision checks, so they can end up inside walls.	Placing a structure pushes any squad standing on it to the nearest free spot; engineers work from the edge of the site. Soldiers' positions are checked against walls like the squad's.	✔ v4.36

148	Deconstructing sometimes picks the thing next to the one you click	deconstructAt takes the first structure in the list whose circle (radius + 1 m) contains the click. Sandbags and wire are 9 m long, so their circles overlap neighbours'. The older one wins.	Pick the structure whose footprint contains the click; if none, the nearest one within a metre. Same rule for repair and clicking structures.	✔ v4.36

149	Noise pulses need a cooldown. Fighting a stage 3 or 4 hive's noise pulse makes enough noise to trigger the next one, so pulses never end	Confirmed: a full noise meter sets off a pulse and empties the meter, but the gunfire against that pulse refills it, with no cooldown. Each noise pulse is also 4 bigger than a timed one.	After a noise pulse, that district's meter is locked for 45 s (owner's call; 90 s proposed) (it shows as cooling down) and starts filling again only after that. The hive's normal timed pulses carry on as usual.	45 s ✔ v4.36

150	Clicking a district's name in the Districts panel should move the camera there	The names aren't clickable.	Click a district name → the camera pans to the district's centre (or its outpost, if it has one).	✔ v4.36

Status after v4.36 (round 12): all done (#137–150). #143 answered: no command cap from Rail Siding on. Side effect of #140 to watch: a lone zombie on engineers stops a demo charge until someone shoots it.



Round 13 \[v4.42] (playtest of v4.41; built in v4.43 except assets)

\#	Note	Current state (from the code)	Proposed fix	Needs from owner

151	The ambient city noise needs to be a bit quieter	Suburban ambience bed at 0.3 of master volume (v4.38).	0.3 → 0.2.	✔ v4.43

152	The sci-fi ambient audio is nonexistent	The horror drone plays at 0.05 (v4.38, "very quiet"), so it's lost under the suburban bed.	0.05 → 0.12, so it's audible under the quieter city bed (#151).	✔ v4.43

153	Zombie attacks: once every 2 s for Walkers, once a second for Runners	Walkers every 1.2 s (7 damage), Runners every 0.8 s (5 damage).	Walkers 2.0 s, Runners 1.0 s. That's less damage per second: a Walker \~5.8 → 3.5/s, a Runner \~6.3 → 5/s.	Keep damage per hit ✔ v4.43

154	Sometimes one soldier of a squad gets stuck on a building	Cause found, and it's mine: since v4.36 (#147) a soldier won't step into a wall, but soldiers don't path-find, they head straight for their spot in the formation. When a building is in the way, that soldier stops at the wall and stays there while the squad moves on.	Soldiers slide along walls instead of stopping. Any soldier blocked (or more than \~6 m behind) for over a second follows the squad's own route, or steps to a free spot beside the squad.	✔ v4.43

155	The power station's start-up sound didn't play	It plays in the current build: I ran the real restore in the browser (engineers finish restoring → the power-on sound fires). Two likely reasons it didn't for you: the sound arrived in v4.41 (the last push), or the camera was more than \~140 m from the station (sounds fade out with distance; at the time I'd also briefly made it play everywhere, then placed it at the station as you asked).	Retest on the latest pull with the camera near the station. If it's still silent, I'll dig further.	Retest please

156	Power coming on should attract zombies	Restoring power makes no noise.	When the power comes on, a big noise at the station (as loud as a demo charge: heard \~260 m away), so the dead in range come to investigate.	✔ v4.43

157	Extra district tasks, like saving civilians, for future regions?	The only side task is survivors from house searches (Rail Siding on).	Ideas to pick from: survivors holed up in a marked building (clear it, escort them out); supply cache in a locked building (engineers breach it, big one-off haul); radio mast / relay to restore (reveals the next district, ties in with fog of war later); downed helicopter crew to reach before a horde does; convoy escort (needs vehicles); nest building to burn out (needs flame team).	All six; on the roadmap (STATUS)

158	Unit labels aren't visible until you hover over them	Squad names and status (IN COVER, MOVING…) are always shown, at 10 px. The health bar and soldier pips only show on hover or when selected (by design since v4.x, "hover-only health bars").	Owner: the whole label (name, status, health) only shows while the mouse is over the squad.	The whole label, only while hovering ✔ v4.43

159	Ambient car models	Parked cars are procedural boxes. The model library can swap them for a real model (car key in public/models/manifest.json).	Drop in 2–4 low-poly car models (I'd simplify them as I did the barbed wire). CC0 options: Kenney's Car Kit, Quaternius' cars.	The car models (CC0 or CC-BY)

160	The MG nest model doesn't match its orientation: the opening in the sandbags should be opposite the forward arrow	Cause found: the sandbag ring is built with its opening on the west side and never turned to match the aim you set with R. Only the gun turns.	Turn the whole nest to its aim, so the opening is always at the back, opposite the arrow.	✔ v4.43

161	Crouched movement, crouch firing, and crouch firing while moving animations	Crouched soldiers use "Idle Crouching Aiming" standing still (it doubles as firing) and the normal walk, slowed, on the move.	Wire them in when they arrive: crouch walk, crouch fire, crouch walk + fire.	Mixamo clips (rifle, FBX, Without Skin): search Mixamo for "crouch": a crouch walk forward, a crouched rifle firing, and if there is one, a crouch walk while firing. (Names from memory; I haven't checked Mixamo's current list.)

Status after v4.43 (round 13): done: #151–154, #156, #158, #160. #155 retest. #157 on the roadmap. Waiting on assets: #159 car models, #161 crouch animations.



Round 14 \[v4.50] (playtest of v4.49, the moderate horde; logged, not started)

\#	Note	Current state (from the code)	Proposed fix	Needs from owner

162	Make Runners faster	Runners run 7.6 m/s (Walkers 2.7; soldiers 6.4).	7.6 → 9.5 m/s (half again as fast as a soldier).	✔ v4.51

163	Hives should spawn in a random place in each region	Each region's hive sites are fixed spots in the map data (hiveSites).	A new game picks each hive's spot at random inside its region: open ground, away from the fence and the region's entrance, and apart from the other hive. Seeded per game, so a saved game keeps its hives where they were. The map editor's hive sites become "allowed areas" if you want to steer it (optional).	✔ v4.53

164	A sound when units finish training	Nothing plays when a squad leaves the Barracks (the game does know: unitProduced).	Play a short radio burst with the "ready" message. Or a dedicated "unit ready" sound if you send one.	Owner will send a sound

165	Remove pulse timers	Two things could be meant: the "next pulse 9:59" countdown in the Districts panel, or the timed horde pulses themselves (each hive sends a wave every few minutes; noise sets one off early).	Either remove the countdown from the panel, or remove timed pulses so waves only come from noise (the panel line goes too).	The countdown text ✔ v4.51

166	Zombies should roam farther from their hives	Idle zombies wander within 14 m of their hive.	Up to 40 m from the hive.	✔ v4.51

167	Zombies still pile up on walls instead of finding a new way round	Likely cause: within 8 m of their target, zombies walk straight at it even with a wall in between (the go-around routing only kicks in further out), and the "I'm stuck" check only fires when one has barely moved for 0.8 s. In a crowd they keep getting jostled, so they never count as stuck and keep pressing on the wall.	Route around whenever a wall is between a zombie and its target, at any distance; count a zombie as stuck when it makes no progress towards its target (not just when it stands still).	✔ v4.51

168	"Hive pulse" sounds weird: needs a new name	The waves are called "horde pulses" in the HUD, radio and briefings.	A new name everywhere, e.g. Surge ("a surge from the hive"), Swarm, Outpouring or Horde wave.	Horde wave ✔ v4.51

169	Hives need a texture	A hive is a plain procedural blob with a glowing core.	Map a texture (or swap in a model) when you send one.	A hive texture (tileable organic/flesh, ≤512 px) or a hive model

170	Zombie health needs to go down	HORDE.toughness 0.6 (v4.49). A Rail Siding Walker takes 3 rifle hits, a Runner 2.	0.6 → 0.45: Walkers 2 hits in every region, Runners 1.	✔ v4.51

171	Demo charge plant time a little shorter	3 s to plant (getting hit restarts it).	3 → 2 s.	✔ v4.51

172	Hives shouldn't spawn zombies as often (a 10 s timer?)	Spawn intervals run 4–18 s by tier and hive stage (a stage-4 Standard hive every 4 s), and since v4.49 each spawn is twice as many.	Never faster than every 5 s (owner's number), at any stage (slower ones stay as they are).	5 s ✔ v4.51

173	The Barracks queue should say "Rifle Squad ×5", not list it five times	Each queued squad is its own line.	Group runs of the same unit: "Rifle Squad ×5", with the first one's progress bar.	✔ v4.51

174	The current waypoint feature should be a patrol feature	Today: Shift+right-click queues points; the squad goes to each in turn and stops at the last. There's no patrol yet (the order type exists, unused).	Patrol: a Patrol button / hotkey, then click points: the squad walks them in a loop until given another order, fighting what it meets.	P ✔ v4.52

175	New waypoint feature: go to each waypoint and stop at the last	That's what Shift+right-click does today (#174).	Keep it as the waypoint feature (or tell me what's different from what you want).	Is the current Shift+click what you mean here? ✔ v4.52 (kept)

176	Show waypoints and patrol points	Queued points aren't drawn (only a brief click marker).	For the selected squads: numbered markers joined by a line for waypoints; a closed loop in another colour for patrols.	✔ v4.52

177	A formation maker for multiple groups	Several squads moved together form a line, fighters in front and engineers behind, 6 m apart.	A formation picker for multi-squad moves: line, column, wedge, box, spread; right-drag to set the facing. Remembered per selection or group.	Preset shapes, dragged with right-click ✔ v4.54

178	Sometimes overlapping units' labels don't pop up	Hovering picks only the one squad nearest the cursor, so others under it never show their label.	Show the label of every squad under the cursor, stacked so they don't overlap.	✔ v4.51

179	UI clean-up: no "cooling down" on the noise meter	Since v4.36 the Districts panel shows "cooling down 45s" after a noise pulse.	Remove that text.	Just this for now ✔ v4.51

180	New models and animations are coming	—	Wire them in when they land, then re-bake the cast (bake-cast.cjs).	The uploads

Status after v4.54 (round 14): done: #162, #163, #165–168, #170–179. Waiting on the owner: #164 (a squad-ready sound), #169 (a hive texture or model), #180 (the new models and animations, partly uploaded).



Round 15 \[v4.67] (playtest of v4.66; logged, not started)

\#	Note	Current state (from the code)	Proposed fix	Needs from owner

181	A tool to tune difficulty without Claude: hive starting level, ambient zombies per region, spawn pools and their sizes, etc.	Every number is in code: src/config/balance.ts (horde toughness/damage, hive broods and pools, spawn intervals, roaming packs per difficulty tier) and the region data (hiveStage). Changing one needs a code edit.	dev-balance.html, like the weapon fitter: every knob grouped (per region: hive start stage, ambient zombies, the hive's two pools and their sizes, spawn interval, roaming packs; global: zombie health/damage, horde waves), with the current value and the default. Changes apply to the next game in that browser at once (test right away), and Download balance.json makes them everyone's defaults once uploaded to public/. "Reset to defaults" per knob and for all.	✔ v4.68 (owner: no others in mind; more knobs can be added to the list any time)

182	List the map editing tool in the GitHub readme next to the weapon fitter	README.md lists only the "Rifle fitter" (and still calls its file m4.json).	Add the map editor (dev-map.html: what it edits, how to save), update the fitter (any unit/gun, one .json per gun) and add the balance tool (#181) once it exists.	✔ v4.68 (also in STATUS.md, with links)

183	Use the zombie pile-ups to make the climbing feature	Zombies stopped by a structure: chasing a squad they go round for 2.5 s, then claw through; at the base wall they take the flow field to the gate (#167). The pile-up/climb is a "Tier 2 hook" comment in zombies.ts, not built.	When enough zombies (e.g. 8+) press against the same stretch of wall/sandbags/tower for a few seconds, the front ones pile up (bodies stacking, drawn rising), and once the pile reaches the top the rest walk up and over it (or onto a tower's platform to attack the garrison). The pile collapses a few seconds after the press ends.	Which structures can be climbed (base wall? sandbags, wire, towers, outposts?). If the base wall can be climbed, the #167 "go round to the gate" behaviour gives way to piles when a big crowd presses. Threshold (crowd size, seconds)? Owner: pretty much anything can be climbed.

184	Region 3 needs spice: bored by then. More incentive to build? Maybe the Humvee	Region 3 plays like region 2 with more zombies. The Gun Jeep (the Humvee role: MG, fast) exists only as roster data, behind the vehicles feature (off), made at an Armor Station that doesn't exist yet. Nothing in region 3 forces fortifying.	Humvee (the Gun Jeep, renamed, Humvee model wanted) from a Vehicle Bay (#185). Build incentives, pick any: (a) region 3 hordes go for structures and outposts, so defences matter; (b) a "hold the line" event: a survivor convoy/evac arrives at a district and has to be defended for a few minutes; (c) outposts earn per minute held (income for expanding); (d) night: bigger waves at night, so a fortified line pays off.	Which of (a)–(d); a Humvee model (Sketchfab/Mixamo-free GLB). (Owner wasn't sure what was meant; explained again after v4.68.)

185	Lootable hospital in region 2 unlocks the Med Bay; the Med Bay is in the base from the start but run down until the hospital is looted. Restoring region 3's power unlocks the Vehicle Bay. Looting the hospital shows a tutorial pop-up about significant buildings (hospitals, police stations, fire stations)	The Med Bay unlocks when region 3's power is restored, and engineers build it anywhere in the base. There's no hospital in the map. Police/fire stations as loot landmarks are STATUS #18 (open). No Vehicle Bay.	A hospital landmark in region 2 (placed in the map editor, movable): searching it takes longer and finds supplies plus medical equipment → the base's run-down Med Bay (pre-placed, dark/broken, does nothing) becomes a working one (and medics unlock, as now). Region 3's power → Vehicle Bay (same pattern: run down in the base until then). First landmark looted → a tutorial pop-up: "Significant buildings (hospitals, police and fire stations) hold big hauls and unlock things." Police/fire stations (#18) use the same landmark system.	Owner: the Med Bay is fixed (engineers repair it once the hospital is looted); the Vehicle Bay is built by engineers, unlocked by region 3's power the way the Med Bay unlocks today. ✔ v4.72 (the Med Bay runs without power now, so the hospital helps right away)

186	Waypoint and patrol paths should only be visible for selected units	The route lines and numbered waypoints already draw only for selected squads (RouteLayer, since round 14). What everyone sees briefly is the click marker (a ring where you clicked, fading in about a second).	Need to know what you saw: if it's the click rings, hide those for patrol points after placing; if routes stay up after deselecting, that's a bug to chase.	Owner: ignore (dropped)

187	Remove hive stage from the HUD	The Districts panel shows "Hive stage n/4" per hive.	Remove the line (the hive's growth still shows on the hive itself).	✔ v4.71

188	Haven't noticed any muzzle flash or explosion flash	Muzzle flash: a 1.4 m star sprite for 0.05 s (big guns 2.4 m, 0.07 s), timed in real time: 3 frames at 60 fps, and at a choppy frame rate it can be skipped entirely (likely why it's invisible with the frame drops). Explosions: an orange ball that grows and fades (0.45 s) and a scorch mark; no bright flash or light.	Flashes always drawn for at least 2 frames, \~1.5× bigger, 0.08 s. Explosions: a white-yellow flash (0.12 s) plus a short point light that lights the ground and walls around it, and a puff of smoke.	✔ v4.71

189	Trees shouldn't grow out of the sidewalk	Street trees are placed on the sidewalk's centre line on purpose (they were palms in tree slots); with real tree models it looks like they sprout from concrete.	Move each street tree onto the grass verge or front yard beside the sidewalk where there's grass; where there isn't, give it a tree pit (a square of soil with a kerb) in the sidewalk.	✔ v4.71 (pits where there's no grass)

190	Starting to notice frame drops	The start view: 159 draw calls, 270k triangles, 616 meshes, 593 casting shadows; the 218 tree meshes are each drawn on their own (twice with shadows), and since v4.66 they're alpha-tested, which costs more in the shadow pass. The character cast grew in v4.62 (civilians unsimplified). Likely culprits: the new trees first.	(1) Draw trees instanced: one draw per tree type (\~20 instead of \~220, and the same for shadows). (2) An FPS / frame-time readout (toggle in Settings) so you can tell me numbers and where. (3) Lighter civilians in the crowd bake. Then measure on your machine.	Owner: the drops were there before the new trees. v4.69: readout and quality setting in; numbers from the owner's machine next.

191	Stop spending usage on screenshots	None were sent, but I took private ones to check the trees and the medic (they cost usage).	No screenshots at all, private ones included (CLAUDE.md updated); anything only eyes can judge goes to you as "please look at X".	–

Round 16 \[v4.73] (playtest of v4.72; logged, not started)

\#	Note	Current state (from the code)	Proposed fix	Needs from owner

192	Boomers shouldn't make an explosion flash	A Bloater bursting is an explosion event (type toxic); since v4.71 every explosion starts with the bright flash and ground glow, the toxic one included.	No flash or glow for toxic bursts: just the green puff and the gas cloud as before.	✔ v4.74

193	Cars need to be duller	The parked cars are the owner's car pack with its texture colours baked in at full strength (v4.56).	Tone them down when drawn: \~30% less saturated and \~15% darker (one setting, easy to adjust after a look).	✔ v4.74

194	Trade the interrupting splash screens for smaller HUD pop-ups	Region opening, power restored and the first significant building each open a centred dialog that pauses the game; so does every tutorial step's prompt.	A small card at the side of the HUD (no pause, the game keeps running): a title, two or three lines, and "Got it" to close; older cards stack and fade. The start screen and the win/lose screens stay as they are.	✔ v4.74 (owner: tutorial unchanged for now)

195	Hive name and stage should be hover only	Every hive always shows "HIVE · stage n/4" above it; hovering adds health and time to the next stage.	Nothing above a hive until it's hovered (or selected); then the name, stage, health and next-stage bar as now.	✔ v4.74

196	Don't mark the hospital	Since v4.72 a "✚ HOSPITAL" label floats over it until it's looted.	Remove the label; the roof cross (#197) and the objective line stay.	✔ v4.74 (owner: keep the objective line)

197	The hospital's cross and white panel float above the roof	They're placed at the building's full height + 0.9 m, but an apartment's roof is lower than that figure (it includes the parapet), so they hover \~1.7 m up.	Put them on the roof surface, inside the parapet.	✔ v4.74

198	Pause prompts need to be condensed, and about the game's functions rather than what's coming next	The briefings and tutorial prompts are paragraphs of story and outlook ("Expect a step up…").	Rewrite them short and practical: what's new, how to use it (keys, clicks, costs), one line each; no lore. Goes with #194.	✔ v4.74

199	Medics should get XP from healing	XP only comes from kills (1 per kill), so medics barely level.	A heal earns XP by how much it restored: e.g. 1 XP per 5% of the patient's health healed, +2 per soldier brought back (a full 40% heal ≈ 8 XP, like 8 kills).	✔ v4.74 (owner: OK)

200	Need a new cargo drop plane sound	The supply plane uses a commercial jet fly-by (v4.41).	Swap in a propeller cargo plane (C-130 type) fly-by once there's a recording.	✔ v4.75 (the owner's C-130 recording)

Round 17 \[v4.79] (playtest of v4.78; logged, not started)

\#	Note	Current state (from the code)	Proposed fix	Needs from owner

201	Need Humvee audio	The Humvee is silent except its MG (the emplacement's loop).	An engine loop while it drives (quiet idle when parked), placed at the Humvee like the other sounds.	✔ v4.80 (owner's recording; only zoomed in and close)

202	Can the Humvee's gun rotate?	Yes, possible. The model is baked into one piece, gun included; the gun doesn't move, and the whole vehicle doesn't turn to shoot either.	Split the gun/turret out of the owner's model when exporting it (its parts are separate in the file) and turn it toward the target, back to the front when idle.	✔ v4.80

203	Can the Humvee turn like a real car instead of spinning on the spot?	It turns instantly to face where it's heading (squads do the same), so it can pivot in place.	Car steering: it only turns while moving, with a turning circle (\~6 m), a top turning rate and speed that drops in tight turns; the path is followed by steering toward a point ahead; it backs up a few metres when a turn is too tight.	✔ v4.80 (owner: fine if it can't squeeze everywhere)

204	Infantry shouldn't be able to push vehicles	Squads that get too close push each other apart equally, Humvees included.	Vehicles don't get pushed by infantry; infantry steps aside for a vehicle instead.	✔ v4.80

205	Ground texture is slightly different around buildings	The ground under a building's footprint is painted a flat grey; where the building is smaller than its footprint (house yards, rows split into houses) that grey shows as a band around it.	Paint under-building ground like what surrounds it (lawn, dirt, lot), so nothing shows at the edges.	✔ v4.80

206	Duller cars look good	v4.74's tone (30% less saturated, 15% darker).	✔ Keep.	–

207	Humvee driving sound once when it's given a move	Nothing plays on orders (squads have no order acknowledgement sounds).	A short "drive off" sound (engine revving up) when a Humvee is ordered to move, once per order, at the Humvee.	✔ v4.80 (owner's recording, plays once per move order and fades)

208	Humvees shouldn't drive through lamp posts	Street furniture (lamp posts, hydrants) is decoration only: nothing collides with it.	Either (a) lamp posts block vehicles (they steer around them), or (b) a Humvee knocks a lamp post over when it hits it (it falls and stays down).	✔ v4.80 (owner: steer around; only armored vehicles will knock things over)

209	More trees?	Trees and shrubs come from the open-ground scatter (≈18% of 700 tries), the street trees and the house yards; \~200 on the starter map.	More of them: roughly double in open ground, small clusters/tree lines in parks and along the rail and the map edges. Trees are drawn one by one, so if it costs frame rate I'd draw them in batches (one draw per tree type).	✔ v4.80 (owner: a lot more: \~3×)

Round 18 \[v4.82] (playtest of v4.81; logged, not started)

\#	Note	Current state (from the code)	Proposed fix	Needs from owner

210	Humvee bullets come out of the engine, not the gun	A shot's tracer and flash start at the squad's member position: for a Humvee that's the middle of the vehicle, low down.	Start them at the turret's muzzle: on the roof, the barrel's length out in the direction the turret faces.	✔ v4.83

211	Humvee driving sound shouldn't overlap	Every move order plays the drive-off; quick orders stack (up to 3 at once).	One per Humvee: a new order restarts it instead of adding another.	✔ v4.83

212	Humvee idle has a hard cutoff when it loops	The loop is a straight cut of the recording with short fades at both ends, so there's a dip/click at the seam.	Make it a seamless loop: cross-fade its end into its start.	✔ v4.83 (cross-faded WAV loop)

213	Humvees should run over (kill) zombies, only while moving	Vehicles don't touch zombies at all.	Zombies in its path while it's moving (above walking pace) are killed; it slows a little for each. Parked, nothing happens.	✔ v4.83

214	Right-drag to set a Humvee's resting direction, with a ghost and arrow for the front (like formations and buildings)	Right-drag lays out squad formations; a Humvee just stops facing however it arrived.	Right-dragging a Humvee shows a ghost Humvee with an arrow at the front; it then lines up on the way in (approaches from behind the spot), backing and filling if it has to, so it parks facing that way.	✔ v4.83 (arrives, then shuffles round with short strokes if needed)

215	Humvees sometimes circle a point they can't reach; settle within 5 m	A spot inside its turning circle (or blocked) can leave it orbiting: it keeps moving, so the "stuck" rule never fires.	Arrived when within 5 m; and if it's been going round (turned a full circle) near the spot, it stops where it is.	✔ v4.83

216	Humvee shooting sound has a hard cutoff when it repeats	The new 50 cal loop is a straight cut of the burst, so the seam clicks.	A seamless loop (cross-faded), like #212. Same for the MG emplacement.	✔ v4.83

217	Unit XP bar with the health bar	XP shows only as the level name and a number in the selection card.	A thin XP bar under each squad's health bar (progress to the next level).	✔ v4.83

218	Medics can't get into the Humvee	With medics selected, right-clicking a damaged Humvee counts as "heal it" (refused: medics don't fix vehicles) instead of "climb in".	A vehicle is never a medic's patient: right-click boards.	✔ v4.83

219	Clicking a Humvee with a squad in it doesn't select it (dragging does)	A click picks the nearest squad to it, and the hidden rider sits exactly on the Humvee, so the click picks the rider (which can't be selected) and nothing happens.	Clicks skip riders.	✔ v4.83

220	Engineers should have a repair keybind for vehicles	Engineers repair structures (right-click); vehicles can't be repaired at all.	Engineers repair vehicles: right-click a damaged Humvee with engineers, or a key then click (free keys: J, L, N). Costs supplies like structure repairs.	✔ v4.83 (owner: N; right-click boards, repairs by button)

221	Dev menu: spawn every friendly unit and the constructable buildings	It spawns zombies and hives only.	A "Units" section (every unit in the roster, placed as your squad, free) and a "Buildings" section (every buildable structure, placed finished, free, ignoring unlocks; still has to fit).	✔ v4.86

Round 19 \[v4.84] (playtest of v4.83; logged, not started)

\#	Note	Current state (from the code)	Proposed fix	Needs from owner

222	The Humvee's MG (and the MG emplacement) should do more damage than infantry weapons	Both use the "Mounted HMG": 12 damage a hit, 5 shots a second. The service rifle does 9. With today's zombie health (a Walker \~16) both take two hits to drop a Walker, so the MG doesn't feel stronger hit for hit.	Mounted HMG 12 → 20 a hit (one hit drops a Walker, two a Runner or a Bloater's first chunk), both the Humvee and the emplacement; and put weapon damage on the tuning page so you can set it yourself.	✔ v4.85 (owner: 20; "Weapons" on the tuning page)

223	Run-over reach shouldn't extend past the Humvee's body	It checks a circle around a point ahead of the middle, about 1.7 m wide each side and \~3 m ahead: wider than the Humvee (2.2 m) and longer in front.	Use the Humvee's own outline (4.1 × 2.2 m, turned with it): only zombies actually under it count.	✔ v4.85

224	The drive-off sound should follow the same distance rules as the idle	It's checked once when the order is given, then plays on at that volume even if you zoom out or look away.	Update its volume every frame by the same zoom-and-distance rule as the idle, so it fades as you move off.	✔ v4.85

225	Humvees still drive through trees	Trees are decoration; vehicles only know about lamp posts.	Trees block vehicles like lamp posts (routes avoid them, it slides round them). Shrubs stay passable.	✔ v4.85 (owner: shrubs passable)

226	Humvees still get stuck: hit something, back up, hit the same thing	When it bumps into something it backs up and swings, but plans the same route again, so it can go straight back into it (things it can hit that its route doesn't know about: trees, cars' corners).	Remember what it hit (for \~20 s) and plan around it; back up farther (3 m) with full lock; after two bumps in a row, try going round the other way.	✔ v4.85 (backs away a turning circle, not 3 m; no corner-cutting into parked cars)

227	Give Humvees the ability to reverse when they need to	It only reverses for a moment to get out of a tight turn or a bump.	Back straight up to a spot that's close behind it (within \~12 m) instead of turning round to drive there; and back out of dead ends properly (#226).	✔ v4.85

228	A Humvee being repaired says "Treating", should say "Repairing"	A squad that was just healed shows "TREATING"; the Vehicle Bay's repairs mark the Humvee the same way.	Vehicles say "REPAIRING" (at the bay and with engineers).	✔ v4.85

229	Humvees stop at each queued waypoint; they should carry on to the last	Every waypoint is treated as a destination: it brakes to a stop, then sets off for the next.	Through waypoints it keeps going (slowing only for the turn); it stops at the last one.	✔ v4.85 (patrol legs too)

230	The Humvee's shooting sound should get a bit quieter as you zoom out	Its MG loop gets quieter with distance from the middle of the view, but not with zoom (only the ops map halves it).	Fade it with zoom too, to about half at the default zoom and less further out (not silent like the engine).	✔ v4.85

231	The Humvee shouldn't shoot until its turret has finished turning	The turret's turning is only drawn; the gun fires as soon as it has a target, whichever way the turret points.	Move the turret's angle into the game itself: it turns at its own speed, and the gun only fires once it's pointing at the target (within a few degrees).	✔ v4.85

Round 20 \[v4.87] (playtest of v4.86; logged, not started)

\#	Note	Current state (from the code)	Proposed fix	Needs from owner

232	Humvees should come out a little to the right; they use the middle door now	The Vehicle Bay's exit is set 2.3 m east of its centre on the north side (round 18), which lands on the middle door of the model.	Move the exit over to the next door to the right (a few metres; the ghost's arrow moves with it).	Owner: the far-right door; ✔ v4.90

233	Humvees should cost	A Humvee costs $160 + 40 supplies at the Vehicle Bay, taken when you queue it. Only dev-menu Humvees are free.	Probably the same as #239 ($180). If one came out without being charged, that's a bug to chase.	Owner: $180, supplies unchanged (= #239); ✔ v4.90

234	Dev menu should be toggleable in Settings	The ` key always opens it.	A "Dev menu" switch in Settings; the ` key does nothing while it's off.	Owner: off by default; ✔ v4.91

235	The hospital line should be vaguer, e.g. "maybe there's something important left inside"	The region card and briefing spell it out: "medical equipment to fix the Med Bay" / "its equipment lets engineers repair the Med Bay", plus "red cross on the roof".	Use your wording in both places; the card after looting still explains the Med Bay.	Owner: drop "red cross on the roof" too; ✔ v4.91

236	Remove the orange X on the ground after searching	A searched building gets a spray-painted X by its door: orange if it was empty or had loot, red if zombies came out. It's the only sign a house was searched.	Drop the X.	Owner: both colours; ✔ v4.91

237	Infantry should reload now and then while shooting	There's no reloading: each soldier fires on a fixed cooldown forever.	A magazine per weapon (e.g. rifle 30, carbine 30, pistol 15, MG team 100); when it's empty that soldier stops for a reload (\~2–3 s; the MG team's longer), staggered across the squad so it never goes quiet all at once. With a reload animation and sound if you'd like. Changes damage over time a little.	Owner will send the clips and sound later

238	MG emplacement back to its original damage	20 a hit since v4.85 (the Humvee's MG is the same weapon).	MG emplacement back to 12; the Humvee stays at 20 (set apart so tuning one doesn't change the other).	Owner: the Humvee and the MG emplacement both 15; ✔ v4.90

239	Vehicle Bay $150, Humvee $180	Vehicle Bay $220 + 60 supplies; Humvee $160 + 40 supplies.	Vehicle Bay $150, Humvee $180.	Owner: supplies unchanged; ✔ v4.90

240	Get rid of the dots on infantry's heads	Likely the row of little squares in a squad's label (one per soldier, dark when one's lost), shown on hover and when selected, above the health bar.	Remove them (the health bar and the card still show losses).	Owner: yes, the per-soldier dots; ✔ v4.91

241	Humvees need to path round solid things; they run into trees a lot	Since v4.85 street trees and lamp posts are obstacles, but routes only prefer to avoid their 3 m map squares (a cost, not a wall) and the tree itself is a 0.6 m circle, while a tree's canopy is about 3 m across, so it squeezes between trees and clips them. Trees in house yards aren't obstacles at all (they're drawn, not in the game's map).	Make tree and post squares walls for vehicle routes (not just a cost), keep vehicle routes a square off buildings and parked cars where the street allows, make trees about 1.2 m round to vehicles, and add the yard trees.	✔ v4.89 (yard trees needed nothing: they're inside house lots, which can't be driven into)

242	A stuck Humvee just gives up	If it hasn't got 2 m anywhere in 4 s, the order is dropped.	Don't give up: back out, mark the spot, plan another way and try again (a few times); only if every way is shut does it stop, and it says so on the radio.	✔ v4.89

243	Humvees should see farther	Every gun picks targets within its own range: the Humvee's MG reaches 35 m (rifles 22). Fog of war is off, so there's no separate sight.	Humvee MG range 35 → 45 m (it engages from farther; on the tuning page too).	Owner: 45 m; ✔ v4.90

244	The ops map should show faint region borders	The ops map tints each region (infestation, secured, locked) and labels it, but draws no edges.	A thin, faint outline round each region on the ops map only.	–; ✔ v4.91

Round 21 \[v4.92] (playtest of v4.91 by a second player; logged, not started; #256 added and answers recorded in v4.93)

\#	Note	Current state (from the code)	Proposed fix	Needs from owner

245	Top bar: less HUD. No game name; money, supplies and command (renamed "troop count") in one section; the day as a 24-hour clock (hh:mm) on the right, no progress bar; no camera-rotate, ops-map, sound, UI or menu buttons (UI size and sound go in Settings); the Districts panel becomes a button that toggles it	Left to right: "DEAD BLOCK COMMAND", $ (+/min), ▣ (+/min), ★ command used/cap, "Day N" with a progress bar and the upkeep; then pause and 1×/2×/4×, ⟲ VIEW ⟳, OPS MAP, SOUND, UI, MENU. The Districts panel is always on screen (it folds up). Sound volume and interface size are already in Settings too. A day is 12 real minutes; upkeep is charged when it ends.	One compact strip: $ · ▣ · troops (with the cap while there is one), then pause and speed; on the right the clock (a day runs 06:00 → 06:00, upkeep due at 06:00, shown on hover) and a DISTRICTS button that opens and closes the panel (hidden by default). The rotate, ops-map and menu buttons go (Q/E, M and Esc still work; the Controls page lists them); sound and UI size stay in Settings only.	Owner: troops = the total number of soldiers (the command cap stays in command points, on hover); keep pause and speed; clock from 06:00

246	Ideas wanted for the bottom HUD	Bottom right: the selection panel (one card per selected squad, then its command buttons). Bottom middle: the engineers' build bar. Left: the objectives panel. The radio messages show as lines that fade.	Ideas: (1) one command grid in the corner, icons with their hotkey letter, names on hover, the same 3×4 layout for every unit (RTS-style), the build menu as a page of it; (2) the selection as one compact strip: portrait, health, level and status for one squad, small icons for several; (3) objectives as a short line under the top bar ("Clear Roadside Motel · 2 dead left") that opens on click; (4) radio as the last line only, the log on hover; (5) everything hidden until something is selected.	Owner: all five, together (STATUS #76)

247	Rewrite the tutorial: walk through the natural steps of playing, briefly. Start with no units; click the Barracks to make units; levels and experience; the unit cap and that it goes after the tutorial region; clear zombies and hives and search buildings for supplies and civilians; on the first fight, right-click to attack and the other commands (bottom right); when an outpost is due, why it needs defences; on first opening region 2, that you won't be region-locked after the tutorial; highlight what to click	"Deploy with training" runs 10 paused steps up front (welcome, camera, select, move, cover, noise, fortify, recruit, support…), mostly before anything happens. You start with two rifle squads and an engineer team. The command cap lifts when region 3 (Rail Siding) opens.	A new tutorial driven by what happens: short prompts that appear when they're relevant (start: click the glowing Barracks, recruit; first squad out: select and move; first zombie seen: right-click to attack, the command buttons; first level-up: experience; first building near: search; hive found: demo charge; region cleared: outpost and defences; region 2 opens: no region locks after the tutorial). The thing to click pulses. Training starts with no units and enough money for the first squads; "skip training" keeps today's start.	Owner: all three starter regions are the tutorial; each prompt pauses

248	An option to start in the open world, with the three starter regions still to take	There's one campaign: the three starter regions open one after another (fenced, tutorial cards); the open world after them isn't built yet (STATUS #17).	A third start button, "Open world": all three starter regions open from the start, no fences, no command cap, no tutorial cards; the hives and zombies as they are now.	Owner: yes, but later; with slightly more starting money and supplies

249	Region 2's hive should start at level 1	Gas Station Strip's hive starts at stage 2 (the map data; balance.json doesn't change it).	Stage 1. (It's also on the tuning page: Region: Gas Station Strip.)	–; ✔ v4.95

250	Noise pulse cooldown 60 s	The noise meter stays empty for 45 s after a horde wave.	60 s.	–; ✔ v4.95

251	Zombies shouldn't all follow the same path: a horde, not a conga line	Zombies that can't see their target follow one shared flow field toward it, so everything from one direction takes the same street and the same corners, nose to tail.	Give each zombie its own drift: a sideways offset from the shared route (some keep to the left of a street, some the right, some cut across), a little weaving, and pushing apart from neighbours more so they spread over the road; packs fan out as they get close.	–

252	A total infected kill counter?	Each squad counts its own kills (on its card); nothing totals them.	A running total of the dead, for the whole campaign.	Where: the top bar, the pause menu, or the districts panel?

253	Call the MG emplacement "Heavy MG Nest"	It's "MG Emplacement" in the game and "MG Nest" on the build bar.	"Heavy MG Nest" everywhere (build bar, cards, controls, tutorial).	–; ✔ v4.95

254	Infantry should take the shortest route at first	Infantry routes are already shortest-distance (they only go round gas clouds and pay a little for barbed wire). Likely causes of a roundabout route: a long route runs out of search budget (6,000 map squares) and heads for the nearest reachable point first, re-planning later; and routes run square-centre to square-centre (3 m squares), so the first leg can angle off before straightening.	Raise the search budget and straighten the first leg; I'd like to see where it happened first.	Owner: the top-left side (of the map)

255	More time between hive upgrades	A hive takes 10 min (stage 1→2), 7 min (2→3) and 8 min (3→4).	Half as long again: 15, 10.5 and 12 min (on the tuning page too: Hives → Seconds to grow a stage).	Owner: 15, 10.5 and 12 min; ✔ v4.95

256	No more timed horde waves: noise is enough	Each hive sends a horde wave on a timer (first after 7–10 min, then every 3–7 min by stage and region) and also straight away when a district's noise meter fills.	Drop the timer: waves come only from noise. The timer settings leave the tuning page.	–; ✔ v4.95

Round 22 \[v4.97] (notes on v4.96; logged, not started; #270 added in v4.98)

\#	Note	Current state (from the code)	Proposed fix	Needs from owner

257	No more command points for now	Each unit costs command points (rifle squad 2, Humvee 3) against a cap, until region 3 opens.	Drop the cap and the points; the top bar shows the troop count (#245). The points stay in the data, unused, so they can come back.	–

258	Gas-station roofs aren't see-through often enough	Buildings between the camera and your squads fade; the gas-station canopies are street props, probably not in that fade check (a guess, not checked).	Fade canopies (and any roofed prop) the same way as buildings.	–

259	A crouch indicator	Crouched squads only look lower; their status says so only when it's the main thing they're doing.	A small crouch icon by the squad's name (and on its card) while crouched.	–

260	Engineers shouldn't be interrupted while planting a charge	Getting hit restarts the plant (by design since the charges came in).	Getting hit no longer restarts it; they keep planting.	–

261	A search progress bar	Searching shows only a status line.	A small bar over the building (and on the squad's card) filling as they search; the hospital's longer search too.	–

262	Hurt sounds	Only a death cry per soldier lost; nothing when hit.	Short grunts when soldiers take a hit (limited so a fight isn't a wall of grunts); zombie hit sounds too if wanted.	Owner: yes, soldier grunts and zombie hit sounds (owner to send them)

263	Medics should be trained at the Med Bay	Medic Teams are recruited at the Barracks once the Med Bay is repaired.	Recruit them at the Med Bay (select it: a Train Medics button, its own queue).	–

264	Abilities (bottom right) should be aimed with right-click, not left	After picking heal, repair, charge, attack-move or patrol, you left-click the target; right-click cancels.	Aim them with right-click; left-click (or Esc) cancels.	Owner: all of them, building placement too (one rule: right-click aims, left-click cancels)

265	Engineers should path round gas on the way to plant a charge	Likely the charge walk-up ignores the gas map most moves use (to check).	Same route rules as a move: round toxic clouds.	–

266	Engineers shouldn't be called "Sapper"	Engineer teams are named "Sapper 1, 2…".	Name them like the others.	Owner: "Engineer Alpha" (Engineer Bravo, …)

267	Zombies should spawn round only ¾ of a hive, leaving a weak spot	They spawn at a random point all round it.	Each hive gets a gap (a quarter of the way round, its direction fixed per hive and visible on the model) where nothing spawns.	–

268	Hives: hurt by gunfire with a lot of health (more each level); only attacked when ordered; explosives and fire still best; at 0 health it drops a level with that level's full health, until a level 1 hive at 0 is destroyed	Only explosives and fire hurt a hive (500 / 750 / 1,000 / 1,250 health by stage); stages only go up; squads shoot hives on their own only with those weapons.	Bullets hurt hives; health per level raised a lot; squads never target a hive unless told to (right-click it); explosives and fire do extra to hives; at 0 health it loses a level (its spawning and waves drop too) and refills to that level's health; a level 1 hive at 0 dies. On the tuning page.	Owner: 3,000 / 4,500 / 6,000 / 8,000, explosives and fire ×3, and a lost level grows back over time

269	Medics: new animations and an SMG instead of the pistol	Medics use the pistol clips (few and they look bad) and a pistol model.	Medics use the soldiers' rifle animations with an SMG model in their hands (fitted in dev-rifle.html).	Owner: OK to cut an SMG from a model we already have

270	A button to bring the camera back to the main base	There's none: B selects the Barracks (and opens its card) but doesn't move the camera; you scroll or use the ops map.	A BASE button (with the minimap and top-right controls) and the Home key: the camera jumps to the Command Post; pressing it again goes back to where you were.	–

Round 23 \[v5.00] (playtester notes on v4.99; logged, not started; #279 added in v5.01)

\#	Note	Current state (from the code)	Proposed fix	Needs from owner

271	Click a "we lost a…" message to jump there	Radio messages are text only.	Messages about a place (a soldier or squad lost, a hive found, an outpost under attack) are clickable: the camera jumps to where it happened.	–

272	Units are still hard to select with a left click: it looks like you're on them but nothing happens	A click picks the squad whose centre point on the ground is within 28 px of the cursor. A squad's soldiers spread a few metres from that point and stand \~1.8 m tall, so clicking a soldier's body (or one standing off to the side) often misses, more so zoomed in.	Hit-test each soldier's on-screen body (feet to head, with a margin that scales with zoom), and the vehicle's outline for vehicles; the nearest hit wins.	–

273	Engineers should be able to restore the power station with zombies around	Work stops while any zombie is within 30 m of the station ("clear the yard").	Drop that rule: they keep working under attack (the zombies still go for them).	–

274	Riflemen can shoot through the power station	Only city buildings block line of fire; structures (the power station, Command Post, Barracks, Vehicle Bay…) don't.	Big structures block line of sight and fire like buildings (walls, sandbags and wire stay see-through: they're cover, not walls).	–

275	An idle vehicle that takes damage should move away	A parked vehicle just sits there and shoots.	When a vehicle with no orders is hurt, it drives a short way (\~15 m) away from the attackers, then stops; one with orders carries on.	–

276	Region labels on the ops map should match their state (contested, secured)	Ops-map labels say only RESTRICTED, SECURED or "N% infested"; the Districts panel also has CONTESTED and "CLEAR — build outpost".	The labels use the same states and colours as the Districts panel.	–

277	All units should gain health and damage as they level up	They already do, every squad and vehicle: +15% / +30% health and +10% / +20% damage at Regular / Veteran (Elite as Veteran, plus a soldier). It's small and not shown anywhere, which is probably why it doesn't show.	Bigger steps (e.g. +20% / +40% / +60% health and +15% / +30% / +45% damage at Regular / Veteran / Elite), shown on the squad's card, and on the tuning page.	Owner: yes (+20 / 40 / 60% health, +15 / 30 / 45% damage)

278	Walkers and runners shouldn't damage Humvees, only hold a stopped one in place; running zombies over should need momentum; only Boomers should hurt vehicles	Every zombie that reaches a vehicle hits it like a squad. Run-overs happen above 2.5 m/s.	Walkers and runners (and other non-explosive types) do no damage to vehicles; a pile of them round a stopped vehicle holds it (it can't pull away until it's cleared or reverses out); run-overs only above \~6 m/s (about half speed); Boomer (Bloater) explosions are what hurt vehicles (bosses later).	Owner: yes, \~6 m/s, and 6 zombies hold a stopped Humvee; Boomers hurt vehicles with their hits as well as their explosion (owner, v5.02)

279	Never seen a muzzle flash from a gun barrel	Muzzle flashes are drawn (since round 11) as glowing points whose size is set in metres, but the game's camera is orthographic, and for that camera three.js treats the size as pixels: each flash is 2–3 pixels across, invisible in practice (round 15's "make them bigger" changed 1.5 to 2.1 pixels). Found in the code; not seen on screen.	Size the flashes to the zoom (a fixed size in metres whatever the zoom), place them at the gun's actual muzzle (from the gun fit, as the Humvee's already is), a touch longer and brighter, with a brief light on the ground for big guns.	Owner (v5.03): every gun lights the ground briefly, not just the big ones

