/** All tunable numbers in one place. Distances in metres, speeds in m/s (config/world.ts). Playtest targets, not gospel. */
export const BALANCE = {
  tickRate: 30, // simulation steps per second (sim time)
  maxSpeed: 4,

  economy: {
    startMoney: 250,
    startSupplies: 100,
    supplyCap: 150,
    commandCap: 8,
    dayLengthSec: 240,
    baseSuppliesPerDay: 40,
    securedDistrictMoneyPerMin: 30,
    securedDistrictSuppliesPerDay: 25,
    hiveBounty: 120,
    districtClearBounty: 200,
  },

  noise: {
    decayPerSec: 4, // district noise meter decay
    pulseThreshold: 100,
    // Gunshots carry well beyond sight (zombie sight ~14 m) and scale with the map, not with weapon
    // range: a rifle (2.2) is heard ~73 m away (over a third of a 192 m district), an MG (3.2) ~106 m.
    hearingRadiusPerLoudness: 33, // metres per loudness point
    maxHearingRadius: 180,
    mergeRadius: 6, // same-tick sounds this close merge into one louder event
  },

  horde: {
    pulseIntervalSec: 240,
    firstPulseDelaySec: 480, // starter zones: ~10–15 min pacing (doc §3), so the first pulse waits
    basePulseSize: 12,
    perStagePulseSize: 6,
  },

  hive: {
    hpByStage: [500, 750, 1000, 1250], // grows as it matures — kill it early
    stageDurationSec: [600, 420, 480], // time to advance stage 1→2, 2→3, 3→4
    spawnIntervalSec: [9, 5, 3.5, 2],
    spawnGroup: [1, 3, 4, 5],
    localCap: [12, 28, 40, 60],
    globalZombieCap: 260,
  },

  infestation: {
    perKill: { walker: 0.5, runner: 0.6, bloater: 1.5 } as Record<string, number>,
    hiveDestroyed: 45,
    floorWithHive: 1,
    regrowPerMinWithHive: 0.6, // infestation creeps up while hives live
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
