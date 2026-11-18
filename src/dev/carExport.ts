// Dev-only page (dev-carexport.html, v4.56): turn the owner's car pack (Comrade1280, CC BY 4.0) into one
// small GLB per car for the parked cars: each body with its glass, lights and the four wheels under it,
// textures baked into vertex colours, merged, simplified to ~1,500 triangles, long side along X at
// 4.6 m, wheels on the ground. Driven by tools/assets/export-cars.cjs.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer';
import { texSampler } from '../render/characters';

const LENGTH = 4.6;
const TARGET_TRIS = 1500;

async function exportCars(url: string): Promise<{ name: string; b64: string; tris: number; size: number[] }[]> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  const boxOf = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);
  const bodies: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (/body/i.test(o.name) && o.children.length && !(o as THREE.Mesh).isMesh && o.children.some((c) => (c as THREE.Mesh).isMesh)) bodies.push(o);
  });
  await MeshoptSimplifier.ready;
  const out: { name: string; b64: string; tris: number; size: number[] }[] = [];
  // each wheel goes to the one body nearest to it (a grown box catches neighbours' wheels in the pack)
  const bodyBoxes = bodies.map((b) => boxOf(b));
  const owner = new Map<THREE.Mesh, THREE.Object3D>();
  for (const m of meshes) {
    if (!/wheel/i.test(m.name)) continue;
    const ctr = boxOf(m).getCenter(new THREE.Vector3());
    let best = -1;
    let bestD = Infinity;
    bodyBoxes.forEach((bx, i) => {
      const d = bx.distanceToPoint(ctr);
      if (d < bestD) (best = i), (bestD = d);
    });
    if (best >= 0 && bestD < 0.15 * bodyBoxes[best].getSize(new THREE.Vector3()).length()) owner.set(m, bodies[best]);
  }
  const used = new Set<THREE.Mesh>();
  for (const body of bodies) {
    const parts = meshes.filter((m) => {
      if (used.has(m)) return false;
      if (owner.get(m) === body) return true;
      let p: THREE.Object3D | null = m;
      while (p) {
        if (p === body) return true;
        p = p.parent;
      }
      return false;
    });
    parts.forEach((m) => used.add(m));
    // world-space positions + baked colours, one non-indexed soup
    const pos: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color();
    const v = new THREE.Vector3();
    for (const m of parts) {
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
      const sample = mat.map ? texSampler(mat.map) : null;
      const uv = g.attributes.uv;
      const p = g.attributes.position;
      const glass = /glass/i.test(m.name) || (mat.transparent && mat.opacity < 0.9);
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
        pos.push(v.x, v.y, v.z);
        if (glass) c.setRGB(0.12, 0.16, 0.2, THREE.SRGBColorSpace);
        else if (sample && uv) sample(uv.getX(i), uv.getY(i), c);
        else c.set(0xffffff);
        if (!glass && mat.color) c.multiply(mat.color);
        col.push(c.r, c.g, c.b);
      }
    }
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    // long side along X, centred, wheels on the ground, 4.6 m long. Some cars sit at an angle in the pack:
    // turn by the body's main axis on the ground (its x/z spread), not just the longer side of its box
    {
      const pa = g.attributes.position.array as Float32Array;
      let mx = 0, mz = 0;
      const nv = pa.length / 3;
      for (let i = 0; i < nv; i++) (mx += pa[i * 3]), (mz += pa[i * 3 + 2]);
      mx /= nv;
      mz /= nv;
      let cxx = 0, czz = 0, cxz = 0;
      for (let i = 0; i < nv; i++) {
        const dx = pa[i * 3] - mx, dz = pa[i * 3 + 2] - mz;
        cxx += dx * dx;
        czz += dz * dz;
        cxz += dx * dz;
      }
      const theta = 0.5 * Math.atan2(2 * cxz, cxx - czz); // main axis angle on the ground (from +X towards +Z)
      g.rotateY(theta); // three's rotateY turns +X towards -Z, so this lays the main axis along X
    }
    g.computeBoundingBox();
    let bb = g.boundingBox!;
    g.computeBoundingBox();
    bb = g.boundingBox!;
    const ctr = bb.getCenter(new THREE.Vector3());
    g.translate(-ctr.x, -bb.min.y, -ctr.z);
    const s = LENGTH / bb.getSize(new THREE.Vector3()).x;
    g.scale(s, s, s);
    // weld by position (colours: the first face's), then simplify
    g.deleteAttribute('normal');
    const welded = mergeVertices(g, 1e-4);
    const idx = new Uint32Array(welded.index!.array);
    const P = welded.attributes.position.array as Float32Array;
    const [simple] = MeshoptSimplifier.simplify(idx, P, 3, Math.min(idx.length, TARGET_TRIS * 3), 0.02);
    welded.setIndex(new THREE.BufferAttribute(simple, 1));
    g = welded;
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.name = body.name.replace(/[ _]?body/i, '').replace(/[^a-z0-9]+/gi, '').toLowerCase() || 'car';
    const glb = (await new GLTFExporter().parseAsync(mesh, { binary: true })) as ArrayBuffer;
    const bytes = new Uint8Array(glb);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    g.computeBoundingBox();
    out.push({ name: mesh.name, b64: btoa(bin), tris: simple.length / 3, size: g.boundingBox!.getSize(new THREE.Vector3()).toArray().map((x) => +x.toFixed(2)) });
  }
  return out;
}

(window as unknown as Record<string, unknown>).exportCars = exportCars;
document.title = 'ready';
