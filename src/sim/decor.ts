// Street furniture and greenery placement (moved here from render/procgen/props.ts in v4.80 so the simulation
// can know where lamp posts are: vehicles steer around them, round 17 #208). Pure: map + grid in, placements out.
import { Rng } from '../core/rng';
import { Tile, type CityMap } from './map';
import type { NavGrid } from './grid';

export type DecorKind = 'palm' | 'tree' | 'shrub' | 'streetlight' | 'hydrant' | 'pit';
export interface DecorPlacement {
  kind: DecorKind;
  x: number;
  z: number;
  ry: number;
  scale: number;
  seed: number;
}

/**
 * Street furniture and greenery, placed deterministically from the map: streetlights and palms
 * along sidewalks, trees/shrubs in open scrub. Purely cosmetic: none of it blocks movement.
 * Returns placements so each kind can be drawn procedurally or swapped for a loaded model.
 */
export function scatterDecor(map: CityMap, grid: NavGrid): DecorPlacement[] {
  const out: DecorPlacement[] = [];
  const put = (kind: DecorKind, x: number, z: number, ry = 0, scale = 1) => out.push({ kind, x, z, ry, scale, seed: Math.floor(x * 131 + z * 977) });
  const rng = new Rng(77);
  const tile = (x: number, y: number) => {
    const cx = Math.floor(x / map.cell);
    const cy = Math.floor(y / map.cell);
    return cx < 0 || cy < 0 || cx >= map.cols || cy >= map.rows ? -1 : map.tiles[cy * map.cols + cx];
  };
  const inBase = (x: number, y: number) => x > map.baseRect.x - 6 && x < map.baseRect.x + map.baseRect.w + 6 && y > map.baseRect.y - 6 && y < map.baseRect.y + map.baseRect.h + 6;
  const nearIntersection = (x: number, y: number) =>
    map.roads.some((a) => a.axis === 'v' && x > a.rect.x - 9 && x < a.rect.x + a.rect.w + 9) && map.roads.some((a) => a.axis === 'h' && y > a.rect.y - 9 && y < a.rect.y + a.rect.h + 9);

  for (const road of map.roads) {
    const r = road.rect;
    const horiz = road.axis === 'h';
    const len = horiz ? r.w : r.h;
    for (const side of [-1, 1]) {
      // sidewalk centre line, 1.5 m beyond the road edge
      const off = side < 0 ? -1.5 : (horiz ? r.h : r.w) + 1.5;
      for (let s = 6; s < len; s += 12) {
        const x = horiz ? r.x + s : r.x + off;
        const y = horiz ? r.y + off : r.y + s;
        if (inBase(x, y) || nearIntersection(x, y) || tile(x, y) !== Tile.Sidewalk || grid.isBlockedXY(x, y)) continue;
        const k = Math.round(s / 12);
        if (k % 2 === 0) put('streetlight', x, y, horiz ? (side < 0 ? Math.PI / 2 : -Math.PI / 2) : side < 0 ? 0 : Math.PI);
        else if (rng.chance(0.75)) {
          // round 15 #189: not out of the concrete: on the grass just past the sidewalk if there is some,
          // otherwise in a tree pit
          const out = side < 0 ? -map.cell : map.cell;
          const gx = horiz ? x : x + out;
          const gy = horiz ? y + out : y;
          const g = tile(gx, gy);
          if ((g === Tile.Grass || g === Tile.Dirt) && !grid.isBlockedXY(gx, gy)) put('palm', gx, gy);
          else {
            put('pit', x, y);
            put('palm', x, y);
          }
        }
        if (rng.chance(0.08)) put('hydrant', x + 1.2, y + 0.6);
      }
    }
  }

  // greenery on open ground (round 17 #209, owner: "a lot more": ~3× the trees, many in small clumps)
  const open = (x: number, y: number) => {
    const t = tile(x, y);
    if ((t !== Tile.Grass && t !== Tile.Dirt) || inBase(x, y) || grid.isBlockedXY(x, y)) return false;
    // keep clear of the pavement so trees don't sprout in the road
    return ![[-3, 0], [3, 0], [0, -3], [0, 3]].some(([dx, dy]) => [Tile.Road, Tile.Sidewalk, Tile.Parking].includes(tile(x + dx, y + dy)));
  };
  const grove = new Rng(178); // its own sequence, so the street furniture above is unchanged
  for (let i = 0; i < 1800; i++) {
    const x = rng.range(0, map.width);
    const y = rng.range(0, map.height);
    if (!open(x, y)) continue;
    const roll = rng.next();
    if (roll < 0.3) {
      put('tree', x, y);
      // half the trees stand in a little clump of 2–4
      if (grove.chance(0.5))
        for (let k = grove.int(1, 3); k > 0; k--) {
          const a = grove.range(0, Math.PI * 2), r = grove.range(3.5, 7);
          const cx = x + Math.cos(a) * r, cy = y + Math.sin(a) * r;
          if (open(cx, cy)) put('tree', cx, cy, 0, grove.range(0.8, 1.1));
        }
    } else if (roll < 0.4) put('palm', x, y, 0, 0.9);
    else if (roll < 0.7) put('shrub', x, y);
  }
  return out;
}
