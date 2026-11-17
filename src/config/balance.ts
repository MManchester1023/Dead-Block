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
    disbandRefund: 0.25, // share of a squad's cost returned when it stands down at the Barracks
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
    // v4.12 (#72): hold 3 s after the last sound, then drain slowly
    holdSec: 3,
    decayPerSec: 1.25,
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

  // v4.9 (#46, #65): searching houses, and zombies holed up inside some of them
  search: {
    timeSec: 5,
    emptyChance: 0.3,
    supplies: [4, 12],
    moneyChance: 0.3,
    money: [8, 20],
    nestChance: 0.25, // share of buildings in infested districts with a few dead holed up inside
    nestSize: [1, 4],
    nestTriggerRange: 5, // metres from the walls: a squad this close disturbs them
    nestNoiseRange: 14, // gunfire this close to the walls brings them out too
    loudness: 0.8,
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
  /**
   * v4.13 (#75): each hive's brood is two pools that together make its total. Normal = Walkers and
   * Runners; medium = every other non-boss type. Per hive stage 1–4.
   */
  normalPool: readonly number[];
  mediumPool: readonly number[];
  /** Chance a hive spawn is a medium zombie (when the medium pool has room). */
  mediumChance: readonly number[];
  /** Share of normals that are Runners. */
  runnerShare: readonly number[];
  /** Medium share of the starting crowd, and the minimum number placed (so they're actually met). */
  mediumStart: number;
  mediumStartMin: number;
  firstPulseDelaySec: number;
  pulseIntervalSec: readonly number[];
  pulseSize: number; // multiplier on pulse size
}

export const DIFFICULTY: readonly DifficultyTier[] = [
  // Tutorial: young hives are busier than before (#32) but stages 3–4 are far calmer (#57)
  { name: 'Tutorial', zombieHp: 0.7, density: 0.85, spawnIntervalSec: [13, 10, 10, 9], spawnGroup: [1, 2, 2, 2],
    normalPool: [14, 28, 42, 56], mediumPool: [2, 4, 5, 7], mediumChance: [0.15, 0.18, 0.2, 0.22], runnerShare: [0.08, 0.14, 0.2, 0.25],
    mediumStart: 0.06, mediumStartMin: 3, firstPulseDelaySec: 600, pulseIntervalSec: [420, 330, 270, 240], pulseSize: 0.7 },
  // Easy (tutorial region 2, v4.13 #74): a real step up: more and tougher dead, Runner-heavy
  { name: 'Easy', zombieHp: 0.85, density: 1.15, spawnIntervalSec: [13, 12, 9, 7], spawnGroup: [1, 1, 2, 3],
    normalPool: [14, 24, 60, 120], mediumPool: [3, 4, 8, 12], mediumChance: [0.15, 0.2, 0.22, 0.25], runnerShare: [0.15, 0.25, 0.3, 0.35],
    mediumStart: 0.07, mediumStartMin: 4, firstPulseDelaySec: 420, pulseIntervalSec: [330, 260, 210, 180], pulseSize: 1 },
  { name: 'Standard', zombieHp: 1, density: 1, spawnIntervalSec: [18, 11, 7, 4], spawnGroup: [1, 2, 3, 4],
    normalPool: [10, 34, 105, 270], mediumPool: [2, 6, 15, 30], mediumChance: [0.12, 0.18, 0.22, 0.25], runnerShare: [0.08, 0.15, 0.22, 0.3],
    mediumStart: 0.06, mediumStartMin: 2, firstPulseDelaySec: 480, pulseIntervalSec: [300, 240, 200, 180], pulseSize: 1 },
];
