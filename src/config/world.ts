/**
 * World scale (doc §14 v4.1): **1 world unit = 1 metre**, everywhere in the simulation and renderer.
 *
 * The navigation grid is coarser than that: each nav cell is CELL metres square. Map authoring,
 * structure footprints and pathfinding work in cells; positions, speeds, ranges and radii are metres.
 * Imported glTF models (authored in metres) drop in at scale 1.
 */
export const CELL = 3;

/** Reference human height, for sizing models and labels. */
export const HUMAN_HEIGHT = 1.8;
