/** All tunable numbers in one place. Everything here is a playtest target, not gospel. */
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
    hearingRadiusPerLoudness: 1.0, // world units per loudness point
  },

  horde: {
    pulseIntervalSec: 240,
    firstPulseDelaySec: 300,
    basePulseSize: 12,
    perStagePulseSize: 6,
  },

  hive: {
    hpByStage: [500, 750, 1000, 1250], // grows as it matures — kill it early
    stageDurationSec: [300, 360, 420], // time to advance stage 1→2, 2→3, 3→4
    spawnIntervalSec: [7, 5, 3.5, 2],
    spawnGroup: [2, 3, 4, 5],
    localCap: [16, 28, 40, 60],
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
    dangerCloseRadius: 3.2,
    xpPerKill: 1,
    levels: [
      { name: 'Recruit', xp: 0, hp: 1, dmg: 1 },
      { name: 'Regular', xp: 25, hp: 1.15, dmg: 1.1 },
      { name: 'Veteran', xp: 70, hp: 1.3, dmg: 1.2 },
      { name: 'Elite', xp: 150, hp: 1.3, dmg: 1.2 }, // Elite path choice is Tier 1+
    ],
  },
} as const;
