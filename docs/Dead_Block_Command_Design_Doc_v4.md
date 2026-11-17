# DEAD BLOCK COMMAND
### Game Design Document — v4

> **Reclaim it block by block.**

A persistent, open-world-ish military RTS-lite set in a zombie-choked city. Build and maintain a force, push out from a safe base, establish outposts and field fortifications wherever engineers can reach, and reclaim the city through continuous battles.

**Current direction:** Single-player strategy and tactical action • Continuous city battlefield • Isometric 3D (clean, stylised; only loosely pixel-art influenced) • Browser-first development with desktop migration if needed.

**Document history**

| Version | Notes |
|---|---|
| v3 | November 2026 design review: map sequence, engineer construction rules, Elite armory access, hive progression. Revision addendum (§17–20): tutorial, open-world transition, region takeover. |
| **v4** | Addendum merged into the main body. Added: rooftops, tall walls, building destruction and rubble, vehicle crushing, AC-130, colored smoke, target priority, human faction (placeholder), day/night with flares, Little Bird, knockback, sheet-metal armor, artillery vehicles, Last Stand defeat, outpost resupply, artillery strike patterns, loudspeaker, Hawk rappelling, Elite cosmetics. New §21 priority roadmap. Table formatting fixed. |
| **v4.7** | Playtest round 4 logged (§22): 13 notes with likely causes and proposed fixes. No code changes in this revision. |
| **v4.6** | See-through buildings (any building hiding a squad, hive or build site fades out). Crowd navigation via shared flow fields (zombie sim ~30% cheaper; profiling says the sim isn't the bottleneck yet, so the Web Worker move is deferred until real-hardware tests say otherwise). Tutorial system + mission 1 script. |
| **v4.5** | Playtest round 3 (§22): continuous supply income (fixes outposts becoming unaffordable), Quonset barracks and roofed MG nest, tough base walls, full-length avenues, status badges, blood. Model-dependent notes parked. |
| **v4.4** | Playtest round 2 (§22): fixed hand-authored world layout confirmed (§2), engine/porting notes (§23), repair and resume building, Command Post support powers, shooter aggro, kill salvage, wider gunfire hearing, calmer hives, crowds of hundreds to thousands. Animated CC0 characters (Quaternius) with flipbook crowd rendering. |
| **v4.3** | Art direction: isometric first, pixel art dropped (only a loose influence). First procedural city pass: houses, apartments, motel, shops, warehouse, trees, streetlights, vehicles, painted roads. Optional glTF model overrides. |
| **v4.2** | Playtest feedback round 1 (§22): force-attack, middle-mouse camera rotation, rifle range, time-then-distance zombie aggro, HUD click fix, looser squads, weaker basic zombies, engineer deconstruction, car wheels, 12-minute days. Plus hive alarm and 3 s charge planting. |
| **v4.1** | §14 "Target look for the finished game" (art direction from reference images, scale, crowd tech, camera rotation). §16 adds the open production questions. MVP: gunfire is now heard well beyond sight. |

Where earlier wording conflicts with a v4 rule, the v4 rule wins. Every v4 change is marked **[v4]**.

---

## 1. Pitch and design pillars

Dead Block Command is a top-down/isometric RTS-lite. The player commands modern military units from a fortified safe zone on the edge of a ruined city. They produce squads and vehicles, send them into nearby streets, clear infestations, secure districts, set up outposts, and push deeper into the city. The city is one persistent battlefield, not a set of separately loaded missions.

- **One persistent city.** The player moves between a strategic overview and detailed street-level combat without loading separate district maps. Units must travel between the main base, outposts and operational areas.
- **Reclaim it block by block.** Infestation recedes, nests are destroyed, outposts are built, power is restored, and the map visibly changes as the city is retaken.
- **Command a force, not a spreadsheet.** Squads act on their own under clear orders. The player can take direct control of a selected squad, vehicle or helicopter when needed.
- **Every loss matters.** Infantry members are lost individually. A squad that is wiped out is gone for good, along with its experience.
- **Noise has consequences.** Gunfire, engines and heavy weapons attract attention. The player trades speed and firepower against the risk of drawing a bigger horde.
- **Build and hold.** Engineers build outposts and defensive structures. *(See §6: field fortifications can go anywhere.)*
- **The city fights back. [v4]** Buildings fall, rubble stays where it lands, night falls, and lost ground can be retaken by the horde.
- **Gritty but fun.** A ruined, atmospheric city, recognizable military-inspired hardware, readable combat and dry radio chatter.

**Format:** single-player real-time strategy with tactical direct control. **Working title:** Dead Block Command.

---

## 2. The city: one continuous battlefield

The city is built as one connected world. Districts are named regions of that world, not separate missions or maps. The player starts at a safe zone on the city's edge and must physically move forces out to the districts and back. The strategic map and the detailed battlefield are two views of the same simulation.

- **Seamless zoom.** Zooming into a street on the operations map shows the live battlefield. Zooming back out returns to the strategic overview while the simulation keeps running.
- **Fixed, hand-authored world [v4.4].** The city layout (roads, buildings, districts, hive sites, abandoned cars) is designed by hand and is **identical every time**, so the open world stays the same place you learn and reclaim. Nothing about the map layout is randomly generated. "Procedural" in this project only means the *look* of a building is built by code instead of loaded from a model file, and even that is seeded per building, so the same house always looks the same. Future districts are authored the same way (as map data), not generated.
- **Persistent consequences.** Soldiers lost, zombies killed, structures destroyed, vehicles damaged, hives cleared, fortifications built and **rubble created [v4]** all stay in the world.
- **No hidden auto-resolve.** Battles are simulated in the world. Progress comes from actual unit movement and combat.
- **Travel matters.** Units travel between base, outposts and districts. Outposts are forward positions, not teleporters.
- **Pause and speed.** Pause, or run at up to 4× speed.
- **Fog of war.** Unexplored areas show estimated infestation. Recon units reveal accurate information and give battlefield vision.

### District structure

The campaign opens with seven starter areas: three small starter zones (each 64 × 64 world units), then the remaining four starter districts arranged into two larger maps (two districts per map). These establish the core systems before hives and bosses are introduced. After that, the campaign expands into the larger district progression. The player can only push into territory connected to areas they already hold.

| District | Terrain / identity | Key progression or threat |
|---|---|---|
| Roadside Motel | Motel rooms, parking lots | Starter; Walkers |
| Gas Station Strip | Pumps and convenience stores | Starter; Walkers |
| Corner Market | Small shops and loading docks | Starter; Walkers, first Runners |
| Rail Siding | Boxcars and small depot | Starter; Walkers and Runners |
| Trailer Park | Tight rows, little cover | Starter; Runner packs |
| Parking Garage | Stacked decks and ramps | Starter; first Bloaters |
| Fire Station | Garage bays and open yard | Starter stronghold |
| Checkpoint | Fortified highway interchange | First full-size district; Walkers and Runners |
| Suburbs | Houses, fences, back yards | Runner packs; Barracks upgrade |
| Main Street | Narrow shops and alleys | Hives; Armory unlock |
| Industrial Park | Warehouses and rail yard | Bloaters; Repair and Armor Stations |
| Hospital Row | Tight wards and parking decks | Screamers; Medbay; The Matron |
| Harbor | Docks and container stacks | Brutes; Flame and Mortar Teams |
| Stadium | Large open bowl and stands | Dense crowds; advanced armor |
| Airport | Runways and hangars | Airfield unlock; The Dispatcher; **human faction [v4]** |
| Downtown Core | Skyscraper canyons | Final district; Patient Zero; **human faction [v4]** |

The Airport must be reached and its Airfield unlocked before the endgame. The player needs a real chance to use the Airfield's unlocks before entering Downtown Core. It must not be an optional late unlock with no practical payoff.

### Infestation and district security

- Each district has an infestation meter from 0–100%. Killing zombies drains it slowly; destroying hives drains it fast. Infestation cannot reach zero while a hive remains.
- At 0% infestation, an Engineer Team can establish an outpost and the district becomes secured.
- Secured districts generate funds over time and provide forward operating positions.
- Some districts contain power stations. Engineers must reach and hold the generator room for about three minutes to restore power. This is loud and can draw a horde.
- Restoring power unlocks or upgrades a related base building.
- If zombies retake a district, the outpost is replaced by a hive (see §19).

---

## 3. Core gameplay loop

The loop is **produce → deploy → clear → secure → reinforce**. Every step happens in the same continuous city, connected by travel, supply upkeep and persistent combat.

| Stage | Player activity |
|---|---|
| Produce | Spend money and supplies to create squads and vehicles at the main base. |
| Deploy | Move a force through the city toward a district or existing outpost. |
| Clear | Fight through streets, destroy hives, manage noise, use cover, deal with special zombies. |
| Secure | Reduce infestation to zero and have engineers establish an outpost. |
| Reinforce | Build defenses, **resupply outposts [v4]**, repair or restore units, prepare the next push. |

Pacing targets (not fixed lengths): full-size district 30–45 minutes, starter district 10–15 minutes.

---

## 4. Controls and command system

Conventional RTS selection and orders, plus an optional direct-control mode. Orders apply to the selected squad, vehicle or helicopter unless a command applies to a formation.

| Input | Command | Behavior |
|---|---|---|
| TAB | Direct control | Take direct control of the selected squad, vehicle or helicopter. A squad is controlled as one unit. |
| Left-click and drag | Box select | Select multiple friendly units. |
| Right-click terrain / map | Move | Walk or drive to the location. Works from the minimap or full map. |
| Right-click cover | Take cover | Infantry move to the cover position and fight from it. |
| Right-click building **[v4]** | Garrison / roof | Elite infantry enter the building and take the roof (see §5). |
| Right-click zombie **[v4.2]** | Force attack | Selected units close to range and shoot that zombie, overriding threat priority. |
| Middle-mouse drag **[v4.2]** | Rotate camera | Free rotation. Q / E snap 90°. Shift + middle-drag pans. |
| X then click **[v4.2]** | Deconstruct | Engineers take down something they built (see §6). |
| M | Operations map | Full map: units, base, districts captured and uncaptured, fog of war. |
| A + click | Attack-move | Move toward a destination, engaging enemies that come in range along the way. |
| Sneak | Quiet movement | Move as quietly as possible; ignore zombies unless they get danger-close. |
| Patrol | Patrol route | Cycle between waypoints, scouting, keeping vision and intercepting. |
| H | Hold position | Stay put; fire at enemies in range without chasing. |
| S / Stop | Cancel | Cancel current movement or production-queue action. |
| Shift + click | Waypoint queue | Add waypoints; units follow them in order. |
| Ctrl + right-click / drag-line | Formation move | Lines, circles or custom spacing while moving. |

Formation movement should give sensible spacing and facing without micromanagement. Start with reliable line formations and custom spacing; add shapes later.

### Direct-control behavior

Direct control is an optional layer on top of squad autonomy. The controlled squad moves and fights by player input; on release it goes back to its normal behavior. Vehicles and helicopters work the same way. Exact input mapping for movement, aiming and firing is still to be finalized.

---

## 5. Squad behavior, cover, and formations

Squads fight on their own when not directly controlled. They pick targets, hold ground, use cover and follow the current order. Vehicles and helicopters lean more on explicit orders but still defend themselves.

- Infantry benefit from cover: concrete barriers, walls, cars, sandbags. Cover reduces incoming damage and shapes firing lanes.
- Right-clicking cover orders infantry to occupy it and fight from there.
- Hold Position stops units chasing targets.
- Attack-Move advances while engaging threats on the way.
- Sneak suits recon and quiet approaches; units still defend themselves against immediate danger.
- Patrol routes keep local vision and intercept enemies.
- Vehicles and helicopters hold and engage nearby threats when idle, and should return to base (RTB) when servicing is needed.

### Squads that look alive [v4.2]

Squad members are not welded to formation slots. Each soldier drifts around their slot, moves at their own pace (squads string out on the move and bunch up on arrival), mills about when idle, and glances around when holding. Holding or in cover keeps them tighter.

### Target priority and focus fire [v4]

Units **pick one target and keep firing at it until it is dead** instead of spreading fire across a crowd. Picking a new target is driven by threat:

1. **Danger-close first.** Whatever is closest and about to reach the unit.
2. **Then high-threat targets** in range: bosses, then dangerous specials (Dragger mid-pull, Bloater near friendlies, Brute, Puker, Screamer).
3. **Then everything else**, nearest first.

A unit only drops its current target early if (a) the target dies or leaves range, or (b) something enters danger-close range and outranks it. This stops wasteful switching while keeping squads from being overrun. Squads share a target where possible so members finish targets quickly.

**Forced target [v4.2].** Right-clicking a zombie orders the selected units to attack it. They move until it is in range and visible, then shoot only it (ignoring the priority rules) until it dies.

### Elite rooftop access [v4]

**Elite infantry** can enter buildings and take up positions on the roof. Rooftops give range, vision and protection from ordinary melee. **They are not safe:** zombies can pile up against a building and climb onto the roof (see §9, pile-ups). A rooftop is a strong position, not an invulnerable one. If the building is brought down (§6a), units inside or on top are crushed.

### Explosion knockback [v4]

Very close explosions knock back **both zombies and friendly units**. Knockback interrupts actions (firing, building, Dragger pulls), can push units out of cover, and can throw zombies off pile-ups and walls. Grenades, artillery, tank shells, bombs and Bloater bursts all apply knockback by distance from the blast.

---

## 6. Main base, outposts, and fortifications

The main base is the player's safe zone and main production center. It starts with a Command Post, Barracks and Supply Depot, with room for more facilities. The base grows as power is restored in key districts.

| Building | Function | Unlock / upgrade |
|---|---|---|
| Command Post | Command cap; strategic support abilities | Starts at base; level 2 tied to Airport progression |
| Barracks | Trains basic infantry squads | Starts at base; level 2 from Suburbs |
| Supply Depot | Stores and manages supplies | Starts at base; level 2 from Harbor |
| Armory | Trains heavy weapons teams; Elite customization **and cosmetics [v4]** | Main Street; level 2 from Harbor |
| Repair Station | Services and repairs vehicles; **sheet-metal armor upgrade [v4]** | Industrial Park |
| Armor Station | Builds ground vehicles | Industrial Park; level 2 from Stadium |
| Medbay | Restores lost squad members at base | Hospital Row |
| Airfield | Builds helicopters; unlocks air-support abilities | Airport |

### Outposts

- An Engineer Team establishes an outpost after a district is cleared. Build-time target: about 30 seconds.
- Outposts are forward positions with a radio and a defensive perimeter.
- Outposts can be upgraded with barricades and a machine-gun nest.
- Units travel to outposts through the world; no teleporting.
- An outpost taken by zombies becomes a hive (§19).

### Command Post support powers [v4.4]

Click the Command Post to open its support panel. Each power costs money, has a cooldown, and is marked on the ground with its own smoke colour before it arrives (§8).

| Power | Smoke | Effect | Availability |
|---|---|---|---|
| Artillery Barrage | White | 8 shells over ~4 s across a 10 m radius; knockback; hurts friendlies too | Command Post (playtest: from the start; later gated by base progression) |
| Supply Drop | Green | Crate parachutes in (+45 supplies); a squad must reach it to collect | Command Post |
| Gun Run / Bombing Run / AC-130 | Red / Orange / Purple | See §8 | Airfield |

### Outpost resupply [v4]

Outposts **hold their own local supply stock**. Building defenses at an outpost, and rearming or servicing units there, draws from that stock rather than from the global pool directly. When the stock runs out, the outpost cannot build or rearm until it is resupplied.

- Resupply is delivered by **Supply Truck**, **Hauler Helicopter**, or (later) **airdrop**.
- Supply runs travel through the world and can be ambushed, which makes supply lines worth defending.
- This does **not** add ammo or fuel as resources (§11 still holds). It limits *where* the global supply pool can be spent.

### Engineer construction

Engineers can build predefined defensive structures **anywhere on the map**, not only at the base or outposts: roads, intersections, bridges, chokepoints, cleared buildings. An Engineer Team must be present, and building costs money and supplies. Bases and outposts are still the important production, resupply and service locations.

| Structure category | Examples / purpose |
|---|---|
| Placed weapons | Mounted machine guns, grenade-launcher emplacements, other unlockable weapons |
| Cover | Sandbag walls, concrete barriers |
| Area denial | Barbed wire and similar obstacles that slow or funnel zombies |
| Tall concrete walls **[v4]** | Expensive ~40 ft walls (see below) |
| Lure **[v4]** | Craftable loudspeaker (see below) |
| Base defenses | Sniper towers, mounted HMGs, mounted grenade launchers, mounted flamethrowers |
| Strategic support | Artillery strikes on districts, unlocked through base progression |

**Repair and resume [v4.4].** Right-click your own structure with engineers selected: an unfinished site is picked back up where it was left (a new order no longer throws the work away), and a damaged structure is repaired over roughly its build time, paying supplies as the crew works (about half the structure's supply cost for a full bar). Unfinished and damaged structures show a progress/health bar.

**Deconstruction [v4.2].** Engineers can take down anything the player built (not base facilities). An unstarted construction site refunds in full; a finished structure refunds half its cost and takes half its build time to dismantle. Dismantling your own outpost gives up the district quietly. Only a zombie takeover turns it into a hive.

**Tall concrete walls [v4].** Very expensive, slow-to-build walls about forty feet tall. They are the **one exception** to the pile-up rule: zombies cannot pile high enough to get over them. They are the "hold this forever" option, priced so they can't ring the whole city. They can be destroyed by explosives, Brutes and bosses (balance TBD).

**Loudspeaker [v4].** A craftable device engineers place to broadcast noise. It **pulls zombies toward one area**: into a kill zone, away from a weak outpost, or under an artillery strike. It is loud by design, so it also feeds the district's noise level and may draw more than you planned for. It has health and can be destroyed.

### 6a. Destruction, rubble, and the changing battlefield [v4]

- **Building destruction.** Buildings can be brought down by:
  - a direct hit from a plane-dropped bomb,
  - several direct tank shots,
  - fire burning over time.
- **Collapse crushes** everything inside or next to the building: **friendlies and zombies alike**. Elite units on a roof go down with it.
- **Rubble is permanent.** It changes the battlefield for good: blocking streets, creating new cover, opening or closing routes and chokepoints. Collapsing a building can seal a street against a horde, or cut off your own supply route.
- **Tanks crush static cars.** Battle Tanks (and later heavy armor) flatten parked and abandoned cars, removing them as cover and obstacles. Lighter vehicles must go around.
- Wrecked player vehicles still block the street until cleared (see §7 vehicle damage).

---

## 7. Unit roster and progression

The core unit roles and unlock structure stay the same. The roster covers infantry, support, armor, transport and aviation. Costs, command weights and upkeep are balance values.

| Unit | Role | Unlock / notes |
|---|---|---|
| Rifle Squad (4) | All-round infantry | Starting unit; main early-game force |
| Engineer Team (2) | Builds outposts and defenses; restores power; patches vehicles | Starting unit |
| Medic Team (2) | Restores lost members to nearby squads over time | Suburbs / Barracks level 2 |
| Recon Pair (2) | Quiet, fast scouts with long vision | Suburbs / Barracks level 2 |
| Machine Gun Team (3) | Crowd suppression; slow movement | Main Street / Armory |
| Sniper Team (2) | Long-range precision against dangerous targets | Main Street / Armory |
| Flame Team (3) | Burns hives and packed hordes at short range | Harbor / Armory level 2 |
| Mortar Team (3) | Indirect fire; strongest when positioned at an outpost | Harbor / Armory level 2 |
| Gun Jeep (HMMWV-inspired) | Fast scout and harasser with mounted MG | Industrial Park / Armor Station |
| Supply Truck (HEMTT-inspired) | Moves squads and supplies; **outpost resupply [v4]** | Industrial Park / Armor Station |
| LAV (M2 Bradley-inspired) | Armored carrier with autocannon; mobile cover | Stadium / Armor Station level 2 |
| Battle Tank (M1 Abrams-inspired) | Heavy siege vehicle; drives through crowds; **crushes cars, can bring down buildings [v4]** | Stadium / Armor Station level 2 |
| Self-propelled howitzer (M109 Paladin-inspired) **[v4, candidate]** | Long-range tracked artillery; strike patterns (below) | Proposed: Stadium / Armor Station level 2 |
| Rocket artillery truck (M142 HIMARS-inspired) **[v4, candidate]** | Long-range precision rocket salvos | Proposed: Airport / late game |
| Hawk Helicopter (Black Hawk-inspired) | Transport with door miniguns; **squads can rappel [v4]** | Airfield |
| Sparrow light helicopter (Little Bird-inspired, placeholder name) **[v4]** | Fast light helo with miniguns; carries 4 infantry on side benches | Airfield |
| Hauler Helicopter (Chinook-inspired) | Transports squads and supplies; evacuates wounded | Airfield |
| Hornet Gunship (Cobra-inspired) | Light controllable gunship for strafing and scouting | Airfield |
| Anvil Gunship (Apache-inspired) | Heavy controllable gunship for dangerous targets | Airfield |

**Rappelling [v4].** Infantry can fast-rope from a hovering Hawk onto rooftops or streets without the helicopter landing. That avoids landing in a horde, but the Hawk must hover low and still while troops go down, which exposes it to clinging Walkers and Runners (§9).

**Artillery strike patterns [v4].** Artillery units (Mortar Team, howitzer, rocket artillery, and the base artillery strike) can fire in selectable patterns:

| Pattern | Use |
|---|---|
| Point | Concentrated fire on one spot: hives, bosses, buildings |
| Line / creeping barrage | A strip of fire that walks along a street toward or away from a position |
| Area / box | Spread fire across a block to thin a horde |
| Ring / perimeter | Fire around a friendly position to break an encirclement |

Which units get which patterns is a balance decision. Artillery is loud.

### Squad losses and leveling

- Infantry squads have two to four individual members. Squad health is split among members; losing a member costs that member's share of health and firepower.
- A squad with no members left is permanently lost, along with its experience and level.
- Squads gain experience from kills, boss kills and taking part in cleared districts.
- Progression: **Recruit** (base) → **Regular** (+15% health, +10% damage) → **Veteran** (+30% health, +20% damage) → **Elite** (choose one of two class-specific paths).
- The Rifle Squad's Elite paths come first: an M320 grenade-launcher path (**Grenadier Squad**) or an incendiary-ammunition path (placeholder **Cinder Squad**). Other classes get paths later.
- **[v4]** Elite status also unlocks **rooftop access** (§5) and **cosmetic customization** (below).

### Elite armory access and customization

Reaching Elite unlocks Armory access for that unit. Elite units can visit the Armory to customize weapons and unlock more weapon options: attachment slots such as grips, flash hiders, extended magazines and sights; alternate rifles and other weapon classes as the campaign progresses. Weapons and attachments are set **per infantry member** where supported.

**Visual and clothing customization [v4].** At the Armory, Elite units can also change their look: uniforms and camo, headgear, patches, face gear and similar options, per member where supported. This is cosmetic only and has no stat effect. It exists to make players attached to soldiers they can lose.

### Vehicle leveling and upgrades

Vehicles that survive and stay in service earn experience and level up. Level bonuses and upgrade paths are still to be designed. Vehicles do level; they are not static purchases. Damage stays visible and affects performance.

| Vehicle health | Visual state | Effect |
|---|---|---|
| 75–50% | Dented; light smoke | ~15% slower |
| 50–25% | Panels damaged; heavy smoke | ~30% slower; secondary systems may go offline |
| Below 25% | Burning | ~50% slower; main weapon fires at reduced rate |
| 0% | Wreck | Vehicle lost; blocks the street until cleared |

**Sheet-metal armor [v4].** A Repair Station upgrade that bolts sheet metal onto a vehicle's exterior. It **stops zombies climbing onto the vehicle** and **adds health**. The trade-off (cost, some speed loss, visible scrap-armor look) is a balance decision.

---

## 8. Airfield and air support

The Airfield is unlocked by securing the Airport and restoring its power. It provides controllable helicopters and unlocks aircraft and drone support abilities. Support aircraft do not replace the helicopters.

| Air asset | Control model | Function |
|---|---|---|
| Hawk Helicopter | Controllable unit | Transport with door miniguns; rappel deployment [v4] |
| Sparrow light helo [v4] | Controllable unit | Fast minigun helo carrying 4 infantry |
| Hauler Helicopter | Controllable unit | Transports squads and supplies; lands in suitable areas; evacuates wounded |
| Hornet Gunship | Controllable unit | Fast light gunship; chain-gun strafing; limited endurance |
| Anvil Gunship | Controllable unit | Heavy gunship; rocket pods for Brutes, hives and bosses; limited ammo |
| Heavy attack plane (placeholder name) | Air-support ability | A-10-style gun run that levels a large stretch of zombies along a line |
| Fast fighter (placeholder name) | Air-support ability | F/A-18-style bombing run; HE or incendiary bombs; **direct hits can collapse buildings [v4]** |
| AC-130 gunship **[v4]** | Air-support ability | ~90-second orbit using its full weapon set (25 mm, 40 mm, 105 mm). Very expensive, very effective. |
| Patrol drone | Placed / autonomous ability | Patrols a district and automatically attacks hordes it detects |

- Support abilities have real cooldowns, costs or limits so they stay powerful without replacing ground forces.
- The heavy plane does a broad gun run; the fast plane does a bombing run with an HE or incendiary choice.
- The AC-130 is the most expensive call-in. Over its orbit it automatically engages zombies in a target circle the player can move. Its 105 mm counts as a heavy explosive (knockback, hive damage, building damage).
- The drone patrols a district and attacks hordes automatically. Duration, ammo, health and redeployment are balance values.
- Controllable gunships have limited ammo and must return to the Airfield to rearm. Helicopters and vehicles use RTB/servicing rather than a fuel system.
- The Airport unlock must come early enough before Downtown Core for the player to make real use of it.

**Colored smoke marking [v4].** Every aircraft call-in is marked on the ground with a **colored smoke** grenade before the strike arrives. Each call-in type has its own color, so the player (and the battlefield) can read what's coming:

| Call-in | Smoke (proposed) |
|---|---|
| Heavy attack plane gun run | Red |
| Fast fighter bombing run | Orange |
| AC-130 orbit | Purple |
| Artillery barrage (Command Post) **[v4.4]** | White |
| Supply / upgrade airdrop | Green |
| Helicopter LZ / extraction | Yellow |

At night, smoke is replaced by or paired with matching **flares/strobes** so marking stays readable.

---

## 9. Zombie roster and behavior

The roster mixes basic crowd threats, tougher special types, persistent hives and bosses. Specials have more health than Walkers and Runners, but not so much that they feel like bosses. Bosses are a separate tier and appear after the opening sequence.

| Zombie | Behavior / threat | Counterplay |
|---|---|---|
| Walker | Slow, weak alone, dangerous in crowds | Machine guns, flame weapons, vehicle run-over |
| Runner | Fast and weak; sprints toward noise | Rifle squads in cover; vehicle run-over |
| Bloater | Slow, swollen; bursts into a toxic cloud when killed | Snipers at range; don't kill it next to friendly squads. Cloud is flammable. |
| Screamer | Hangs back and shrieks, filling the noise meter | Snipers or fast recon |
| Brute | Armored, hits hard, resists rifle fire | Snipers, Battle Tank, Anvil Gunship |
| Dragger | Long tongue wraps one infantry member and drags them off; the member dies if the pull lasts long enough. Any damage to the Dragger makes it let go. Can damage vehicles and helicopters but can't pull them. | Kill or damage it fast to break the pull |
| Puker | Spits acid that stays on the ground for ~3 seconds; can hit armor and helicopters | Avoid contaminated ground; kill it before it blocks movement |
| Hive | Infested structure that spawns zombies while active | Fire or explosives only; small arms can't destroy it |

### Hive progression and destruction

Hives spawn zombies for as long as they're active. Each hive moves independently through four permanent threat stages and never goes back down. Its stage is visible on the map/intel view.

1. **Dormant:** small groups spawn now and then, roaming close to the hive.
2. **Growing:** spawns come faster; bigger groups roam and threaten nearby infrastructure.
3. **Established:** much higher production and roaming; nearby defenses are under constant pressure.
4. **Overrun:** maximum production; large roaming hordes that can overwhelm nearby positions.

Hives can only be destroyed with fire or explosives: incendiary weapons, Flame Teams, grenades, charges, rockets, artillery, air-delivered ordnance. Destroyed hives never respawn. Destroying a hive does not spawn a boss; bosses are separate campaign events.

For performance, each hive has a spawn budget and counts toward a global active-zombie cap. When the cap is reached, hives pause or slow spawning. The cap and spawn rates are balance values.

### Horde behavior and environmental threats

- Horde pulses grow with the difficulty of the region sending them.
- **Noise** is a core mechanic. Weapons, engines and loud actions raise a noise level that attracts hordes. Quiet weapons and Sneak lower detection. **Loudspeakers [v4]** use this on purpose.
- **Aggro [v4.2]: time first, then distance.** A zombie that has seen a squad hunts it for ~20 s even after losing sight (it keeps pathing toward the squad), then keeps coming while the squad is within ~60 m. Simply running away no longer shakes them; breaking contact takes distance *and* time.
- **Getting shot makes them angry [v4.4].** A zombie that's hit turns on whoever shot it (unless it's already biting someone), even from beyond its sight. Fixes Bloaters sometimes ignoring fire.
- **Hive alarm [v4.2].** A squad within ~20 m of a hive draws every zombie around the hive (~45 m) onto it. Charges are planted over 3 s and getting hit restarts the plant, so engineers need covering fire. (Playtest bots found that a lone engineer could sprint past walkers and one-shot a stage-1 hive.)
- **Pile-ups.** Zombies can pile up and climb over each other to get over barricades, vehicles, small buildings **and onto rooftops [v4]**. Height and barriers don't guarantee safety. **Exception [v4]:** tall concrete walls (§6) are too high to pile over.
- Walkers and Runners can cling to helicopters hovering low or landed, which makes low hovering, landing **and rappelling [v4]** risky in infested areas.
- Vehicles can run over Walkers and Runners without taking damage. Specials such as Pukers and Draggers can damage vehicles. **Vehicles with sheet-metal armor [v4]** can't be climbed.
- Soldiers killed by the horde can rise again as zombies.
- **[v4]** Zombies are knocked back by close explosions and crushed by collapsing buildings.

### Bosses

From Hospital Row on, each major district has a boss with a trait that counters a standard tactic. Bosses drop a reward item.

| Boss | District | Defining mechanic |
|---|---|---|
| The Matron | Hospital Row | Heals nearby zombies and raises downed ones until killed |
| The Foreman | Harbor | Throws shipping containers from range, changing cover and blocking streets |
| The Stampede | Stadium | A stadium-sized horde charges the loudest sound |
| The Dispatcher | Airport | Coordinates Runner waves; makes noise especially dangerous in the district |
| Patient Zero | Downtown Core | Calls surviving hives across the city into the final fight |

The Bloater's toxic cloud is flammable. Flame Teams or incendiary ammo can ignite it for a powerful area attack that can also hurt friendly units.

### 9a. Human enemy faction [v4, to be designed]

The **last two zones** (assumed to be **Airport** and **Downtown Core**; to confirm) add a **hostile human faction** alongside the zombies. This is the first enemy that shoots back, uses cover and makes noise of its own. Three-way fights (player vs. humans vs. zombies) are expected.

Open questions:

- Who are they? (Deserters, a militia, a private security contractor, a cult around Patient Zero?)
- Unit roster, vehicles, and whether they have air defense that threatens the Airfield's aircraft.
- Do they hold territory and outposts the player can capture?
- Do they ever fight zombies, or does the horde ignore them?
- Can they be negotiated with or recruited (tie-in with Guerrillas, §10)?

**Framework note:** combat code must support **faction-vs-faction** targeting from day one (not just "player vs. zombie") so this faction can be added without a rewrite.

---

## 10. Civilians and guerrilla recruits

Civilians are sometimes found hiding in buildings or other spots in infested districts. Rescuing and evacuating them gives the player a reason to explore and secure areas, not just chase hives and kill counts.

- Successful evacuation can reward money and supplies.
- Some rescued civilians may volunteer as a special unit type: **Guerrillas**.
- Guerrillas are a distinct recruitable unit, not a replacement for trained infantry. Weapons, strengths and recruitment limits are to be designed.
- Rescues should be occasional, not guaranteed in every district.

---

## 11. Economy, upkeep, and servicing

Two resources: **money** and **supplies**. Money is harder to get and is the main limit on expansion. Supplies are easier to come by and pay for unit creation, daily upkeep, repairs and restoring squad members. Ammo and fuel are not resources the player has to buy.

| Resource | Earned from | Spent on |
|---|---|---|
| Money ($) | Secured-district income, one-time clear rewards, civilian evacuations, searched buildings | Recruiting units and vehicles, construction, air-support calls |
| Supplies | Base/outpost income, supply crates, cleared buildings, district rewards | Unit production, daily upkeep, repairs, restoring lost members, **outpost stock [v4]** |

- **Kill salvage [v4.4].** Every kill pays a little: Walkers and Runners $1 + 1 supply, Bloaters $4 + 3, Screamers $3 + 2, Brutes $10 + 6 [v4.5]. Fighting pays for itself a bit; holding a secured district still pays far better.
- **Supply income is continuous [v4.5]** (+9/min from the base depot, +5/min per secured district), not a lump at day's end, so the 12-minute day never starves the opening.
- Each active unit costs supplies once per in-game day. This is a predictable upkeep payment, not a constant drain during combat.
- Supplies are not spent on ammo or fuel.
- Vehicles still RTB for servicing and rearming where relevant. RTB is a behavior, not a fuel minigame.
- Repairs and restoring lost infantry use supplies.
- Supplies should be far easier to get than money; the player is mainly limited by money and force capacity.
- Supplies are one shared pool for the whole force. **[v4]** Outposts keep a local stock filled from that pool by physical resupply (§6).

### Starting economy and balance targets

Original target: **$250**, **100 supplies** (150 storage cap), **command cap 8**, with two Rifle Squads and one Engineer Team. To be revisited once upkeep and supply costs are in.

### Horde counterattacks

Infested neighboring districts send horde pulses toward the nearest outpost now and then. Target cadence: about every four minutes. The loudest neighbor sends the biggest pulse, and pulse size scales with the difficulty of the source region. Garrisons and defenses help hold them off.

### Airdrop upgrades [v4, open question]

Proposal under consideration: support items and upgrades (supply crates, ammo/equipment crates, field-upgrade kits, reward items) can be **airdropped** to a green-smoke-marked location instead of collected at base. The drop lands in the world and must be secured before zombies (or the human faction) reach it.

- Is this a paid call-in, a reward, or both?
- Can airdrops deliver "upgrades" (e.g. sheet-metal kits) to units in the field, or only supplies?

---

## 12. Unlocks and campaign progression

Unlocks are driven mainly by restoring power in key districts, not by a big tech tree. Securing districts gives income, experience and occasional reward items. Restored power ties campaign progress to base facilities and new unit types.

| Progress point | Unlock / reward |
|---|---|
| Suburbs power | Barracks level 2; Medic Team and Recon Pair |
| Main Street power | Armory; Machine Gun Team and Sniper Team; **loudspeaker [v4]** |
| Industrial Park power | Repair Station and Armor Station; Gun Jeep and Supply Truck; **sheet-metal armor [v4]** |
| Hospital Row power | Medbay; restores lost squad members at base |
| Harbor power | Armory level 2; Flame Team and Mortar Team; larger Supply Depot |
| Stadium power | Armor Station level 2; LAV and Battle Tank; **howitzer (candidate) [v4]**; **tall concrete walls (proposed) [v4]** |
| Airport power | Airfield: Hawk, **Sparrow [v4]**, Hauler, Hornet, Anvil; air-support abilities incl. **AC-130 [v4]** |
| Downtown Core | Final district; securing it and defeating Patient Zero wins the campaign |

Command Post level 2 and artillery support connect to Airport / late-campaign progress. The Airport must be available before the final district.

### Reward items

About one district in three, and every boss, drops a one-off reward item: suppressor kits, ceramic plates, thermal optics or other squad equipment. Items are assigned to a squad and specialize the force.

---

## 13. Win conditions, defeat, and base security

- **Win:** secure Downtown Core and defeat Patient Zero.
- **Squad wipe:** a squad that loses every member is permanently gone, including its experience.
- Losing outposts costs income and territory and can let hives back in (§19), but does not end the campaign by itself.

### Last Stand defeat mode [v4]

*(Replaces v3's "future endgame base-breach challenge" and "main base cannot be destroyed".)*

Because zombies can retake regions through hives (§19), a player who keeps losing ground can be **pushed all the way back to the main base**. When the last outpost falls and the horde reaches the base, the game triggers a **Last Stand**:

- A scripted, high-intensity defense: a huge horde attacks the base for a **set amount of time**.
- Clear warning beforehand (radio chatter, map alert, a short countdown to prepare).
- **Survive:** the horde breaks, pressure eases, and the player **gets another chance to retake the city**. Survivors keep their experience.
- **Fail:** the base falls. *Open question: campaign over, or restart from a checkpoint/earlier save?*

Open questions: can a Last Stand happen more than once? Does each one get harder? Should surviving give a breather (hives pause briefly, emergency supply drop)?

---

## 14. Visual and audio direction

**[v4.3] The game is isometric first, not pixel art.** It is a clean, full-resolution, anti-aliased 3D isometric world with stylised low-poly detail. Pixel art is at most a loose influence (chunky shapes, bold readable silhouettes, a little crunch in textures); there is **no pixel filter or low-res rendering**. It should feel like a detailed miniature battlefield, not flat sprites or a voxel game.

- **Camera:** isometric, with smooth zoom between strategic overview and close battlefield view.
- **World:** detailed ruined streets, buildings, interiors, vehicles, vegetation, debris, fortifications, **permanent rubble [v4]**.
- **Materials:** stylised flat-shaded colours and simple textures, chunky geometry, crisp edges, controlled detail.
- **Lighting:** directional light, shadows, muzzle flashes, fire, smoke and atmosphere communicate time, danger and activity.
- **Readability:** friendlies, zombies, cover, attack ranges and formations must stay easy to tell apart at both zoom levels, **day and night [v4]**.
- **Animations:** infantry moving and firing, vehicle damage, helicopter landing/hovering, zombie swarms, climbing piles, Dragger pulls, Puker acid, **rappelling, building collapse, knockback, colored smoke [v4]**.

**Palette:** desaturated greys, browns, muddy teal, olive and tan for military units; sickly yellow-green for zombies. Red is reserved for infestation and danger.

### Target look for the finished game [v4.1]

The current MVP visuals (code-built boxes) are placeholders for testing. The finished game aims for a **detailed, sun-lit miniature city seen from a high isometric angle**, based on reference images supplied in November 2026. Concretely:

- **Real scale.** Soldiers are small next to the world: a two-storey house is several times a soldier's height, and streets are wide multi-lane roads with sidewalks, crosswalks, streetlights and parked cars. The city should feel big and the squads should feel vulnerable in it.
- **Detailed, readable buildings.** Suburban houses with pitched tile or shingle roofs, porches, balconies, garages and fences; flat-roofed apartments and commercial blocks with rooftop clutter (AC units, solar panels); warehouses, an airfield and a desert outskirts biome. Palm and leafy trees, hedges, scrub, lawns.
- **Lighting carries the mood.** One strong sun with long, crisp shadows; a warm/neutral midday and an orange-brown dusk grade; at night, floodlights, searchlights, flares, muzzle flashes and fires do the lighting (ties into §14 day/night and the flare launcher).
- **Massive crowds.** Hordes are dense carpets of individual zombies: hundreds on screen routinely, **thousands** at a Last Stand and around neglected hives. Blood spatter on asphalt, bodies and debris persist. **[v4.4]** Implemented first pass: animated CC0 characters drawn with flipbook instancing (a few draw calls for any crowd size), corpses that lie where they fell, a 1,500-zombie cap, and Overrun hives that grow toward 300 locals.
- **Spectacle that stays readable.** Tank muzzle blasts, red tracer streams, explosion fireballs with sparks, rising black smoke columns from wrecks, dust clouds, helicopter rotor wash and fast-ropes, jets with afterburners on strike runs, artillery pieces with visible crews.
- **Fortified bases look built.** Tall modular walls with walkways and turret blocks, sandbag rings, gun pits, floodlight towers, vehicle gates.
- **Labels on units.** Small callsign tags with health pips over squads, vehicles and aircraft (e.g. `SQ-14`, `TK-1`, `UH-3`), and distance markers for off-screen SOS/objectives.
- **Camera.** Smoothly **rotatable** in 90° or free steps (compass readout), plus zoom from street level to a wide overview.

**UI direction** (standard RTS conventions, styled to fit): a bottom strip of unit cards (portrait, callsign, health pips, filter tabs for ground/air), a support panel listing call-ins with remaining uses, a minimap with compass and legend, a top-centre day clock with "dusk in mm:ss", and a contextual construction bar (walls, defence, fire support, supply, lighting) with blueprints and placement help.

**What this means for production** (decisions needed; see §16):

1. **Art assets.** Code-generated boxes won't get there. The look needs modelled and textured 3D assets: buildings, vehicles, aircraft, props, soldiers and zombies with animation. Options: model in-house (e.g. Blender), license asset packs that match the style, or commission an artist. Whichever we choose, the renderer will load glTF models in place of the placeholder meshes; sim code doesn't change.
2. **World scale — DECIDED.** **1 world unit = 1 metre.** Navigation uses a 3 m grid, so a "64 × 64" starter zone is 64 × 64 grid cells = **192 × 192 m**. Soldiers are 1.8 m, cars 4.6 m, buildings 6–15 m. Speeds and weapon ranges were doubled together (so fights close at the same pace) while the map grew 3×, and hearing scales with the map.
3. **Crowd tech.** Thousands of zombies needs GPU-instanced, vertex-animated zombie meshes plus flow-field pathing, with the simulation in a Web Worker. This is the single biggest performance item and is the most likely trigger for the "move to desktop" decision in §15.
4. **Camera rotation — DONE.** Q / E rotate in 90° steps with a compass readout. Building see-through/cutaway when a building hides units is still to do.

### Day/night cycle [v4]

*(Moved up from "deferred"; now a planned feature.)*

- A full day/night cycle tied to the in-game day (and the daily upkeep tick).
- **Night** cuts vision ranges, makes fog of war denser, and makes zombie behavior more dangerous (balance TBD: more active, bigger pulses).
- **Flares** light up an area for a limited time. They can be fired by infantry, launched from outposts, or dropped by aircraft. Flares are noisy-bright: they may draw attention (balance TBD).
- Vehicle and helo spotlights, muzzle flashes and fires become important light sources.
- Colored smoke marking switches to flares/strobes at night (§8).

### Audio

- Low-fi, grimy synth drones that swell as noise and horde pressure rise.
- Distinct weapon sounds; layered zombie groans that grow with horde size.
- Engine and aircraft audio feed the atmosphere and the noise system.
- Gritty, dry radio chatter with occasional dark humor.

Sample lines:
- Engineer: *"Give me thirty seconds and a lot of sandbags."*
- Machine Gun Team: *"I brought enough ammo to be rude."*
- Medic: *"Stay down. That's medical advice and an order."*
- AC-130 **[v4]**: *"Overlord on station. Ninety seconds of bad news, coming right up."*

---

## 15. MVP scope and development plan

Start as a browser game. Move to a desktop build only if the continuous 3D battlefield, simulation scale, rendering or performance become too much for the browser. Decide that based on actual technical limits, not in advance.

### Browser-first MVP

- A compact opening area: the main base and one 64 × 64 starter zone. Later the opening grows to three 64 × 64 zones and two larger maps.
- Isometric 3D rendering prototype with zoom and pan between strategic and close views.
- Rifle Squad and Engineer Team; Walker, Runner and Bloater; an initial hive objective.
- Selection, move, cover, hold, attack-move, stop, Shift+click waypoint queueing.
- Autonomous squad combat **with threat-priority focus fire [v4]**, member-by-member losses, permanent squad wipes.
- A basic noise system that draws hordes, and a first horde-pulse test.
- Main base production, money, supplies, daily upkeep, outpost setup, engineer-built field fortifications.
- Continuous-world persistence: units and combat stay active across zoom levels.
- **Static cars as cover [v4]** (crushing comes with tanks).

### Defer until after the core is fun

- Full district set, later map areas, advanced hive progression, all bosses.
- Advanced infantry, vehicles, helicopters, air strikes, drones.
- Dragger, Puker, pile-ups, helicopter clinging, soldier reanimation.
- Civilians, evacuation, Guerrillas.
- Advanced construction catalogue (incl. tall walls, loudspeaker).
- Weapon customization and cosmetics.
- Vehicle leveling and upgrades (incl. sheet metal).
- Last Stand defeat mode.
- Day/night and flares; building destruction and rubble; human faction.

### Build order

| Step | Focus |
|---|---|
| 1 | Prototype the isometric world, camera, zoom and persistent simulation. |
| 2 | Unit movement, selection, formations and squad representation. |
| 3 | Combat, threat-priority targeting and individual member losses. |
| 4 | Squad AI, cover and core orders. |
| 5 | Walker/Runner AI, hives, noise and horde response. |
| 6 | Base production, money, supplies, daily upkeep, command limits. |
| 7 | District infestation, fog of war, outposts and power restoration. |
| 8 | Leveling, repairs and the first reward item. |
| 9 | Expand content and systems only once the core battlefield is fun and stable. |

**Fun check:** before adding lots of content, test whether a few Rifle Squads holding a street against a Walker horde is satisfying. If it isn't, fix that before building more on top.

---

## 16. Deferred design questions and tuning

These are left open on purpose so they don't block the core design or the prototype.

- **Vehicle progression:** levels, bonuses, upgrade branches, per-model paths.
- **Aircraft support:** costs, cooldowns, targeting, damage radius, heavy plane's final name; **AC-130 cost, orbit radius, weapon cycling [v4]**.
- **Drones:** patrol duration, attack behavior, health, limits, servicing.
- **Guerrillas:** squad size, weapons, recruitment, progression.
- **Infantry loadouts:** weapon availability, per-member inventory, costs.
- **Engineer construction:** exact structures, build times, prices, upgrades, repair/salvage. Confirmed: engineers can build anywhere.
- **Day length and upkeep timing:** ~~day length~~ **12 real minutes per in-game day [v4.2]** (4 min felt far too fast); how the player is warned before supply deductions; **night difficulty modifiers [v4]**.
- **RTB rules:** which vehicles return, how servicing works, whether helicopters use separate rearm points.
- **Direct-control input mapping.**
- **Continuous-world performance:** simulation detail at strategic zoom, entity limits, streaming, the point where a desktop build makes sense. **Rubble and destruction add to this [v4].**
- **[v4]** Human faction identity, roster and behavior (§9a).
- **[v4]** Last Stand fail outcome, repeatability, scaling (§13).
- **[v4]** Airdrop upgrades scope (§11).
- **[v4]** Artillery vehicles: whether the howitzer and/or HIMARS-style unit make the cut, and their unlocks.
- **[v4]** Building destruction thresholds (HP per building class, fire spread rate).
- **[v4]** Tall wall cost, build time and what can destroy them.
- **[v4.1]** Art pipeline — DECIDED: no purchases. Procedurally generated buildings, roads, props, trees and fortifications (in code), plus free CC0 models (e.g. Quaternius, Kenney, Poly Pizza; check each model's licence) for animated soldiers/zombies and aircraft/armour.
- **[v4.1]** Crowd target (hundreds routine, thousands at a Last Stand) and whether that forces the desktop build.

---

## 17. Seven-mission starter tutorial and open-world transition

**Seven introductory missions.** The opening campaign is seven tutorial missions/regions: three small 64 × 64 starter zones, then four starter regions arranged as two larger maps (two regions each). The tutorial teaches the core systems step by step before the wider campaign opens.

**Restricted access during the tutorial.** Until all seven are done, the player can only use the main base and the starter sections the tutorial has opened. The rest of the city is closed.

**Open-world unlock.** After all seven missions, the seven tutorial regions become part of the open world. They stay connected parts of the same persistent city, not throwaway levels. The player can travel back through them, defend them and respond to new infestations.

## 18. Tutorial presentation and final test

The starter sequence is a guided tutorial. During instruction, **the game pauses** while clear on-screen prompts explain the mechanic and tell the player what to do. The simulation resumes when the player dismisses or completes the prompt.

**Progressive instruction.** Prompts introduce controls and systems in a set order, each shown in the relevant starter area. Prompts are short, actionable and tied to the current objective.

**Implementation status [v4.6].** The tutorial system is built and mission 1 (Roadside Motel) is scripted: 12 steps covering camera, selection, movement, cover, noise and targeting, fortifying, recruiting, Command Post support, the hive and securing the district. Each step pauses with a prompt; after "Got it" it becomes an objective banner while you play, the relevant HUD panel pulses, and steps you've already completed advance on their own. Missions 2–7 need their maps first.

**Final test.** The last one or two larger starter regions are a practical final test: they combine earlier mechanics with less step-by-step instruction. They're still part of the tutorial and must be completed before the open world unlocks.

## 19. Region loss, hive takeover, and progression regression

A secured region isn't permanently safe. If zombies retake it, the friendly outpost is lost and **replaced by a zombie hive**. This is a change of control, not just a higher infestation number.

**Consequences of a takeover:**

- The outpost is destroyed and a hive takes its place.
- The region is no longer secured; its income and forward benefits are lost while the hive is active.
- Infestation and zombie pressure come back, and the new hive starts its own threat progression.
- To reclaim it, the player must clear the region again, destroy the hive with fire or explosives, bring infestation down, and have engineers re-establish an outpost.

Leaving a region unattended can therefore cost territory, income and forward presence. Takeovers must be visible and clearly communicated so they feel like a consequence of a changing battlefield, not an unexplained state change. **[v4]** Repeated takeovers that reach the main base trigger the **Last Stand** (§13).

**Progression boundary.** Losing a region reverses that region's secured status and local benefits. It does not revoke permanent global unlocks earned elsewhere unless a future system says so.

## 20. Clarifications to earlier rules

- Engineers may build field fortifications anywhere on the map, not only at the main base or outposts.
- The seven starter regions stay part of the persistent open world after the tutorial.
- The old rule that a fallen outpost leaves the region at a fixed 40% infestation is superseded by the takeover rule: a full zombie retake replaces the outpost with a hive.
- Hives spawn zombies while active, go through four escalating threat stages, have a spawn/population limit for performance, and can only be destroyed with fire or explosives. Bosses are separate from hive destruction.
- **[v4]** Pile-ups can scale barricades, vehicles, small buildings and rooftops, **but not tall concrete walls**.
- **[v4]** The v3 rule "main base cannot be destroyed" is replaced by the Last Stand (§13).
- **[v4]** Outposts need physical resupply to build and rearm (§6). This is a logistics rule, not an ammo/fuel resource.

---

## 21. Feature priority roadmap [v4]

Every feature, ranked by importance to the game being fun and shippable. The MVP covers Tier 0. Later tiers are built in this order, and the MVP code includes **extension hooks** for them (see `README.md` → *Architecture*).

### Tier 0: MVP core (build now)
1. Isometric 3D world, camera pan/zoom, fixed-step persistent simulation, pause and 4× speed
2. Selection, move, attack-move, hold, stop, Shift-waypoints, cover
3. Squads with individual members, member losses, permanent wipes
4. **Threat-priority focus fire**
5. Walker, Runner, Bloater; hive with stages; noise and horde pulses
6. Money, supplies, daily upkeep, command cap, Barracks production
7. District infestation, engineer outposts, field fortifications (sandbags, barbed wire, MG emplacement)
8. Static cars as cover

### Tier 1: Make the core deep
9. XP and leveling (Recruit → Elite), Grenadier/Cinder paths
10. Fog of war and recon
11. Outpost resupply via Supply Truck
12. Explosion knockback
13. Power stations and base building unlocks
14. Region takeover → hive (§19)
15. Seven-mission tutorial flow

### Tier 2: Escalation and spectacle
16. Day/night cycle and flares
17. Building destruction, permanent rubble, tank crushing of cars
18. Vehicles: Gun Jeep, Supply Truck, LAV, Battle Tank; sheet-metal armor
19. Artillery: Mortar Team, base artillery strike, strike patterns
20. Elite rooftop access and pile-ups onto roofs
21. Tall concrete walls, loudspeaker
22. Special zombies: Screamer, Brute, Dragger, Puker; reanimation
23. Last Stand defeat mode

### Tier 3: Air power and late game
24. Airfield: Hawk (with rappelling), Sparrow, Hauler, Hornet, Anvil
25. Air-support call-ins with colored smoke: gun run, bombing run, AC-130, drone
26. Bosses
27. Human enemy faction (Airport, Downtown Core)
28. Howitzer / HIMARS-style artillery vehicles (if kept)

### Visual production track (runs alongside the tiers) [v4.1]
- V1. ~~Lock world scale~~ ✔; ~~camera rotation~~ ✔; ~~glTF model loading~~ ✔ (`public/models/manifest.json`)
- V2. ~~Instanced, animated zombie crowds~~ ✔ + ~~flow-field pathing~~ ✔; Web Worker deferred: at 1,500 zombies the whole sim costs ~3.7 ms/tick, so move it only if real-hardware testing shows the sim (not the GPU) is the limit
- V3. First real asset set: ~~procedural suburban houses (pitched roofs, porches, balconies), roads/crosswalks/streetlights, palm trees, cars~~ ✔ first pass; CC0 soldiers and zombies still to do
- V4. Lighting pass: sun shadows, dusk grade, night lights/flares, smoke columns, fire
- V5. UI restyle toward the §14 direction (unit-card strip, support panel, minimap, day clock)

### Tier 4: Polish and attachment
29. Armory weapon customization and Elite cosmetics
30. Civilians, evacuation and Guerrillas
31. Vehicle leveling paths
32. Airdrop upgrades
33. Reward items catalogue, full campaign balancing

*Design status: v3 decisions remain confirmed. v4 additions are confirmed direction except where marked "candidate", "proposed" or "open question". All numbers are subject to playtesting.*

---

## 22. Playtest feedback log [v4.2]

First hands-on playtest of the browser MVP (November 2026). Every note, and what was done about it.

| # | Note | Status |
|---|---|---|
| 1 | Zombies don't react to gunfire, only to sight | **Fixed (v4.1).** Hearing radius was below sight range. Gunfire is now heard ~73 m (rifle) to ~106 m (MG) and zombies path around buildings toward it. |
| 2 | Right-click a zombie to force units to attack it | **Done.** Forced target overrides threat priority (§5). |
| 3 | Rotate the camera with middle mouse held | **Done.** Middle-drag rotates freely; Q/E snap 90°; Shift + middle-drag pans. |
| 4 | Riflemen need a bit more range | **Done.** 18 → 24 m (carbines 14 → 18 m). |
| 5 | Zombie aggro should be time-based first, then distance-based; they give up too easily if you run | **Done.** 20 s hunt after losing sight, then a 60 m leash (§9). |
| 6 | UI buttons sometimes need several clicks; rotating sandbags only updates when the mouse moves | **Fixed.** The HUD re-rendered 8×/s and swallowed clicks; panels now only redraw when their content changes, and buttons act on press. The placement preview refreshes every frame. |
| 7 | Units are too stiff; they should move around a bit instead of a strict formation | **Done.** Loose, drifting, individually paced squad members (§5). |
| 8 | Normal zombies (walkers, runners, screamers) should be a bit weaker | **Done.** HP: Walker 45 → 36, Runner 28 → 22, Screamer 50 → 40. |
| 9 | Engineers should be able to deconstruct things they've built | **Done.** X / Deconstruct button; refunds per §6. |
| 10 | Static cars have no wheels | **Fixed.** Wheels (some flat), bumpers, head/tail lights. |
| 11 | Day/night cycle is really fast | **Done.** 12 real minutes per in-game day; daily supply income raised to match. |

**Balance after this round** (scripted bots, 6 seeds): a careful "advance, let the wave come, clear, advance" push wins 6/6 with no losses, so careful play is now on the easy side for a starter zone. Blob-rushing the hive and the lone-sapper sprint both fail 6/6. Watch whether human play feels too safe; the knobs are walker HP, hive spawn rate and the alarm radius in `config/balance.ts`.

### Round 2 [v4.4]

| # | Note | Status |
|---|---|---|
| 12 | Map regions should be the same every time (no procedurally generated layouts) | **Confirmed and written down (§2).** The layout was already fixed; only building *visuals* are code-generated, seeded per building. |
| 13 | Similar games use C# in Unity; will this be easy to move over? | **Answered in §23.** |
| 14 | Engineers stop building if given an order mid-build | **Done.** The site keeps its progress; right-click it to resume; progress bar shows. (A new order still takes priority, as in most RTS games; Shift-queue to add orders after a build.) |
| 15 | Gunshots should be heard further still | **Done.** Rifle ~110 m (was ~73), MG ~160 m; cap 260 m. |
| 16 | Zombies should eventually reach overwhelming numbers: hundreds to thousands in places | **First pass done.** Crowd renderer handles thousands; cap 1,500; Overrun hives grow to 300; bigger late-stage pulses. Next: move the sim to a Web Worker and test on real hardware. |
| 17 | Engineers should repair built structures | **Done** (§6). |
| 18 | Boomers (Bloaters) don't aggro when shot, sometimes | **Fixed.** Zombies now turn on whoever shoots them. |
| 19 | Command structure clickable with power-ups | **Done.** Artillery Barrage and Supply Drop; air call-ins shown locked (§6). |
| 20 | Hives spawn zombies far too often | **Done.** Spawn interval roughly doubled at every stage, smaller groups; big hordes come from pulses instead. |
| 21 | A little money and supplies per kill | **Done** (§11). |

---

## 23. Engine, platform and porting [v4.4]

**Question:** similar games are built in C# with Unity (or similar engines). Will this be easy to move over?

**Honest answer: the game's logic will move over fairly easily; the visuals and UI will be rebuilt, not moved.**

- **Simulation (easy to port).** All the rules (combat, targeting, zombies, hives, noise, economy, orders, districts) live in `src/sim/` and `src/config/`. They're plain TypeScript with no browser or graphics code in them, deterministic, and covered by tests. TypeScript and C# are close cousins; this code translates almost line by line, and the tests translate with it (they become the proof the port behaves the same). Config tables become JSON or ScriptableObjects. Roughly ~3,000 lines today.
- **Assets (port as-is).** Characters are standard FBX; Unity imports them directly. The procedural buildings and props would either be re-implemented as an editor script or exported once to models.
- **Rendering, input and UI (rebuild).** Three.js and the HTML HUD don't exist in Unity. These get rebuilt with Unity's renderer, its input system and its UI toolkit. This is the bulk of a port, and it's also where Unity would *help*: lighting, shadows, particles, animation blending and big crowds (ECS/DOTS, GPU instancing) are its strengths.
- **What keeps it portable:** the strict rule that the sim never touches rendering, all numbers in config, the event bus between sim and presentation, and tests on the sim. Keep following these.

**When to decide.** Stay in the browser while the core is being found (fast iteration, nothing to install, easy to share). The real trigger is the crowd target: if thousands of zombies plus lighting and effects can't hold a steady frame rate on mid-range hardware after moving the sim to a Web Worker, that's the point to port. A middle option, if the only goal is "a desktop app", is wrapping the browser build (Electron/Tauri) with no port at all.

### Round 3 [v4.5]

| # | Note | Status |
|---|---|---|
| 22 | Infantry idle movement should be more realistic | **Waiting on better 3D models** (needs richer idle/look-around/fidget animations than the current pack has). |
| 23 | Engineers should play a building animation while erecting structures | **Waiting on better 3D models.** Currently they use the pack's "pick up" animation as a stand-in. |
| 24 | MG emplacement model is missing its roof | **Done.** Sandbag ring with a rear entrance, corrugated roof on posts, bags on top. |
| 25 | Units in cover should look like they're in cover (leaning against it) | Open. Needs crouch/lean-on-cover poses (also benefits from better models); positioning members along the cover edge can come first. |
| 26 | Zombies should bleed when shot and when dying | **Done.** Droplet sprays thrown away from the shooter on every hit; a dark pool spreads under each body and dries over ~45 s. |
| 27 | Still not getting supplies from kills; after building a few things you can't afford an outpost | **Fixed.** Kills did pay (0.5 supplies per Walker), but too little to notice. The real cause: v4.2 made days 12 min long while supply income only arrived at day's end, so for the first 12 minutes almost no supplies came in. Now supplies trickle in continuously (+9/min base, +5/min per secured district), Walkers/Runners salvage 1 supply each, and the top bar shows income rates. Upkeep is still paid once per day. |
| 28 | Barracks model is only half rendered | **Fixed.** The Quonset hut was rotated half underground; rebuilt with ribs, door and windows. |
| 29 | Concrete main-base walls should have a lot of health | **Done.** 3,000 → 15,000 HP per section. |
| 30 | The text saying what a unit is actively doing should be more obvious | **Done.** A coloured status badge (MOVING, ENGAGING, BUILDING, IN COVER · FIRING, PLANTING CHARGE…) on each unit card and above each squad in the world; blue = moving, orange = fighting, yellow = working. |
| 31 | Not all roads in the test level go to the edge of the map | **Fixed.** Both avenues now run the full height of the map. |

### Round 4 [v4.7] (logged, not started)

| # | Note | Likely cause (from the code) | Proposed fix |
|---|---|---|---|
| 32 | The hive is now a bit slow and zombies don't spawn enough; you can drag most of the motel's zombies to the base just by shooting at the entrance | Two v4.4/v4.5 changes stacked: hive spawn intervals were roughly doubled, and gunfire is now heard ~110 m, so a few shots at the gate pull nearly the whole district into a kill zone. The starting population (~45) is finite and the young hive refills it slowly. | Bring hive output partway back up (especially stage 1–2), let a hive "reinforce" faster when its district population drops, and make the response to distant noise partial: louder/closer sounds pull more, a share of zombies stay put or guard the hive. Re-run the balance probes with a "shoot from the gate" bot. |
| 33 | Soldier and zombie animations are very twitchy at the arms and legs | The flipbook has few poses per clip (walk 10, idle 6, shoot 4), so limbs snap between poses; the zombie mesh simplification runs separately on every pose, so vertices shift slightly between frames and shimmer. | More poses per clip (walk ~20), blend between neighbouring poses in the vertex shader, and simplify once on the rest pose (then reuse that mapping for every frame) so the mesh is identical frame to frame. |
| 34 | Dead zombies stay standing | The pack has no fall-over death animation; the "Defeat" clip used for death ends standing/slumped. | Procedural death: tip the body over onto the ground over ~0.5 s (rotate the corpse instance), then lie flat; optionally blend the last Defeat pose. |
| 35 | Health bars shouldn't float over everything; only show when hovering with the mouse | Squad pips, hive bars and structure bars are always drawn. | Show world-space bars only on hover (and for the current selection). Keep the unit cards as the always-on readout. |
| 36 | Set the Barracks rally point by clicking the Barracks and choosing it from a Barracks menu | Rally point is fixed in the map data; the Barracks isn't selectable. | Make the Barracks selectable (like the Command Post) with a panel: production queue plus "Set rally point" → click the map. Show the rally flag in the world. |
| 37 | Airdrops: a C-130's shadow should fly over before the crate starts falling | Crate currently just appears and parachutes down on the green smoke. | Before the drop, a large aircraft shadow (and engine audio later) sweeps across the map along a line through the smoke; the crate releases as it passes overhead. Reuse the same flyover for the other air call-ins. |
| 38 | The UI takes up a lot of the screen; add a UI scaling option | Fixed pixel sizes; no settings menu. | Settings menu with UI scale (e.g. 75–125%), plus collapsible panels (radio, roster, objectives). |
| 39 | Should be able to select a unit by clicking its name | The name labels over squads in the world ignore the mouse; only the Forces panel chips are clickable. | Make the in-world name labels clickable (select; double-click to centre the camera), and let clicking a unit card in a multi-selection narrow the selection to that unit. |
| 40 | Infestation stuck at 5% with no zombies and no hive | Infestation only drops per kill. If the last zombies die from causes that don't count, or the starting infestation is higher than the zombies can "pay off", the meter can't reach 0 with nothing left to kill. | When a district has no hive, infestation should track what's actually there: decay to 0 when no zombies remain (and generally be derived from the live population plus hive state). Add a test that a cleared, hive-free district reaches 0%. |
| 41 | Road shouldn't be visible under the main base | The ground painter lays the main road and its sidewalks across the whole map width before the base concrete is painted, and only rows 34–37 inside the base get repainted; the sidewalk rows and the strip west of the base still show road. | Stop the road and sidewalks at the base wall (the road should end at the gate), and paint the base footprint last. |
| 42 | Orientation arrows on building placement ghosts | The ghost is a plain box. | Draw an arrow on the ghost showing which way the structure faces (the side squads take cover on, the MG's field of fire), updated live with R. |
| 43 | Noise meter goes up and immediately back down; it should build for a set time before deteriorating | District noise decays at a constant 4/s every tick, so it drains as fast as it fills between volleys. | Give the meter a hold time: after the last sound it stays put for ~10–15 s, then decays. Sustained fighting then actually fills it, which matches the doc ("fill it and the whole district comes"). |
| 44 | Move the camera with WASD; move conflicting keybinds to Ctrl+ versions | A (attack-move) and S (stop) are single letters; W and D are free. | WASD pans the camera. Attack-move → Ctrl+A, Stop → Ctrl+S (both can be intercepted in the browser). **Browser caveat:** Ctrl+W closes the tab and can't be overridden by a web page, so nothing should ever be bound to Ctrl+W, and a desktop build would lift that limit. |

