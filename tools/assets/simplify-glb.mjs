// Shrink a static model (no textures, no animation) to something the game can repeat many times: bakes
// every node transform, merges all meshes into one, welds duplicate vertices, simplifies to about
// `targetTris` triangles with meshoptimizer, centres it on the ground with its long side along X and
// scales that side to `lengthM` metres. Writes a GLB with positions, normals and indices only (the game
// gives it its own material). v4.39: the owner's barbed wire (245k → ~4k triangles).
//   node tools/assets/simplify-glb.mjs in.glb out.glb [targetTris=4000] [lengthM=1]
import fs from 'node:fs';
import { MeshoptSimplifier } from 'meshoptimizer';

const [src, dst, targetArg, lengthArg] = process.argv.slice(2);
const targetTris = Number(targetArg ?? 4000);
const lengthM = Number(lengthArg ?? 1);
const d = fs.readFileSync(src);
const jl = d.readUInt32LE(12);
const j = JSON.parse(d.subarray(20, 20 + jl).toString());
const bin = d.subarray(20 + jl + 8);

const COMP = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array };
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function read(ai) {
  const a = j.accessors[ai];
  const bv = j.bufferViews[a.bufferView];
  const T = COMP[a.componentType];
  const n = NUM[a.type];
  const off = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const stride = bv.byteStride ?? n * T.BYTES_PER_ELEMENT;
  const out = new Float64Array(a.count * n);
  for (let i = 0; i < a.count; i++)
    for (let k = 0; k < n; k++) {
      const p = off + i * stride + k * T.BYTES_PER_ELEMENT;
      out[i * n + k] = T === Float32Array ? bin.readFloatLE(p) : T === Uint32Array ? bin.readUInt32LE(p) : T === Uint16Array ? bin.readUInt16LE(p) : bin.readUInt8(p);
    }
  return out;
}

// column-major 4x4 helpers
const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
function local(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale ?? [1, 1, 1];
  const [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

const pos = [];
const idx = [];
function walk(ni, parent) {
  const n = j.nodes[ni];
  const m = mul(parent, local(n));
  if (n.mesh != null)
    for (const prim of j.meshes[n.mesh].primitives) {
      const P = read(prim.attributes.POSITION);
      const base = pos.length / 3;
      for (let i = 0; i < P.length; i += 3) {
        const [x, y, z] = [P[i], P[i + 1], P[i + 2]];
        pos.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
      }
      const I = prim.indices != null ? read(prim.indices) : Float64Array.from({ length: P.length / 3 }, (_, i) => i);
      for (const v of I) idx.push(base + v);
    }
  for (const c of n.children ?? []) walk(c, m);
}
const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
for (const r of j.scenes[j.scene ?? 0].nodes) walk(r, I4);

// weld vertices that share a position (the simplifier needs connected triangles)
const key = (i) => `${pos[i * 3].toFixed(5)},${pos[i * 3 + 1].toFixed(5)},${pos[i * 3 + 2].toFixed(5)}`;
const remap = new Map();
const wpos = [];
const map = new Uint32Array(pos.length / 3);
for (let i = 0; i < pos.length / 3; i++) {
  const k = key(i);
  let t = remap.get(k);
  if (t == null) {
    t = wpos.length / 3;
    remap.set(k, t);
    wpos.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  }
  map[i] = t;
}
const windex = Uint32Array.from(idx, (v) => map[v]);
const P = Float32Array.from(wpos);

await MeshoptSimplifier.ready;
const [simple] = MeshoptSimplifier.simplify(windex, P, 3, Math.min(windex.length, targetTris * 3), 0.05);
let outIdx = simple;
if (outIdx.length / 3 > targetTris * 1.5) [outIdx] = [MeshoptSimplifier.simplifySloppy(windex, P, 3, targetTris * 3, 0.05)[0]];

// compact to the vertices still used; long side along X, base on the ground, centred, scaled
const used = new Map();
const cp = [];
const ci = new Uint32Array(outIdx.length);
outIdx.forEach((v, i) => {
  let t = used.get(v);
  if (t == null) {
    t = cp.length / 3;
    used.set(v, t);
    cp.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
  }
  ci[i] = t;
});
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < cp.length; i += 3) for (let k = 0; k < 3; k++) (min[k] = Math.min(min[k], cp[i + k])), (max[k] = Math.max(max[k], cp[i + k]));
const swapXZ = max[2] - min[2] > max[0] - min[0];
const len = swapXZ ? max[2] - min[2] : max[0] - min[0];
const s = lengthM / len;
const out = new Float32Array(cp.length);
for (let i = 0; i < cp.length; i += 3) {
  const x = (cp[i] - (min[0] + max[0]) / 2) * s;
  const y = (cp[i + 1] - min[1]) * s;
  const z = (cp[i + 2] - (min[2] + max[2]) / 2) * s;
  out.set(swapXZ ? [z, y, -x] : [x, y, z], i);
}
// smooth normals
const nrm = new Float32Array(out.length);
for (let t = 0; t < ci.length; t += 3) {
  const [a, b, c] = [ci[t], ci[t + 1], ci[t + 2]];
  const ux = out[b * 3] - out[a * 3], uy = out[b * 3 + 1] - out[a * 3 + 1], uz = out[b * 3 + 2] - out[a * 3 + 2];
  const vx = out[c * 3] - out[a * 3], vy = out[c * 3 + 1] - out[a * 3 + 1], vz = out[c * 3 + 2] - out[a * 3 + 2];
  const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
  for (const v of [a, b, c]) for (let k = 0; k < 3; k++) nrm[v * 3 + k] += n[k];
}
for (let i = 0; i < nrm.length; i += 3) {
  const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) || 1;
  nrm[i] /= l, nrm[i + 1] /= l, nrm[i + 2] /= l;
}

// write the GLB
const vcount = out.length / 3;
const bmin = [Infinity, Infinity, Infinity];
const bmax = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < out.length; i += 3) for (let k = 0; k < 3; k++) (bmin[k] = Math.min(bmin[k], out[i + k])), (bmax[k] = Math.max(bmax[k], out[i + k]));
const pb = Buffer.from(out.buffer);
const nb = Buffer.from(nrm.buffer);
const ib = Buffer.from(ci.buffer);
const body = Buffer.concat([pb, nb, ib]);
const gl = {
  asset: { version: '2.0', generator: 'dead-block simplify-glb', extras: j.asset?.extras },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'model' }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
  materials: [{ name: 'model', pbrMetallicRoughness: { baseColorFactor: [0.45, 0.45, 0.43, 1], metallicFactor: 0.6, roughnessFactor: 0.6 } }],
  buffers: [{ byteLength: body.length }],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: pb.length, target: 34962 },
    { buffer: 0, byteOffset: pb.length, byteLength: nb.length, target: 34962 },
    { buffer: 0, byteOffset: pb.length + nb.length, byteLength: ib.length, target: 34963 },
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: vcount, type: 'VEC3', min: bmin, max: bmax },
    { bufferView: 1, componentType: 5126, count: vcount, type: 'VEC3' },
    { bufferView: 2, componentType: 5125, count: ci.length, type: 'SCALAR' },
  ],
};
let js = Buffer.from(JSON.stringify(gl));
js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const bpad = Buffer.concat([body, Buffer.alloc((4 - (body.length % 4)) % 4)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + js.length + 8 + bpad.length, 8);
const ch = (len, type) => {
  const b = Buffer.alloc(8);
  b.writeUInt32LE(len, 0);
  b.writeUInt32LE(type, 4);
  return b;
};
fs.writeFileSync(dst, Buffer.concat([header, ch(js.length, 0x4e4f534a), js, ch(bpad.length, 0x004e4942), bpad]));
console.log(`${idx.length / 3} → ${ci.length / 3} triangles, ${vcount} vertices; size ${bmax.map((v, k) => (v - bmin[k]).toFixed(2)).join(' × ')} m (x × y × z); ${(fs.statSync(dst).size / 1024).toFixed(0)} KB`);
