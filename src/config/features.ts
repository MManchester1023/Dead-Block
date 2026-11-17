/**
 * Feature registry — mirrors the priority roadmap in docs/Dead_Block_Command_Design_Doc_v4.md §21.
 *
 * Systems check `isEnabled(id)` before running optional behaviour. A feature that is
 * listed here but disabled has a hook somewhere in the code (search for its id) so it
 * can be switched on as it gets built, instead of being bolted on later.
 */
export type Tier = 0 | 1 | 2 | 3 | 4;

export interface FeatureDef {
  id: string;
  name: string;
  tier: Tier;
  enabled: boolean;
  docRef: string;
}

export const FEATURES = [
  // Tier 0 — MVP core
  { id: 'isoWorld', name: 'Isometric world, camera, persistent sim', tier: 0, enabled: true, docRef: '§2, §15' },
  { id: 'orders', name: 'Select / move / attack-move / hold / stop / waypoints / cover', tier: 0, enabled: true, docRef: '§4' },
  { id: 'squadMembers', name: 'Individual member losses, permanent wipes', tier: 0, enabled: true, docRef: '§7' },
  { id: 'threatTargeting', name: 'Threat-priority focus fire', tier: 0, enabled: true, docRef: '§5' },
  { id: 'hives', name: 'Hives with 4 stages', tier: 0, enabled: true, docRef: '§9' },
  { id: 'noise', name: 'Noise & horde pulses', tier: 0, enabled: true, docRef: '§9, §11' },
  { id: 'economy', name: 'Money, supplies, daily upkeep, command cap', tier: 0, enabled: true, docRef: '§11' },
  { id: 'outposts', name: 'District infestation & engineer outposts', tier: 0, enabled: true, docRef: '§2, §6' },
  { id: 'fieldFortifications', name: 'Engineer field fortifications anywhere', tier: 0, enabled: true, docRef: '§6' },
  { id: 'staticCarCover', name: 'Static cars as cover', tier: 0, enabled: true, docRef: '§5' },

  // Tier 1 — make the core deep
  { id: 'leveling', name: 'XP & levels (Recruit → Veteran; Elite paths later)', tier: 1, enabled: true, docRef: '§7' },
  { id: 'fogOfWar', name: 'Fog of war & recon', tier: 1, enabled: false, docRef: '§2' },
  { id: 'outpostResupply', name: 'Outpost local stock & resupply runs', tier: 1, enabled: false, docRef: '§6' },
  { id: 'knockback', name: 'Explosion knockback (friend & foe)', tier: 1, enabled: true, docRef: '§5' },
  { id: 'powerStations', name: 'Power restoration & base unlocks', tier: 1, enabled: false, docRef: '§2, §12' },
  { id: 'regionTakeover', name: 'Lost outpost becomes a hive', tier: 1, enabled: true, docRef: '§19' },
  { id: 'tutorial', name: 'Paused-prompt tutorial (mission 1 of 7 scripted)', tier: 1, enabled: true, docRef: '§17, §18' },

  // Tier 2 — escalation and spectacle
  { id: 'dayNight', name: 'Day/night cycle & flares', tier: 2, enabled: false, docRef: '§14' },
  { id: 'destruction', name: 'Building collapse, permanent rubble, tank car-crushing', tier: 2, enabled: false, docRef: '§6a' },
  { id: 'vehicles', name: 'Ground vehicles & sheet-metal armor', tier: 2, enabled: false, docRef: '§7' },
  { id: 'artillery', name: 'Artillery & strike patterns', tier: 2, enabled: false, docRef: '§7' },
  { id: 'rooftops', name: 'Elite rooftop access; zombie pile-ups onto roofs', tier: 2, enabled: false, docRef: '§5, §9' },
  { id: 'tallWalls', name: 'Tall concrete walls & loudspeaker', tier: 2, enabled: false, docRef: '§6' },
  { id: 'specialZombies', name: 'Screamer, Brute, Dragger, Puker, reanimation', tier: 2, enabled: false, docRef: '§9' },
  { id: 'lastStand', name: 'Last Stand defeat mode', tier: 2, enabled: false, docRef: '§13' },

  // Tier 3 — air power and late game
  { id: 'airfield', name: 'Helicopters incl. rappelling & Sparrow', tier: 3, enabled: false, docRef: '§8' },
  { id: 'airSupport', name: 'Call-ins with colored smoke incl. AC-130', tier: 3, enabled: false, docRef: '§8' },
  { id: 'bosses', name: 'Bosses', tier: 3, enabled: false, docRef: '§9' },
  { id: 'humanFaction', name: 'Human enemy faction', tier: 3, enabled: false, docRef: '§9a' },

  // Tier 4 — polish and attachment
  { id: 'armoryCustomization', name: 'Weapon customization & Elite cosmetics', tier: 4, enabled: false, docRef: '§7' },
  { id: 'civilians', name: 'Civilians, evacuation, Guerrillas', tier: 4, enabled: false, docRef: '§10' },
  { id: 'airdrops', name: 'Airdrop upgrades', tier: 4, enabled: false, docRef: '§11' },
] as const satisfies readonly FeatureDef[];

export type FeatureId = (typeof FEATURES)[number]['id'];

const state = new Map<string, boolean>(FEATURES.map((f) => [f.id, f.enabled]));

export function isEnabled(id: FeatureId): boolean {
  return state.get(id) ?? false;
}

/** For tests and dev toggles. */
export function setFeature(id: FeatureId, on: boolean): void {
  state.set(id, on);
}
