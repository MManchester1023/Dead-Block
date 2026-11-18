import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { CHARACTER_SPECS, castSourceFiles } from '../src/render/characters';

/**
 * The pre-baked cast (STATUS #15, v4.47) must match the asset files it was baked from. If this fails, a
 * character model, clip, texture, gun or gun fit changed: re-run `node tools/assets/bake-cast.cjs` (with
 * the dev server up). The game itself also checks the character settings and falls back to a live bake.
 */
describe('pre-baked cast (public/models/baked/cast.bin)', () => {
  const raw = zlib.gunzipSync(fs.readFileSync(path.join(__dirname, '../public/models/baked/cast.bin')));
  const jl = raw.readUInt32LE(0);
  const header = JSON.parse(raw.subarray(4, 4 + jl).toString('utf8'));

  it('was baked from the current asset files', () => {
    const h = crypto.createHash('sha1');
    for (const f of castSourceFiles()) {
      h.update(f);
      h.update(fs.readFileSync(path.join(__dirname, '../public', f)));
    }
    expect(header.sources, 'the character assets changed since the bake: run node tools/assets/bake-cast.cjs').toBe(h.digest('hex'));
  });

  it('has every character the game uses', () => {
    expect(header.books.map((b: { key: string }) => b.key).sort()).toEqual(CHARACTER_SPECS.map((s) => s.key).sort());
  });
});
