/**
 * Doc §14 palette: desaturated greys/browns/teal/olive/tan for the military,
 * sickly yellow-green for the dead, red reserved for infestation and danger.
 */
export const PAL = {
  tiles: {
    0: 0x5a5444, // dirt
    1: 0x3b3d3f, // road
    2: 0x6b6a64, // sidewalk
    3: 0x6f716b, // base concrete
    4: 0x4a4b4a, // parking
    5: 0x2a2a2a, // under buildings
    6: 0x545a40, // scrub grass
  } as Record<number, number>,
  roadLine: 0x9a8f5a,
  olive: 0x4c5a32,
  tan: 0x9c8a62,
  engineer: 0x8a7a4a,
  skin: 0xc9a27e,
  helmet: 0x434a2c,
  zombieSkin: 0x9aa65a,
  walker: 0xb3c25a,
  runner: 0xcfd05a,
  bloater: 0xc8cf7a,
  hive: 0x6b2236,
  hiveGlow: 0xc23a4a,
  infest: 0x9a2a2a,
  select: 0x9fe07a,
  tracer: 0xffe9a0,
  sandbag: 0x9c8a62,
  wire: 0x3a3a36,
  concrete: 0x8a8a84,
  danger: 0xd2443a,
  blood: 0x2f3a1a,
};
