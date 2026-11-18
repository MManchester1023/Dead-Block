// Dev-only page (dev-objexport.html): one character of a GLB, in its bind (T) pose, as OBJ + MTL + textures,
// for Mixamo's auto-rigger (which doesn't take .glb). Feet on y = 0, 1.8 units tall, facing +Z.
//   ?model=models/x.glb&meshes=Object_1,Object_2   (or &skip=Object_3)   → window.__out = { obj, mtl, images }
// v4.62: an .fbx works too, and `tex=` gives every part a base-colour texture when the file doesn't link one.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const params = new URLSearchParams(location.search);
const keep = params.get('meshes')?.split(',');
const skip = params.get('skip')?.split(',') ?? [];
const modelUrl = params.get('model')!;
const root = /\.fbx$/i.test(modelUrl) ? await new FBXLoader().loadAsync(modelUrl) : (await new GLTFLoader().loadAsync(modelUrl)).scene;
const extTex = params.get('tex') ? await new THREE.TextureLoader().loadAsync(params.get('tex')!) : null;
root.updateMatrixWorld(true);
const parts: THREE.Mesh[] = [];
root.traverse((o) => {
  const m = o as THREE.Mesh;
  if (!m.isMesh || skip.includes(m.name) || (keep && !keep.includes(m.name))) return;
  parts.push(m);
});
for (const m of parts) if ((m as THREE.SkinnedMesh).isSkinnedMesh) (m as THREE.SkinnedMesh).skeleton.pose();
root.updateMatrixWorld(true);

// world positions in the bind pose
const world = parts.map((m) => {
  const P = m.geometry.attributes.position as THREE.BufferAttribute;
  const out: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    if ((m as THREE.SkinnedMesh).isSkinnedMesh) (m as THREE.SkinnedMesh).applyBoneTransform(i, v);
    out.push(v.clone().applyMatrix4(m.matrixWorld));
  }
  return out;
});
// v4.56: some models (e.g. Sketchfab "Z up" exports) come out lying down. A T-posed figure is about as
// tall as its arm span and far shallower than both: if it's much bigger along z than y, stand it up
// (z → y); then, as a T-pose's widest part (the arms) is near the top, flip it if that ends up low
{
  const b0 = new THREE.Box3();
  world.flat().forEach((p) => b0.expandByPoint(p));
  const sz = b0.getSize(new THREE.Vector3());
  if (sz.z > sz.y * 2) {
    for (const pts of world) for (const p of pts) p.set(p.x, p.z, -p.y);
    const b1 = new THREE.Box3();
    world.flat().forEach((p) => b1.expandByPoint(p));
    const mid = (b1.min.y + b1.max.y) / 2;
    let wideTop = 0;
    let wideLow = 0;
    const cx0 = (b1.min.x + b1.max.x) / 2;
    for (const p of world.flat()) {
      const w = Math.abs(p.x - cx0);
      if (p.y > mid) wideTop = Math.max(wideTop, w);
      else wideLow = Math.max(wideLow, w);
    }
    if (wideLow > wideTop) for (const pts of world) for (const p of pts) p.set(p.x, -p.y, -p.z); // upside down: turn it over
  }
}
const box = new THREE.Box3();
world.flat().forEach((p) => box.expandByPoint(p));
const s = 1.8 / (box.max.y - box.min.y);
const cx = (box.min.x + box.max.x) / 2;
const cz = (box.min.z + box.max.z) / 2;

let obj = 'mtllib character.mtl\no character\n';
let mtl = '';
const images: Record<string, string> = {};
const matNames = new Map<THREE.Material, string>();
let vBase = 1;
parts.forEach((m, pi) => {
  const g = m.geometry;
  const uv = g.attributes.uv as THREE.BufferAttribute | undefined;
  for (const p of world[pi]) obj += `v ${((p.x - cx) * s).toFixed(5)} ${((p.y - box.min.y) * s).toFixed(5)} ${((p.z - cz) * s).toFixed(5)}\n`;
  const n = world[pi].length;
  for (let i = 0; i < n; i++) obj += uv ? `vt ${uv.getX(i).toFixed(5)} ${(1 - uv.getY(i)).toFixed(5)}\n` : 'vt 0 0\n';
  const mats = Array.isArray(m.material) ? m.material : [m.material];
  const groups = g.groups.length ? g.groups : [{ start: 0, count: g.index ? g.index.count : n, materialIndex: 0 }];
  for (const gr of groups) {
    const mat = mats[gr.materialIndex ?? 0] as THREE.MeshStandardMaterial;
    let name = matNames.get(mat);
    if (!name) {
      name = `mat${matNames.size}`;
      matNames.set(mat, name);
      const c = extTex ? new THREE.Color(1, 1, 1) : mat.color;
      mtl += `newmtl ${name}\nKa 1 1 1\nKd ${c.r.toFixed(4)} ${c.g.toFixed(4)} ${c.b.toFixed(4)}\nKs 0 0 0\nd 1\nillum 1\n`;
      const map = extTex ?? mat.map;
      if (map?.image) {
        const img = map.image as ImageBitmap | HTMLImageElement;
        const cv = document.createElement('canvas');
        cv.width = img.width;
        cv.height = img.height;
        cv.getContext('2d')!.drawImage(img, 0, 0);
        const file = `${name}.png`;
        images[file] = cv.toDataURL('image/png');
        mtl += `map_Kd ${file}\n`;
      }
    }
    obj += `usemtl ${name}\n`;
    for (let i = gr.start; i < gr.start + gr.count; i += 3) {
      const a = (g.index ? g.index.getX(i) : i) + vBase;
      const b = (g.index ? g.index.getX(i + 1) : i + 1) + vBase;
      const c = (g.index ? g.index.getX(i + 2) : i + 2) + vBase;
      obj += `f ${a}/${a} ${b}/${b} ${c}/${c}\n`;
    }
  }
  vBase += n;
});
(window as unknown as { __out: unknown }).__out = { obj, mtl, images, verts: vBase - 1, parts: parts.map((p) => p.name) };
// preview
const r = new THREE.WebGLRenderer();
r.setSize(600, 600);
document.body.appendChild(r.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x445566);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.5));
scene.add(root);
const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 1e6);
const c = box.getCenter(new THREE.Vector3());
cam.position.set(c.x, c.y, c.z + (box.max.y - box.min.y) * 2.2);
cam.lookAt(c);
r.render(scene, cam);
document.title = 'ready';
