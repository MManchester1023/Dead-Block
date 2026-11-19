// Dev-only page (dev-propexport.html, v4.72): a building/prop model (e.g. the owner's Medical Tent) → one
// small GLB for a structure: every mesh merged, textures baked into vertex colours, simplified to about
// `tris` triangles, the long side turned along X when the footprint is wider than deep, scaled to fit the
// footprint (metres, keeping its proportions), standing on y = 0, centred. Driven by tools/assets/export-prop.cjs.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer';
import { texSampler } from '../render/characters';

interface Job {
  url: string;
  /** Footprint to fit, metres (x = width, z = depth). */
  w: number;
  d: number;
  tris: number;
  /** Only this node (and what's under it), e.g. one building out of a pack. */
  node?: string;
}

async function exportProp(job: Job): Promise<{ b64: string; tris: number; srcTris: number; size: number[] }> {
  await MeshoptSimplifier.ready;
  const root = (await new GLTFLoader().loadAsync(job.url)).scene;
  root.updateMatrixWorld(true);
  const pick = job.node ? root.getObjectByName(job.node) : root;
  if (!pick) throw new Error(`no node ${job.node}`);
  const pos: number[] = [];
  const col: number[] = [];
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  pick.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
    const sample = mat.map ? texSampler(mat.map) : null;
    const uv = g.attributes.uv;
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld);
      pos.push(v.x, v.y, v.z);
      if (sample && uv) sample(uv.getX(i), uv.getY(i), c);
      else c.set(0xffffff);
      if (mat.color) c.multiply(mat.color);
      col.push(c.r, c.g, c.b);
    }
  });
  const srcTris = pos.length / 9;
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingBox();
  let size = g.boundingBox!.getSize(new THREE.Vector3());
  // long side along the footprint's long side
  if ((size.x < size.z) !== (job.w < job.d)) g.rotateY(Math.PI / 2);
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  size = bb.getSize(new THREE.Vector3());
  const ctr = bb.getCenter(new THREE.Vector3());
  g.translate(-ctr.x, -bb.min.y, -ctr.z);
  const s = Math.min(job.w / size.x, job.d / size.z);
  g.scale(s, s, s);
  const welded = mergeVertices(g, 1e-4);
  const idx = new Uint32Array(welded.index!.array);
  const [simple] = MeshoptSimplifier.simplify(idx, welded.attributes.position.array as Float32Array, 3, Math.min(idx.length, job.tris * 3), 0.02);
  // keep only the vertices the simplified mesh still uses
  const remap = new Map<number, number>();
  const P = welded.attributes.position.array as Float32Array;
  const C = welded.attributes.color.array as Float32Array;
  const np: number[] = [];
  const nc: number[] = [];
  const ni = new Uint32Array(simple.length);
  simple.forEach((vi, k) => {
    let j = remap.get(vi);
    if (j === undefined) {
      j = remap.size;
      remap.set(vi, j);
      np.push(P[vi * 3], P[vi * 3 + 1], P[vi * 3 + 2]);
      nc.push(C[vi * 3], C[vi * 3 + 1], C[vi * 3 + 2]);
    }
    ni[k] = j;
  });
  g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(np, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(nc, 3));
  g.setIndex(new THREE.BufferAttribute(ni, 1));
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  g.computeBoundingBox();
  const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  const glb = (await new GLTFExporter().parseAsync(mesh, { binary: true })) as ArrayBuffer;
  const bytes = new Uint8Array(glb);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { b64: btoa(bin), tris: simple.length / 3, srcTris, size: g.boundingBox!.getSize(new THREE.Vector3()).toArray().map((x) => +x.toFixed(2)) };
}

(window as unknown as Record<string, unknown>).exportProp = exportProp;
document.title = 'ready';
