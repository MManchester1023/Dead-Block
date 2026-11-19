import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/World';
import { Tile } from '../src/sim/map';
import { scatterDecor } from '../src/render/procgen/props';

describe('round 15 quick fixes (v4.71)', () => {
  it('no street tree grows out of the sidewalk: on the grass beside it, or in a tree pit (#189)', () => {
    const w = new World({ seed: 1, fixedHives: true });
    const m = w.map;
    const decor = scatterDecor(m, w.grid);
    const tile = (x: number, y: number) => m.tiles[Math.floor(y / m.cell) * m.cols + Math.floor(x / m.cell)];
    const trees = decor.filter((d) => d.kind === 'palm' || d.kind === 'tree');
    const onSidewalk = trees.filter((d) => tile(d.x, d.z) === Tile.Sidewalk);
    const pits = decor.filter((d) => d.kind === 'pit');
    for (const t of onSidewalk) expect(pits.some((p) => p.x === t.x && p.z === t.z), `tree at ${t.x},${t.z}`).toBe(true);
    const moved = trees.filter((d) => tile(d.x, d.z) === Tile.Grass || tile(d.x, d.z) === Tile.Dirt).length;
    console.log(`street trees: ${onSidewalk.length} in pits, ${pits.length} pits; ${moved} trees on grass/dirt overall`);
    expect(pits.length).toBe(onSidewalk.length);
  });
});
