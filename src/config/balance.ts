/** All tunable numbers in one place. Distances in metres, speeds in m/s (config/world.ts). Playtest targets, not gospel. */
export const BALANCE = {
  tickRate: 30, // simulation steps per second (sim time)
  maxSpeed: 4,

  economy: {
    startMoney: 250,
    startSupplies: 100,
    supplyCap: 150,
    commandCap: 16, // v4.9: was 8 (four squads); a stage-4 hive needs more than that
    commandPerSecuredDistrict: 4,
    dayLengthSec: 720, // 12 real minutes per in-game day (playtest: 4 min felt far too fast)
    // v4.5: supplies trickle in continuously (a lump at the end of a 12-minute day starved the opening)
    baseSuppliesPerMin: 9,
    securedDistrictMoneyPerMin: 30,
    securedDistrictSuppliesPerMin: 5,
    hiveBounty: 120,
    districtClearBounty: 200,
  },

  noise: {
    // v4.9: the meter holds after the last sound, then drains gently (it used to drop as fast as it filled)
    holdSec: 12,
    decayPerSec: 2.5,
    pulseThreshold: 100,
    // Gunshots carry well beyond sight (zombie sight ~14 m) and scale with the map, not with weapon
    // range: a rifle (2.2) is heard ~110 m away (over half a 192 m district), an MG (3.2) ~160 m.
    hearingRadiusPerLoudness: 50, // metres per loudness point (v4.4: wider again)
    maxHearingRadius: 260,
    mergeRadius: 6, // same-tick sounds this close merge into one louder event
    // v4.9: distant sounds pull only part of the crowd. Every zombie within half the hearing radius
    // comes; at the edge only this share does (each zombie has a fixed "attentiveness", so repeated
    // shots don't eventually drag everyone). Hive guards stay home unless the sound is close.
    farResponse: 0.3,
    guardRadius: 35,
    guardHearing: 55,
  },

  zombie: {
    // Aggro is time-based first, then distance-based (playtest: they gave up too easily).
    // Once a zombie has seen you it hunts you for aggroTimeSec even out of sight; after that it
    // keeps coming as long as you're within leashDistance.
    aggroTimeSec: 20,
    leashDistance: 60,
    repathSec: 1.5,
  },

  horde: {
    basePulseSize: 12,
    perStagePulseSize: 10,
  },

  hive: {
    alarmRadius: 20, // a squad this close to a hive sets it off…
    alarmCallRadius: 45, // …and every zombie this close to the hive comes for it
    hpByStage: [500, 750, 1000, 1250], // grows as it matures — kill it early
    stageDurationSec: [600, 420, 480], // time to advance stage 1→2, 2→3, 3→4
    // spawn rates, caps and pulse timing live in DIFFICULTY (below), per district tier
    reinforceBelow: 0.25, // a hive whose brood is under this share of its cap spawns faster…
    reinforceRate: 0.6, // …at this multiple of its normal interval
    globalZombieCap: 1500, // sim handles ~2.5k at ~6 ms/tick; renderer crowds are sized for 2k
  },

  infestation: {
    perKill: { walker: 0.5, runner: 0.6, bloater: 1.5 } as Record<string, number>,
    hiveDestroyed: 45,
    floorWithHive: 1,
    regrowPerMinWithHive: 0.6, // infestation creeps up while hives live
    unpaidDrainPerSec: 0.5, // no hive: infestation above what's left to kill drains at this rate
  },

  combat: {
    coverReduction: 0.45,
    dangerCloseRadius: 6.4, // metres
    xpPerKill: 1,
    levels: [
      { name: 'Recruit', xp: 0, hp: 1, dmg: 1 },
      { name: 'Regular', xp: 25, hp: 1.15, dmg: 1.1 },
      { name: 'Veteran', xp: 70, hp: 1.3, dmg: 1.2 },
      { name: 'Elite', xp: 150, hp: 1.3, dmg: 1.2 }, // Elite path choice is Tier 1+
    ],
  },
} as const;

/**
 * Difficulty tiers per district (v4.9, playtest #51/#53/#57/#59). Tutorial regions start at tier 0
 * and ramp up; the open city uses tier 2+. Hive numbers are per stage 1–4.
 */
export interface DifficultyTier {
  name: string;
  zombieHp: number; // multiplier on base zombie HP
  density: number; // multiplier on starting population
  spawnIntervalSec: readonly number[];
  spawnGroup: readonly number[];
  localCap: readonly number[];
  firstPulseDelaySec: number;
  pulseIntervalSec: readonly number[];
  pulseSize: number; // multiplier on pulse size
  /** Runners + Bloaters allowed in the district at once: share of its zombies, and a hard ceiling. */
  specialShare: number;
  specialMax: number;
}

export const DIFFICULTY: readonly DifficultyTier[] = [
  // Tutorial: young hives are busier than before (#32) but stages 3–4 are far calmer (#57)
  { name: 'Tutorial', zombieHp: 0.7, density: 0.85, spawnIntervalSec: [13, 10, 10, 9], spawnGroup: [1, 2, 2, 2], localCap: [16, 32, 48, 64],
    firstPulseDelaySec: 600, pulseIntervalSec: [420, 330, 270, 240], pulseSize: 0.7, specialShare: 0.1, specialMax: 6 },
  { name: 'Easy', zombieHp: 0.85, density: 1, spawnIntervalSec: [20, 13, 9, 7], spawnGroup: [1, 2, 2, 3], localCap: [12, 32, 80, 150],
    firstPulseDelaySec: 540, pulseIntervalSec: [360, 280, 230, 200], pulseSize: 0.85, specialShare: 0.14, specialMax: 14 },
  { name: 'Standard', zombieHp: 1, density: 1, spawnIntervalSec: [18, 11, 7, 4], spawnGroup: [1, 2, 3, 4], localCap: [12, 40, 120, 300],
    firstPulseDelaySec: 480, pulseIntervalSec: [300, 240, 200, 180], pulseSize: 1, specialShare: 0.2, specialMax: 40 },
];

