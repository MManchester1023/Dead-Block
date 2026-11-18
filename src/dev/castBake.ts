// Dev-only page (dev-bakecast.html, v4.47): bake the whole cast exactly as the game does, encode it as
// public/models/baked/cast.bin. Driven by tools/assets/bake-cast.cjs (which fingerprints the asset files).
import { CHARACTER_SPECS, bakeLive, castBakeKey, castSourceFiles } from '../render/characters';
import { encodeCast } from '../render/castFile';

const w = window as unknown as Record<string, unknown>;
w.castSourceFiles = castSourceFiles;
w.bakeCast = async (sources: string): Promise<{ b64: string; key: string; ms: number }> => {
  const t0 = performance.now();
  const books = await bakeLive();
  if (!books) throw new Error('bake failed');
  const bytes = await encodeCast(CHARACTER_SPECS.map((s) => books[s.key]), await castBakeKey(), sources);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { b64: btoa(bin), key: await castBakeKey(), ms: performance.now() - t0 };
};
document.title = 'ready';
