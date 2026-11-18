// Dev-only page (dev-clips.html): convert Mixamo FBX clips to the compact .clip.json the game loads.
//   ?files=models/characters/soldier/walk.fbx,models/...   → window.__out = { [file]: json }
import { loadClipFile, toClipJson } from '../render/clipFile';

const files = (new URLSearchParams(location.search).get('files') ?? '').split(',').filter(Boolean);
const out: Record<string, unknown> = {};
for (const f of files) {
  const c = await loadClipFile(f);
  if (c) out[f] = toClipJson(c);
}
(window as unknown as { __out: unknown }).__out = out;
document.title = 'ready';
