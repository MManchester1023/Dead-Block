# DEAD BLOCK COMMAND

## Updated Game Design Document

Reclaim it block by block. A persistent, open-world-ish military RTS-lite set in a zombie-choked city. Build and maintain a force, push out from a safe base, establish outposts and field fortifications wherever engineers can reach, and reclaim the city through continuous battles.

### Current direction

Single-player strategy and tactical action • Continuous city battlefield • Isometric 3D with pixel/low poly-inspired art direction • Browser-first development with desktop migration planned.

This document is the source of truth for this project. It should in no way be edited witout Mat's approval first.

## 1. Pitch and design pillars

Dead Block Command is a isometric RTS-lite in which the player commands modern military units from a fortified safe zone on the edge of a ruined city. The player produces squads and vehicles, sends them into nearby streets, clears infestations, secures districts, establishes outposts, saves civilians, and gradually pushes deeper into the city. The city is one persistent battlefield rather than a collection of separately loaded missions.

- One persistent city: The player can move between strategic overview and detailed street-level combat without loading separate district maps or loading screens. Units must travel between the main base, outposts, and operational areas.

- Reclaim it block by block: Infestation recedes, nests are destroyed, outposts are built, power is restored, and the map visibly changes as the city is retaken.

- Command a force, not a spreadsheet: Squads act autonomously under clear orders, while the player can take direct control of a selected squad, vehicle, or helicopter when needed for an FPS experience.

- Every loss matters: Infantry members are lost individually. A squad wiped out is permanently gone, including its accumulated experience.

- Noise has consequences: Gunfire, engines, building and heavy weapons attract attention. The player trades speed and firepower against the risk of drawing a larger horde.

- Build and hold: Engineers establish outposts and construct defensive emplacements.

- Gritty but fun: A ruined, atmospheric city, recognizable military-inspired hardware, readable combat, and dry radio chatter.

Format: single-player, real-time strategy with tactical direct control. Working title: Dead Block Command. Final title: TBD.

## 2. The city: one continuous battlefield

The city is designed as one connected world with seperate districts/regions. Districts are named regions of that world, not separate missions or maps that the player loads into. The player begins at a safe zone on the city's edge and must physically move forces out to the districts and back. The strategic map and the detailed battlefield are two views of the same simulation.

- Seamless zoom: Scrolling into a street on the operations map reveals the live battlefield. Scrolling back out returns to the strategic overview while the simulation continues.

- Persistent consequences: Soldiers lost, zombies killed, structures destroyed, vehicles damaged, hives cleared, and fortifications built remain reflected in the world.

- No hidden auto-resolve: Battles are simulated in the world. District progress is earned through actual unit movement and combat rather than an abstract mission result.

- Travel matters: Units must travel from the main base to districts and return. Outposts provide forward positions and services, but do not function as instant teleportation points.

- Pause and speed: The player can pause or run the operations-map view at up to 4× speed. The detailed battlefield and strategic overview represent the same ongoing simulation.

- Fog of war: Unexplored areas show estimated infestation. Recon units reveal more accurate information and provide battlefield vision. Battlefield foggy until explored. This is measured by units' vision cones.

### District structure
@docs/districts.md

The campaign is organized as a connected city built of districts. It is only restricted when doing the tutorial . Otherwise, the player is loaded into the open world. The tutorial section locks the player to 3 regions. Two small and one large, one region at a time. If the player chooses to skip the tutorial, they load in with all regions unlocked.

```
District                 Terrain / identity                                  Key progression or threat
(Order should influence general layout so it feels like a real city)
Roadside Motel           Motel rooms, parking lots                           Tutorial district; Walkers & runners. Introduces basics

Gas Station Strip        Pumps and convenience stores                        Tutorial district; Walkers, runners, & boomers. Introduces searching, important buildings, and civilians

Rail Siding              Boxcars and small depot                             Walkers, Runners, and boomers. Introduces power stations

Industrial Park          Warehouses and rail yard connected to Rail Siding

Trailer Park             Tight rows, little cover 

Suburbs                  Houses, fences, back yards 

Market                   Small shops, parking lots, food and drink stores 
                                                 
Parking Garage           Stacked decks and ramps  

Main Street              Narrow shops and alleys  
                         
Checkpoint               Fortified highway interchange 
                                                                                                 
Hospital Row             Tight wards and parking decks

Stadium                  Large open bowl and stands 
                         
Harbor                   Docks and container stacks  
                                               
Airport                  Runways and hangars                                 Airfield unlock;

Downtown Core            Skyscraper canyons                                  Final district; Patient Zero largest of all districts and dangerous enough that players will avoid it until the having the airfield.
```

The Airport must be reached and its Airfield unlocked before the endgame. The player should have a meaningful opportunity to use the airfield's unlocks before entering Downtown Core; it must not be an optional late unlock with no practical payoff.

### Infestation and district security

- Each district has an infestation meter from 0–100%. Killing zombies drains it gradually; destroying hives drains it quickly. Infestation cannot reach zero while a hive remains.

- At 0% infestation, an Engineer Team can establish an outpost and the district becomes secured. Field fortifications may be constructed anywhere by engineers and do not require an outpost.

- Secured districts generate funds over time and provide forward operating positions.

- Some districts contain power stations. Engineers must reach and hold the generator room for approximately three minutes to restore power. The process is loud and can draw a horde.

- Restoring power unlocks or upgrades a related base building.

- If an outpost falls, the district becomes 40% infested again and its income stops.

## 3. Core gameplay loop

The broad progression loop remains produce, deploy, clear, secure, and reinforce. The difference is that every step happens in the same continuous city, and travel, supply upkeep, and persistent combat connect the steps.


## 4. Controls and command system

The command system supports conventional RTS selection and orders, with an optional direct-control mode for hands-on play. Orders apply to the selected squad, vehicle, or helicopter unless the command specifically applies to a formation.

```
Input                              Command                      Behavior

- TAB                              Direct control                 Take direct control of the selected squad,
vehicle, or helicopter as a whole. For
infantry, the squad is controlled as one unit rather than selecting an individual soldier.

- Left-click and drag                Box select                   Select multiple friendly units.

- Right-click valid terrain w/ unit selected      Move                           Order selected units to walk or drive to the chosen location. Orders can be issued from the minimap or full map.
                                                             
- Right-click cover                  Take cover                   Infantry moves to the selected cover position

M                                Operations map                 Open the full map showing units, base, district names, captured and uncapture districts, and fog-of-war progression.

Attack-Move                      Aggressive movement            Move toward a destination and automatically engage enemies that enter the unit's attack radius along the route.

Crouch                             Quiet movement & Reduced Damage      Move as quietly as possible

Patrol                             Patrol route                 Cycle continuously between multiple waypoints, scouting, maintaining vision, or intercepting enemies.

H                                  Hold/defend position                Stay in place and fire at enemies within range without pursuing them.

Stop                               Cancel                       Immediately cancel current movement or production-queue actions.

Hold SHIFT + left-click           Waypoint queue                Add multiple movement or action waypoints. Units follow the queued sequence in order.

CTRL + right-click /               Formation movement           Arrange units into structured lines, circles, or custom spacing while moving. drag-line Formation movement should support sensible spacing and orientation while avoiding unnecessary micromanagement. The initial implementation should prioritize reliable line formations and custom spacing; more formation shapes can follow. Direct-control behavior Direct control is an optional layer on top of squad autonomy. When the player takes control, the selected squad moves and fights according to player input. On release, it returns to its normal command behavior. Vehicles and helicopters can likewise be directly controlled, while retaining their normal autonomous orders when not under direct control. Exact input mapping for movement, aiming, and firing remains to be finalized.
```

## 5. Squad behavior, cover, and formations

Squads fight autonomously when not directly controlled. They select targets, hold ground, use available cover, and follow the current order. Vehicles and helicopters are more dependent on explicit orders, but can still defend themselves.

- Infantry benefits from cover such as concrete barriers, walls, cars, and sandbags. Cover reduces incoming damage and can shape firing lanes.

- Right-clicking a cover object orders infantry to occupy it and engage from that position.

- Hold Position prevents units from chasing targets outside their current position.

- Attack-Move allows a force to advance while engaging threats encountered on the way.

- Sneak is useful for recon and quiet approaches, but units still defend themselves against immediate danger.

- Patrol routes maintain local vision and can intercept enemies that enter the patrol area.

- Vehicles and helicopters generally hold position and engage nearby threats when idle. They can be ordered to retreat and should RTB when servicing is required.

## 6. Main base, outposts, and fortifications

The main base is the player's safe zone and primary production center. It begins with a Command Post, Barracks, and Supply Depot, with room for additional facilities. The base grows as power is restored in key districts.

```
Building                 Function                                                                 Unlock / upgrade

Command Post             Command cap and strategic support abilities                              Starts at base; lVL 2 unlocks larger Supply Depot, artillery units in vehicle bay

Barracks                 Trains infantry squads                                                   Starts at base; LVL 2 unlocks Recon unit, Flame Team, and Mortar Team

Supply Depot             Stores and manages supplies. Used to resupply outposts                   Starts at base; LVL 2 increases capacity. 

Armory                   Trains heavy weapons teams                                               Main Street;

Vehicle Bay              Services and repairs damaged vehicles                                    First Power Plant; LVL 2 unlocks Logi Truck & LAV, LVL3 unlocks MBT

Medbay                   Restores lost squad members at base                                      Small hospital in Gas Station Strip looted; LVL 2 unlock Medic Humvee

Airfield                 Builds controllable helicopters and unlocks air-support abilities        Airport; LVL 2 unlocks 
```

### Outposts

- An Engineer Team establishes an outpost after a district is cleared. The original build-time target is approximately 30 seconds.

- Outposts act as forward positions and resupply/service points, with a radio and defensive perimeter.

- Outposts can be upgraded with barricades, garrison and a machine-gun nest.

- Units travel to outposts through the world; they are not instantly transported there.

- An outpost falling causes the district to become partially infested again and stops its income.

### Engineer functions

Engineers can build predefined defensive structures anywhere on the map, not only at the main base or established outposts. This lets players fortify roads, intersections, bridges, chokepoints, cleared buildings, and other tactically useful locations. An Engineer Team must be present to construct. Construction requires money and supplies. Main bases and outposts remain important production, resupply, and service locations, but they are not the only places where defenses can be built.

```
Structure category         Examples / purpose

Placed weapons             Mounted machine guns, grenade-launcher emplacements.

Cover                      Sandbag walls, concrete barriers, and other defensive cover.

Area denial                Barbed wire 

Base defenses              Sniper towers, mounted heavy machine guns, mounted grenade launchers, and mounted flamethrowers.

Repair                     Repair buildings and vehicles in the field.
```

## 7. Unit roster and progression

The original unit roles and broad unlock structure remain the foundation. The roster is intended to cover infantry, support, armor, transport, and aviation. Exact costs, command weights, and upkeep values are balancing targets.

```
Unit                        Role                                                               Notes

Rifle Squad (4)             All-round infantry                                                 Starting unit; primary early-game force.

Engineer Team (2)           Builds outposts and defenses;repairs buildings & vehicles          Starting unit.

Medic Team (2)              Heals infantry units & civilians                                   Med Bay Repaired /

Recon Pair (2)              Quiet, fast scouts with long vision                                Silenced weapons, quiet movement

Machine Gun Team (3)        Crowd suppression; slow movement                                   

Sniper Team (2)             Long-range precision against dangerous targets                    

Flame Team (3)              Burns hives and packed hordes at short range                       

Mortar Team (3)             Indirect fire; powerful when positioned at an outpost             

Humvee                      Fast scout and harasser with mounted machine gun                   

Logi Truck                  Moves squads and a lot ofsupplies                                          

LAV                         (M2 Bradley inspired) Armored carrier with autocannon & mounted light MG;               Mobile cover, first armor unit        

Main Battle Tank            (M1 Abrahms inspired) Heavy battle tank with 120mm cannon and mounted heavy MG   

Little Bee Helicopter       (litte bird inspired) Transports 2 infantry unity. Fast and nimble Has mounted miniguns on running boards         

Hauler Helicopter           (blackhawk inspired) Transports squads and supplies; evacuates wounded; mounted mini guns on each side. Heavy and slow. Allows squads to rope rappel out                  

Hornet Gunship              (Cobra helicopter inspired) Light, fast &  gunship for strafing and scouting with chain machine gun     
         
Anvil Gunship               (Apache helicopter inspired) Heavy gunship for dangerous targets with rockets and chain machine gun, more ammo and fuel                   
```

### Squad losses and leveling

- Infantry squads contain two to four individual members. Squad health is divided among its members; when a member is lost, the squad loses that member's share of health and firepower.

- A squad with no members remaining is permanently lost. Its experience and level are lost with it.

- Squads gain experience from kills, boss kills, and participating in cleared districts.

- The existing progression target is Recruit (base stats), Regular (+15% health, +10% damage), Veteran (+30% health, +20% damage), and Elite (choose one of two class-specific paths).

- The Rifle Squad's Elite paths are the first planned infantry arcs: an M320 grenade-launcher path (Grenadier Squad) or an incendiary-ammunition path (placeholder Cinder Squad).

- Implement the Rifle Squad's progression arcs first. Other infantry classes can receive their own paths later.

### Elite armory access and weapon customization

Reaching Elite status unlocks armory access for that unit. Elite units can visit the Armory to customize their weapons and unlock additional weapon options. Customization includes attachment slots such as grips, flash hiders, extended magazines, and sights. Weapon unlocks can include alternate rifles and other weapon classes as the campaign progresses. Weapon selection and attachments should be assigned per infantry member where supported, rather than being limited to a squad-wide visual change. Exact attachment effects, costs, weapon availability, and interface details remain subject to balancing and implementation.

### Vehicle health

Vehicles that survive and remain in service earn experience and level up. The progression system, level bonuses, and upgrade paths are intentionally undecided and will be designed later. The confirmed design direction is that vehicles do level; they are not permanently static purchases. Vehicle damage remains visible and affects performance.

```
Vehicle health            Visual state                                Effect

75–50%                    Dented; light smoke                         Approximately 10% slower.

50–25%                    Panels damaged; heavy smoke                 Approximately 25% slower; secondary systems may go offline.

Below 25%                 Burning                                     Approximately 50% slower; main weapon fires at reduced rate.

0%                        Wreck                                       Vehicle is lost and blocks the street until cleared.
```

## 8. Air Support (command Post)

The Airfield is unlocked by securing and restoring power at the Airport. It provides controllable helicopters and unlocks additional aircraft and drone support as abilities. The new aircraft do not replace the helicopters.

```

Heavy Gun Run                Air-support ability     A-10-style gun run that levels a large section of zombies along a designated attack area. Marked by red smoke

Jet Bombing Run              Air-support ability     F/A-18-style bombing run. Player chooses HE or incendiary bombs. name) Marked by orange smoke

Patrol drone                 Air Support Ability     Deployed by recon squads. Assign a drone to patrol a district and it clears fog of war until the battery runs out.

AC-130 Gunship               Air Support Ability     ~90-second orbit using its full weapon set (25 mm, 40 mm, 105 mm). Very expensive, very effective. Marked by purple smoke

Supply drop                  Air Support Ability     Parachuted supply drop marked with green smoke
```

- Aircraft support abilities should have meaningful cooldowns, costs, or other limits so they remain powerful rather than replacing ground forces.

- The heavy plane is intended for a broad gun run; the fast plane is intended for a bombing attack with a choice between high explosive and incendiary payloads.

- The drone is assigned to a district to patrol and gather info. Its duration, health, and redeployment rules remain to be balanced.

- Controllable gunships have limited ammunition and must return to the Airfield to rearm. Helicopters and vehicles use RTB/service behavior rather than a detailed player-managed fuel system.

- The Airport unlock must occur early enough before the final Downtown Core push for the player to make practical use of these capabilities.

## 9. Zombie roster and behavior

The zombie roster combines basic crowd threats, tougher special types, persistent hives, and bosses. Zombies beyond the basic Walker and Runner classes should have additional health, but not so much that ordinary special zombies feel like bosses. Bosses remain a distinct tier and are introduced after the opening sequence of three 64 × 64 starter zones and two larger maps.

```
Zombie|             Behavior / threat                                                                   

Walker|             Slow, weak individually, dangerous in crowds. Large groups can stop            
                    smaller vehicles and pile over walls.                                      

Runner|            Fast and weak; sprints toward noise.                                                 

Boomer|            Slow, swollen zombie that bursts into a toxic cloud when killed. Cloud is flammable,                    

Shrieker|          Stays back and shrieks, filling the district noise meter. A lot of health                           

Brute|             Armored, hits hard, resists rifle fire. Dangerous to all vehicles.                                            

Dragger|           Uses an extremely long tongue to wrap one infantry member and slowly pull them away.
                   If the pull continues long enough, the member suffocates. Any damage to the Dragger 
				   makes it immediately release the victim. Can target vehicles and helicopters to damage 
				   them, but cannot pull them.

Puker|             Spits an acidic goo that remains on the ground temporarily. Does a lot of damage to infantry. 
                   Can target all vehicles.

Hive|              Infested structure that continuously spawns zombies while active. 4 levels, each spawning more 
                   zombies and each with more health than the last. A hive never naturally regresses to an earlier stage. 
				   Bullets damage them. Fire and explosives are 
				   very effective.
			   
- Stage 1 — Dormant: Small groups spawn periodically, with limited roaming around the hive.

- Stage 2 — Growing: Spawn frequency increases and larger groups begin roaming, threatening nearby infrastructure.

- Stage 3 — Established: Zombie production and roaming groups increase substantially; nearby defensive positions face sustained pressure.

- Stage 4 — Overrun: The hive reaches maximum production and sends large roaming hordes that can overwhelm nearby positions.Destroying a hive permanently stops its zombie production; destroyed hives do not respawn. Zombies can build a new hive if they destroy the districts outpost. Destroying a hive does not automatically spawn a boss. Boss encounters are separate campaign  in certain districts. To control simulation load, each hive uses a spawn budget and contributes to a defined maximum active-zombie population. When the population cap is reached, hives pause or throttle additional spawning until active zombies are removed. The exact cap and spawn rates are balancing values.
```

## Zombie classes

- Normal 
Walker, Runner

- Medium 
Boomer, Shrieker, Brute, Dragger, Puker.

-Boss
Planned bosses (§21 Tier 3)

### Horde behavior and environmental threats

- Noise is a core mechanic. Weapons, engines, building, explosions, and other loud actions contribute to a noise level that attracts hordes. Quiet weapons and Sneak orders can reduce the chance of detection.

- Zombies can pile up and climb over one another to scale reinforcements, vehicles, and small buildings. Defensive height and barriers are therefore not guaranteed to stop a sufficiently large horde.

- Basic Walkers and Runners can cling to helicopters that are hovering close to the ground or have landed. This makes low-altitude hovering and landing risky in infested areas.

- Vehicles can run over basic zombies such as Walkers and Runners without taking damage from those impacts provided they're going fast enough. Special zombies, can damage vehicles. Basic zombie hordes can hault slow, smaller vehicles.

- Soldiers killed by the horde rise again as zombies, adding to the threat facing the surviving force.

- Horde pulses grow with the difficulty of the region sending them.

- Aggro [v4.2]: time first, then distance. A zombie that has seen a squad hunts it for ~20 s even after losing sight (it keeps pathing toward the squad), then keeps coming while the squad is within ~60 m. Simply running away no longer shakes them; breaking contact takes distance and time.

- Getting shot makes them angry [v4.4]. A zombie that's hit turns on whoever shot it (unless it's already biting someone), even from beyond its sight. Fixes Bloaters sometimes ignoring fire.

- Pile-ups. Zombies can pile up and climb over each other to get over barricades, vehicles, small buildings and onto rooftops [v4]. Height and barriers don't guarantee safety. Exception [v4]: tall concrete walls (§6) are too high to pile over.
- Walkers and Runners can cling to helicopters hovering low or landed, which makes low hovering, landing and rappelling [v4] risky in infested areas.
- Vehicles can run over Walkers and Runners without taking damage. Specials such as Pukers and Draggers can damage vehicles. Vehicles with sheet-metal armor [v4] can't be climbed.
- Soldiers killed by the horde can rise again as zombies.
- Zombies are knocked back by close explosions and crushed by collapsing buildings.

### Bosses

The original boss structure remains: from Hospital Row onward, each major campaign district has a boss with a unique trait that challenges a standard tactic. Bosses drop a reward item.

```
Boss                       District                       Defining mechanic

The Matron |                                 Heals nearby zombies and raises downed ones until killed.

The Foreman |                                Throws shipping containers from range, changing cover 
                                             and blocking streets.

The Stampede |                               A stadium-sized horde charges toward the loudest sound. (need better idea)

The Dispatcher |                             Coordinates Runner waves and has heigtened sense of hearing 
                                             and directs zombies with it.

Sentient Hive |                              A hive that's grown for so long, it's merged with the zombies is spews 
                                             and gained sentience. Contantly drops normal and medium zombies until 
											 killed. Dies in a large gassy explosion.

Patient Zero |        "Final" Region         Calls surviving hives across the city to aid the final fight.(need better idea)
```

##9a. Human enemy faction [v4, to be designed]

The last two zones (assumed to be Airport and Downtown Core; to confirm) add a hostile human faction alongside the zombies. This is the first enemy that shoots back, uses cover and makes noise of its own. Three-way fights (player vs. humans vs. zombies) are expected.

Open questions:

- Who are they? (Deserters, a militia, a private security contractor, a cult around Patient Zero?)
- Unit roster, vehicles, and whether they have air defense that threatens the Airfield's aircraft.
- Do they hold territory and outposts the player can capture?
- Do they ever fight zombies, or does the horde ignore them?
- Can they be negotiated with or recruited (tie-in with Guerrillas, §10)?
- Framework note: combat code must support faction-vs-faction targeting from day one (not just "player vs. zombie") so this faction can be added without a rewrite.

## 10. Civilians and guerrilla recruits

Civilians may occasionally be found hiding in buildings or other locations in infested districts. Rescuing and evacuating them gives the player an additional reason to explore and secure areas rather than focusing only on hives and enemy counts.

- Successful evacuation can reward additional money and supplies.

- Some rescued civilians may volunteer or be recruited into the military as a special unit type called Guerrillas.

- Guerrillas are a distinct recruitable unit, not a replacement for standard trained infantry. Their exact weapons, strengths, and recruitment limits remain to be designed.

- Rescue opportunities should be occasional rather than guaranteed in every district.

- Later regions will require the player to rescue civilians to secure that region.

## 11. Economy, upkeep, and servicing

The economy uses two resources: money and supplies. Money is the harder-to-obtain resource and the main limiter on expansion. Supplies are more readily available and support unit creation, daily upkeep, repairs, and restoration of squad members. The game does not simulate ammunition and fuel as resources that the player must continually purchase.

```
Resource             
                                                      
Money ($)  | Earned from killing zombies (harder zombies earn you more $), re-taking regions, destroying hives, restoring power, rescuing civilians and searching buildings.          

Supplies   | Earned the same way as money but is more available to the player. Supplies are also used for unit and building upkeep.          

- Each active unit and buidling consumes supplies and money once per in-game day. This is a predictable upkeep payment rather than a constant drain during combat.

- Supplies are not spent on ammunition or fuel. The player does not need to manage individual ammo or fuel inventories yet but may need to in the future.

- Vehicles need to RTB (return to base) or be repaired by an engineer for servicing, rearming where relevant, or other operational requirements. RTB is a behavior/order requirement, not a detailed fuel-management minigame.

- Repairs and restoring lost infantry members consume supplies.

- Supplies should be much more available than money, so the player is generally constrained by finances rather than constant supply starvation.

- The original shared-supply-pool concept remains: supplies are a common resource for the whole force.

- Kill salvage [v4.4]. Every kill pays a little: Walkers and Runners $1 + 1 supply, Bloaters $4 + 3, Screamers $3 + 2, Brutes $10 + 6 [v4.5]. Fighting pays for itself a bit; holding a secured district still pays far better.
```

### Starting economy and balance targets

The tutorial starting target was $250, 100 supplies. No tutorial will be higher money and supplies.

### Horde counterattacks

Horde counterattacks are only sent when the noise meter for that district is full.

## 12. Unlocks and campaign progression

Unlocks continue to be driven primarily by restoring power in key districts rather than by a separate sprawling technology tree. Securing districts provides income, experience, and occasional reward items. Restored power and special buildings connects campaign progress to base facilities and new unit types.

##Progression
Players are able to progress however they'd like. (open world) Jumping in over your head will have obvious consequences. Each district unlocked and each power station restored will unlock the next thing.
```
Progress point                                            Unlock / reward

1st Power Station & 3 regions cleared                     Vehicle Bay

2nd Power Station & Region                                Vehicle Bay LVL 2; Logi truck.

3rd Power Station & Region                                Barracks LVL 2; Recon unit, Flame Team, and Mortar Team

4th Power Station & Region                                Medbay LVL 2; Medic Humvee (carries 3 medic squads and heals units in a small AOE)

5th Power Station & Region                                Command Post LVL 2; larger Supply Depot, artillery units in vehicle bay

6th Power Station & Region                                Vehicle Bay LVL 3; LAV and Battle Tank.

7th Power Station & Region                                Airfield; Hauler Helicopter, Hornet and Anvil gunships, plus aircraft and drone support. (must be available before the final district, not after it)

Downtown Core                                             Final campaign district; securing it and defeating Patient Zero wins the campaign.
```



### Reward items

Approximately one district in three, and every boss, can drop a one-off reward item such as suppressor kits, ceramic plates, enhacnced optics, or other squad equipment. Items are assigned to a squad and create meaningful force specialization. These "power ups" still need to be designed and fleshed out.

```
Supressor Kit: every memeber of a unit gets a surpressor if they don't already have one. This cuts sound output in half for that unit.

Ceramic Plates: Double health

Enhanced Optics: Double vision cone length

Med Bag: Unit heals passively over time.

more to be determined later.
```

## 13. Win conditions, defeat, and base security

- Current campaign loss model: The main base cannot be destroyed in the initial version. Losing outposts can cost district income and territory, but does not immediately end the campaign.
The player loses when zombies overrun the HQ and destroy the Command Post.

- Win condition: Secure Downtown Core and defeat Patient Zero.

- Squad wipe: A squad that loses every member is permanently gone, including its experience. This harsh loss rule is confirmed.

## 14. Visual and audio direction

The game is isometric first, not pixel art. It is a clean, full-resolution, anti-aliased 3D isometric world with stylised low-poly detail. Pixel art is at most a loose influence (chunky shapes, bold readable silhouettes, a little crunch in textures); there is no pixel filter or low-res rendering. It should feel like a detailed miniature battlefield, not flat sprites or a voxel game.

- Camera: Isometric perspective with smooth zoom between strategic overview and close battlefield view.

- World: Detailed ruined streets, buildings, interiors, vehicles, vegetation, debris, and fortifications.

- Materials: Pixel-inspired or low-resolution texture treatment, chunky geometry, stylized edges, and controlled detail.

- Lighting: Directional lighting, shadows, muzzle flashes, fire, smoke, and atmosphere should help communicate time, danger, and battlefield activity.

- Readability: Friendly units, zombies, cover, attack ranges, and selected formations must remain easy to distinguish at both close and strategic zoom levels.

- Animations: Infantry movement and firing, vehicle damage, helicopter landing/hovering, zombie swarms, climbing piles, Dragger tongue pulls, and Puker acid attacks should be visually legible. The original palette direction remains a useful reference: desaturated greys, browns, muddy teal, olive and tan for military units, and sickly yellow-green for zombies. Red remains reserved for infestation and danger.

- The current MVP visuals (code-built boxes) are placeholders for testing. The finished game aims for a detailed, sun-lit miniature city seen from a high isometric angle, based on reference images supplied in November 2026. Concretely:

- Real scale. Soldiers are small next to the world: a two-storey house is several times a soldier's height, and streets are wide multi-lane roads with sidewalks, crosswalks, streetlights and parked cars. The city should feel big and the squads should feel vulnerable in it.

- Detailed, readable buildings. Suburban houses with pitched tile or shingle roofs, porches, balconies, garages and fences; flat-roofed apartments and commercial blocks with rooftop clutter (AC units, solar panels); warehouses, an airfield and a desert outskirts biome. Palm and leafy trees, hedges, scrub, lawns.

- Lighting carries the mood. One strong sun with long, crisp shadows; a warm/neutral midday and an orange-brown dusk grade; at night, floodlights, searchlights, flares, muzzle flashes and fires do the lighting (ties into §14 day/night and the flare launcher).

- Massive crowds. Hordes are dense carpets of individual zombies: hundreds on screen routinely, thousands at a Last Stand and around neglected hives. Blood spatter on asphalt, bodies and debris persist. [v4.4] Implemented first pass: animated CC0 characters drawn with flipbook instancing (a few draw calls for any crowd size), corpses that lie where they fell, a 1,500-zombie cap, and Overrun hives that grow toward 300 locals.

- Spectacle that stays readable. Tank muzzle blasts, red tracer streams, explosion fireballs with sparks, rising black smoke columns from wrecks, dust clouds, helicopter rotor wash and fast-ropes, jets with afterburners on strike runs, artillery pieces with visible crews.

- Fortified bases look built. Tall modular walls with walkways and turret blocks, sandbag rings, gun pits, floodlight towers, vehicle gates.

- Labels on units. Small callsign tags with health pips over squads, vehicles and aircraft (e.g. SQ-14, TK-1, UH-3), and distance markers for off-screen SOS/objectives.

- Camera. Smoothly rotatable in 90° or free steps (compass readout), plus zoom from street level to a wide overview.

- UI direction (standard RTS conventions, styled to fit): a bottom strip of unit cards (portrait, callsign, health pips, filter tabs for ground/air), a support panel listing call-ins with remaining uses, a minimap with compass and legend, a top-centre day clock with "dusk in mm:ss", and a contextual construction bar (walls, defence, fire support, supply, lighting) with blueprints and placement help.

## What this means for production (decisions needed; see §16):

- Art assets. Code-generated boxes won't get there. The look needs modelled and textured 3D assets: buildings, vehicles, aircraft, props, soldiers and zombies with animation. Options: model in-house (e.g. Blender), license asset packs that match the style, or commission an artist. Whichever we choose, the renderer will load glTF models in place of the placeholder meshes; sim code doesn't change.
- World scale — DECIDED. 1 world unit = 1 metre. Navigation uses a 3 m grid, so a "64 × 64" starter zone is 64 × 64 grid cells = 192 × 192 m. Soldiers are 1.8 m, cars 4.6 m, buildings 6–15 m. Speeds and weapon ranges were doubled together (so fights close at the same pace) while the map grew 3×, and hearing scales with the map.
- Crowd tech. Thousands of zombies needs GPU-instanced, vertex-animated zombie meshes plus flow-field pathing, with the simulation in a Web Worker. This is the single biggest performance item and is the most likely trigger for the "move to desktop" decision in §15.
- Camera rotation — DONE. Q / E rotate in 90° steps with a compass readout. Building see-through/cutaway when a building hides units is still to do.
- Day/night cycle [v4]
(Moved up from "deferred"; now a planned feature.)

A full day/night cycle tied to the in-game day (and the daily upkeep tick).
Night cuts vision ranges, makes fog of war denser, and makes zombie behavior more dangerous (balance TBD: more active, bigger pulses).
Flares light up an area for a limited time. They can be fired by infantry, launched from outposts, or dropped by aircraft. Flares are noisy-bright: they may draw attention (balance TBD).
Vehicle and helo spotlights, muzzle flashes and fires become important light sources.
Colored smoke marking switches to flares/strobes at night (§8).

## Audio

Low-fi, grimy synth drones that swell as noise and horde pressure rise.
Distinct weapon sounds; layered zombie groans that grow with horde size.
Engine and aircraft audio feed the atmosphere and the noise system.
Gritty, dry radio chatter with occasional dark humor.
Sample lines:

Engineer: "Give me thirty seconds and a lot of sandbags."
Machine Gun Team: "I brought enough ammo to be rude."
Medic: "Stay down. That's medical advice and an order."
AC-130 [v4]: "Overlord on station. Ninety seconds of bad news, coming right up."


### Defer until after the core is fun

- Full campaign district set, later map areas, advanced hive progression, and all campaign bosses.

- All advanced infantry types, vehicles, helicopters, airstrike abilities, and drones.

- Dragger, Puker, zombie climbing piles, helicopter clinging, and soldier reanimation.

- Civilians, evacuation, and Guerrilla recruitment.

- Advanced base and outpost construction catalogue.

- Advanced individual infantry weapon customization and expanded weapon catalogue.

- Vehicle leveling bonuses and upgrade paths.

- Special endgame base-breach loss challenge.

- Expanded day/night cycle and long-term campaign balancing.

### Build order

```text
Step         Implementation focus
1            Prototype the isometric world, camera, zoom, and persistent city simulation.
2            Implement unit movement, selection, formations, and squad representation.
3            Implement combat and individual infantry member losses.
4            Implement squad AI, cover, and core orders.
5            Implement Walker/Runner AI, hives, noise, and horde response.
6            Implement base production, money, supplies, daily upkeep, and command limits.
7            Implement district infestation, fog of war, outposts, and power restoration.
8            Add leveling, repairs, and the first reward item.
9            Expand content and systems only after the core battlefield is enjoyable and stable.
```

Fun check: Before adding large amounts of content, test whether a small number of Rifle Squads holding a street against a Walker horde is satisfying. If the core encounter is not fun, improve it before building more systems on top.

## 16. Deferred design questions and tuning

The following items are intentionally left open so they do not block the core design or browser prototype.

- Vehicle progression: exact levels, bonuses, branching upgrades, and whether individual vehicle models have unique paths.

- Aircraft support: exact costs, cooldowns, target selection, damage radius, and the heavy plane's final name.

- Drone support: patrol duration, attack behavior, health, deployment limits, and whether drones must return for servicing.

- Guerrilla units: squad size, weapons, recruitment conditions, and whether they use the standard infantry progression system.

- Manual infantry loadouts: weapon availability, per-member inventory, costs, and balancing.

- Engineer construction: exact structure list, construction times, prices, supply costs, upgrade requirements, and whether structures can be repaired or salvaged. The confirmed rule is that engineers may build anywhere on the map.

- Day length and upkeep timing: how long an in-game day lasts and how the player is warned before daily supply deductions.

- RTB rules: which vehicles need to return, how servicing works, and whether helicopters and gunships use separate rearm/service locations.

- Direct-control input mapping: exact movement, aim, fire, and release controls for squads, vehicles, and helicopters.

- Continuous-world performance: simulation detail at strategic zoom, entity limits, streaming/visibility approach, and the point at which a desktop build becomes preferable.

- Late-game base-breach challenge: whether it is added and how the player receives warning and time to prepare. Design status: Core direction and the major decisions reviewed in November 2026 are confirmed. Numerical balance, detailed progression trees, and several advanced systems remain subject to prototyping and playtesting.

## Revision Addendum

## Revision Addendum

*GAME DESIGN DOCUMENT — REVISION ADDENDUM*

This addendum records the latest confirmed decisions about the seven-mission tutorial, the transition to the open world, and the loss and retaking of secured regions. It supplements the existing document. Where earlier wording conflicts with these rules, this addendum takes precedence.

## 17. Seven-mission starter tutorial and open-world transition

**Introductory missions.** The opening campaign consists of three tutorial missions/regions.The tutorial teaches the core systems progressively before the wider campaign opens.

**Restricted access during the tutorial.** Until the player completes the full seven-mission introductory sequence, access is limited to the main base and the starter tutorial sections made available by the tutorial. The player cannot freely enter the rest of the city or the wider open-world campaign during this period.

**Open-world unlock.** Upon completion of all introductory missions, the tutorial regions become part of the accessible open world. They remain connected parts of the same persistent city simulation rather than being discarded or replay-only tutorial levels. The player can travel back through them, defend them, and respond to renewed infestations.

## 18. Tutorial presentation and final test

The starter sequence is a guided tutorial, not simply a set of ordinary missions. During tutorial instruction, the game pauses while clear on-screen prompts explain the relevant mechanic and tell the player what to do. The simulation resumes when the player dismisses or completes the prompt, so the player has time to understand each new system without pressure from an advancing battle. Progressive instruction. Prompts should introduce controls and systems in a deliberate order, demonstrating each mechanic in the relevant starter area. Tutorial prompts should be concise, actionable, and tied to the current objective or interaction.

**Implementation status [v4.6].** The tutorial system is built and mission 1 (Roadside Motel) is scripted: 12 steps covering camera, selection, movement, cover, noise and targeting, fortifying, recruiting, Command Post support, the hive and securing the district. Each step pauses with a prompt; after "Got it" it becomes an objective banner while you play, the relevant HUD panel pulses, and steps you've already completed advance on their own. Missions 2–7 need their maps first.

**Final test.** The last larger starter region serves as a practical final test of what the player has learned. This section should combine previously introduced mechanics and require the player to apply them with less step-by-step instruction. They remain part of the tutorial sequence and must be completed before the wider open world unlocks.

## 19. Region loss, hive takeover, and progression regression

A secured region is not permanently safe. If zombies retake a region, the existing friendly outpost is lost and replaced by a zombie hive. This is a change in control of the region, not merely an increase to its infestation meter.

**Consequences of a takeover:**

- The friendly outpost is destroyed/removed and a hive occupies its place.

- The region is no longer secured; its income and outpost-based forward operating benefits are lost while the hive remains active.

- Infestation and zombie pressure return, and the new hive begins its own independent threat progression.

- The player must clear the region again, destroy the hive using fire or explosives, reduce infestation to the required secure state, and have engineers re-establish an outpost to reclaim it. Leaving a region unattended can therefore cause meaningful campaign regression: territory, income, forward presence, and local control can be lost, and the player may have to repeat the work required to secure that region.

The takeover should be visible and communicated to the player so it feels like a consequence of an evolving battlefield rather than an unexplained state change.

**Progression boundary:** The loss of a region reverses that region's secured status and its local benefits. It does not automatically revoke permanent global unlocks already earned elsewhere unless a future system explicitly defines such a rule.

## 20. Clarifications to earlier rules

- Engineers may construct field fortifications anywhere on the map; construction is not restricted to the main base or established outposts.

- The seven starter regions remain part of the persistent open world after the tutorial is completed.

- Earlier wording that describes an outpost merely falling and the region returning to a fixed infestation percentage is superseded by the takeover rule above: a full zombie retake replaces the outpost with a hive.

- Hives continuously spawn zombies while active, progress through four escalating threat stages, have an active-population/spawn limit for performance, and can only be destroyed with fire or explosives. Boss encounters remain separate from hive destruction.

**Design status:** These tutorial, open-world transition, and region-takeover rules are confirmed. Exact prompt timing, tutorial objective scripting, takeover thresholds, and balancing values remain implementation and playtesting details.
