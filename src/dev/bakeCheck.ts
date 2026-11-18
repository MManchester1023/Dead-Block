// Dev-only page (dev-bakecheck.html): bake the whole cast as the game does and fingerprint every pose,
// to check an asset or loader change leaves the characters unchanged.
import { CHARACTER_SPECS, bakeCharacter } from '../render/characters';

const out: Record<string, unknown> = {};
for (const spec of CHARACTER_SPECS) {
  const book = await bakeCharacter(spec);
  for (const [clip, frames] of Object.entries(book.frames)) {
    let sum = 0;
    let abs = 0;
    let n = 0;
    let colors = 0;
    for (const g of frames) {
      const p = g.attributes.position.array as Float32Array;
      for (let i = 0; i < p.length; i++) {
        sum += p[i] * ((i % 7) + 1);
        abs += Math.abs(p[i]);
      }
      n += p.length;
      const c = g.attributes.color.array as Float32Array;
      for (let i = 0; i < c.length; i += 97) colors += c[i];
    }
    out[`${spec.key}.${clip}`] = { frames: frames.length, n, sum: +sum.toFixed(3), abs: +abs.toFixed(3), colors: +colors.toFixed(3) };
  }
}
(window as unknown as { __out: unknown }).__out = out;
document.title = 'ready';
