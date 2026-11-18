import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

/**
 * Animation clips (quick win after STATUS #12). A Mixamo download is a whole FBX: the clip, its
 * skeleton and often a full copy of the character's mesh (~0.5–2.3 MB each). The game only needs the
 * keyframes and the hips' rest height, so clips are converted (dev-clips.html) to a compact `.clip.json`:
 * every track kept, with bones that never move stored as a single key (same pose, a fraction of the size).
 * FBX still loads, for new clips that haven't been converted yet.
 */

export interface LoadedClip {
  clip: THREE.AnimationClip;
  /** Rest height of the hips in the file's own skeleton (its units can differ from the model's). */
  hipsY?: number;
}

interface ClipJson {
  v: 1;
  name: string;
  duration: number;
  hipsY?: number;
  /** Shared key-time arrays, base64 Float32. */
  times: string[];
  tracks: { name: string; type: 'quaternion' | 'vector'; times: number; values: string }[];
}

const b64 = (a: Float32Array): string => {
  const u8 = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string): Float32Array => {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Float32Array(u8.buffer);
};

export async function loadClipFile(url: string): Promise<LoadedClip | null> {
  if (url.endsWith('.json')) {
    const j = (await (await fetch(url)).json()) as ClipJson;
    const times = j.times.map(unb64);
    const tracks = j.tracks.map((t) =>
      t.type === 'quaternion' ? new THREE.QuaternionKeyframeTrack(t.name, times[t.times], unb64(t.values)) : new THREE.VectorKeyframeTrack(t.name, times[t.times], unb64(t.values)),
    );
    return { clip: new THREE.AnimationClip(j.name, j.duration, tracks), hipsY: j.hipsY };
  }
  const a = await new FBXLoader().loadAsync(url);
  if (!a.animations[0]) return null;
  let hipsY: number | undefined;
  a.traverse((o) => {
    if ((o as THREE.Bone).isBone && /hips$/i.test(o.name) && hipsY === undefined) hipsY = o.position.y;
  });
  return { clip: a.animations[0], hipsY };
}

/** The compact form of a loaded clip (used by dev-clips.html). Tracks that never change keep one key. */
export function toClipJson(c: LoadedClip): ClipJson {
  const times: Float32Array[] = [];
  const timeIndex = (t: Float32Array) => {
    const i = times.findIndex((x) => x.length === t.length && x.every((v, k) => v === t[k]));
    if (i >= 0) return i;
    times.push(t);
    return times.length - 1;
  };
  const tracks = c.clip.tracks.map((tr) => {
    const n = tr.getValueSize();
    const vals = tr.values as Float32Array;
    let constant = true;
    for (let i = n; i < vals.length && constant; i++) if (vals[i] !== vals[i % n]) constant = false;
    const t = constant ? new Float32Array([tr.times[0]]) : new Float32Array(tr.times);
    const v = constant ? new Float32Array(vals.subarray(0, n)) : new Float32Array(vals);
    return { name: tr.name, type: (tr instanceof THREE.QuaternionKeyframeTrack ? 'quaternion' : 'vector') as 'quaternion' | 'vector', times: timeIndex(t), values: b64(v) };
  });
  return { v: 1, name: c.clip.name, duration: c.clip.duration, hipsY: c.hipsY, times: times.map(b64), tracks };
}
