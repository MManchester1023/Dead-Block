import * as THREE from 'three';
import type { Flipbook } from './characters';

/**
 * Pre-baked characters (STATUS #15, v4.47). Baking the cast (load the models and animation files, pose
 * every vertex for every frame) took ~5 s at every launch. `tools/assets/bake-cast.cjs` now does it once
 * and writes public/models/baked/cast.bin; the game reads that in a fraction of the time and only bakes
 * live when the file is missing or out of date (its `key` must match the current character settings).
 *
 * The file: a gzip of [4-byte JSON length][JSON header][binary]. Per pose: positions as 16-bit integers
 * (1 mm steps) stored as the difference from the previous pose of the same clip (poses barely move from
 * one to the next, so this compresses well), normals as 8-bit integers (also as differences), colours as
 * 8-bit, triangle lists as 16/32-bit. Colour and index arrays that repeat are stored once. Integer arrays
 * are byte-split (all low bytes, then all high bytes) before compressing, which gzip likes.
 * Loaded, colours and normals stay 8-bit on the graphics card (half the memory of 32-bit floats).
 */

const Q = 0.001; // metres per position step (1 mm)
export const CAST_FORMAT = 1;

interface FrameRef {
  v: number; // vertex count
  color: number; // index into the shared-array table
  index: number; // -1 = not indexed
}
interface Header {
  format: number;
  key: string;
  /** Fingerprint of the asset files baked (models, clips, textures, guns); checked by tests/castfile.test.ts. */
  sources?: string;
  books: {
    key: string;
    deathFalls: boolean;
    durations: Record<string, number>;
    loops: Record<string, boolean>;
    clips: Record<string, FrameRef[]>;
  }[];
  /** Shared colour (Uint8) and index (Uint16/Uint32) arrays: type, length. */
  tables: { type: 'u8' | 'u16' | 'u32'; n: number }[];
}

// ---------------------------------------------------------------- helpers

function split16(a: Int16Array | Uint16Array): Uint8Array {
  const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const out = new Uint8Array(b.length);
  const n = a.length;
  for (let i = 0; i < n; i++) {
    out[i] = b[i * 2];
    out[n + i] = b[i * 2 + 1];
  }
  return out;
}
function join16(b: Uint8Array, n: number): Uint8Array {
  const out = new Uint8Array(n * 2);
  for (let i = 0; i < n; i++) {
    out[i * 2] = b[i];
    out[i * 2 + 1] = b[n + i];
  }
  return out;
}
function split32(a: Uint32Array): Uint8Array {
  const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const out = new Uint8Array(b.length);
  const n = a.length;
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) out[k * n + i] = b[i * 4 + k];
  return out;
}
function join32(b: Uint8Array, n: number): Uint8Array {
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) out[i * 4 + k] = b[k * n + i];
  return out;
}
const hashArr = (a: ArrayLike<number>) => {
  let h = 2166136261 ^ a.length;
  for (let i = 0; i < a.length; i++) h = Math.imul(h ^ a[i], 16777619);
  return `${a.length}:${h >>> 0}`;
};

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([data]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** A key for "the settings these characters were baked from" (specs, gun fits, bake constants). */
export function castKey(parts: unknown): string {
  const s = JSON.stringify(parts);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619);
    h2 = Math.imul(h2 + s.charCodeAt(i), 2246822519);
  }
  return `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}-${s.length}`;
}

// ---------------------------------------------------------------- encode (bake tool)

export async function encodeCast(books: Flipbook[], key: string, sources?: string): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const tables: Header['tables'] = [];
  const tableIds = new Map<string, number>();
  const table = (arr: Uint8Array | Uint16Array | Uint32Array, type: 'u8' | 'u16' | 'u32') => {
    const h = `${type}|${hashArr(arr)}`;
    let id = tableIds.get(h);
    if (id === undefined) {
      id = tables.length;
      tables.push({ type, n: arr.length });
      tableIds.set(h, id);
      chunks.push(type === 'u8' ? (arr as Uint8Array) : type === 'u16' ? split16(arr as Uint16Array) : split32(arr as Uint32Array));
    }
    return id;
  };
  const header: Header = { format: CAST_FORMAT, key, sources, books: [], tables };
  for (const b of books) {
    const hb: Header['books'][number] = { key: b.key, deathFalls: b.deathFalls, durations: b.durations, loops: b.loops, clips: {} };
    for (const [clip, frames] of Object.entries(b.frames)) {
      let prevP: Int16Array | null = null;
      let prevN: Int8Array | null = null;
      hb.clips[clip] = frames.map((g) => {
        const pos = g.attributes.position;
        const nor = g.attributes.normal;
        const col = g.attributes.color;
        const v = pos.count;
        // positions: 0.5 mm steps, as the change from the previous pose (same vertex count) or absolute
        const P = new Int16Array(v * 3);
        for (let i = 0; i < v; i++) {
          P[i * 3] = Math.round(pos.getX(i) / Q);
          P[i * 3 + 1] = Math.round(pos.getY(i) / Q);
          P[i * 3 + 2] = Math.round(pos.getZ(i) / Q);
        }
        const N = new Int8Array(v * 3);
        for (let i = 0; i < v; i++) {
          N[i * 3] = Math.round(nor.getX(i) * 127);
          N[i * 3 + 1] = Math.round(nor.getY(i) * 127);
          N[i * 3 + 2] = Math.round(nor.getZ(i) * 127);
        }
        const dP = new Int16Array(P.length);
        const dN = new Int8Array(N.length);
        const same = prevP && prevP.length === P.length;
        for (let i = 0; i < P.length; i++) dP[i] = same ? P[i] - prevP![i] : P[i];
        for (let i = 0; i < N.length; i++) dN[i] = same ? N[i] - prevN![i] : N[i];
        prevP = P;
        prevN = N;
        chunks.push(split16(dP), new Uint8Array(dN.buffer));
        const C = new Uint8Array(v * 3);
        for (let i = 0; i < v; i++) {
          C[i * 3] = Math.max(0, Math.min(255, Math.round(col.getX(i) * 255)));
          C[i * 3 + 1] = Math.max(0, Math.min(255, Math.round(col.getY(i) * 255)));
          C[i * 3 + 2] = Math.max(0, Math.min(255, Math.round(col.getZ(i) * 255)));
        }
        const color = table(C, 'u8');
        let index = -1;
        if (g.index) {
          const big = v > 65535;
          const I = big ? new Uint32Array(g.index.array as ArrayLike<number>) : new Uint16Array(g.index.array as ArrayLike<number>);
          index = table(I, big ? 'u32' : 'u16');
        }
        return { v, color, index };
      });
    }
    header.books.push(hb);
  }
  const json = new TextEncoder().encode(JSON.stringify(header));
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, json.length, true);
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const raw = new Uint8Array(4 + json.length + total);
  raw.set(len, 0);
  raw.set(json, 4);
  let o = 4 + json.length;
  // one stream: each pose's positions and normals, followed by any colour/index table it uses for the
  // first time; the decoder replays it in the same order
  for (const c of chunks) {
    raw.set(c, o);
    o += c.length;
  }
  return pipe(raw, new CompressionStream('gzip'));
}

// ---------------------------------------------------------------- decode (game)

/** The cast from a pre-baked file, or null if it's missing, unreadable or baked from other settings. */
export async function decodeCast(gz: Uint8Array, key: string): Promise<Record<string, Flipbook> | null> {
  const raw = await pipe(gz, new DecompressionStream('gzip'));
  const jl = new DataView(raw.buffer, raw.byteOffset).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(raw.subarray(4, 4 + jl))) as Header;
  if (header.format !== CAST_FORMAT || header.key !== key) return null;
  let o = 4 + jl;
  // the encoder interleaved frames and first-seen tables in one stream: replay it in the same order
  const tables: (THREE.BufferAttribute | null)[] = header.tables.map(() => null);
  let nextTable = 0;
  const readTable = (id: number, itemSize: number, isColor: boolean): THREE.BufferAttribute => {
    while (nextTable <= id) {
      const t = header.tables[nextTable];
      let arr: Uint8Array | Uint16Array | Uint32Array;
      if (t.type === 'u8') {
        arr = raw.slice(o, o + t.n);
        o += t.n;
      } else if (t.type === 'u16') {
        arr = new Uint16Array(join16(raw.subarray(o, o + t.n * 2), t.n).buffer);
        o += t.n * 2;
      } else {
        arr = new Uint32Array(join32(raw.subarray(o, o + t.n * 4), t.n).buffer);
        o += t.n * 4;
      }
      tables[nextTable] = isColor && t.type === 'u8' ? new THREE.BufferAttribute(arr, 3, true) : new THREE.BufferAttribute(arr, itemSize);
      nextTable++;
    }
    return tables[id]!;
  };
  const out: Record<string, Flipbook> = {};
  for (const hb of header.books) {
    const frames: Record<string, THREE.BufferGeometry[]> = {};
    for (const [clip, refs] of Object.entries(hb.clips)) {
      let prevP: Int16Array | null = null;
      let prevN: Int8Array | null = null;
      frames[clip] = refs.map((r) => {
        const n = r.v * 3;
        const dP = new Int16Array(join16(raw.subarray(o, o + n * 2), n).buffer);
        o += n * 2;
        const dN = new Int8Array(raw.buffer, raw.byteOffset + o, n).slice();
        o += n;
        const same = prevP && prevP.length === n;
        const P = new Int16Array(n);
        const N = new Int8Array(n);
        for (let i = 0; i < n; i++) {
          P[i] = same ? prevP![i] + dP[i] : dP[i];
          N[i] = same ? prevN![i] + dN[i] : dN[i];
        }
        prevP = P;
        prevN = N;
        const pos = new Float32Array(n);
        for (let i = 0; i < n; i++) pos[i] = P[i] * Q;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(N, 3, true));
        // the colour (and index) table entry this pose uses may come right after it in the stream
        g.setAttribute('color', readTable(r.color, 3, true));
        if (r.index >= 0) g.setIndex(readTable(r.index, 1, false));
        g.computeBoundingSphere();
        return g;
      });
    }
    out[hb.key] = { key: hb.key, deathFalls: hb.deathFalls, frames, durations: hb.durations, loops: hb.loops };
  }
  return out;
}
