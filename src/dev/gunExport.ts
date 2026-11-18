// Dev-only page (dev-gunexport.html): cut a character's own gun out of its model file, as a weapon GLB
// in the game's rifle frame (barrel +X, magazine -Z, metres, colours baked into vertices).
//   ?model=…glb&meshes=Object_186&barrel=x&down=-y   (barrel/down: the gun's axes in the file's bind pose)
// Without barrel/down it just shows the extracted gun from the side and top, to work them out.
// v4.62: also a stand-alone gun model: an .fbx works too, `tex=` gives it a base-colour texture when the file
// doesn't link one, and `length=` scales it so the barrel axis is that many metres long.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { texSampler } from '../render/characters';

const params = new URLSearchParams(location.search);
const meshes = params.get('meshes')!.split(',');
const modelUrl = params.get('model')!;
const root = /\.fbx$/i.test(modelUrl) ? await new FBXLoader().loadAsync(modelUrl) : (await new GLTFLoader().loadAsync(modelUrl)).scene;
const extTex = params.get('tex') ? await new THREE.TextureLoader().loadAsync(params.get('tex')!) : null;
if (extTex) extTex.colorSpace = THREE.SRGBColorSpace;
root.updateMatrixWorld(true);
const parts: THREE.Mesh[] = [];
root.traverse((o) => {
  if ((o as THREE.Mesh).isMesh && meshes.includes(o.name)) parts.push(o as THREE.Mesh);
});
for (const m of parts) if ((m as THREE.SkinnedMesh).isSkinnedMesh) (m as THREE.SkinnedMesh).skeleton.pose();
root.updateMatrixWorld(true);

const axis = (s: string) => {
  const v = new THREE.Vector3();
  v[s.replace('-', '') as 'x' | 'y' | 'z'] = s.startsWith('-') ? -1 : 1;
  return v;
};
const barrel = params.get('barrel') ? axis(params.get('barrel')!) : null;
const down = params.get('down') ? axis(params.get('down')!) : null;
// file frame → rifle frame: barrel → +X, down → -Z
let toRifle = new THREE.Matrix4();
if (barrel && down) {
  const up = down.clone().negate();
  const side = up.clone().cross(barrel); // Y = Z × X
  toRifle = new THREE.Matrix4().makeBasis(barrel, side, up).invert();
}

const pos: number[] = [];
const col: number[] = [];
const c = new THREE.Color();
for (const m of parts) {
  const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
  const P = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute | undefined;
  const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
  const map = extTex ?? mat.map;
  const tex = map && uv ? texSampler(map) : null;
  const v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    // a non-indexed copy has no skin attributes of its own: skin the original vertex
    if ((m as THREE.SkinnedMesh).isSkinnedMesh && g === m.geometry) (m as THREE.SkinnedMesh).applyBoneTransform(i, v);
    else if ((m as THREE.SkinnedMesh).isSkinnedMesh) {
      const src = m.geometry.index!.getX(i);
      v.fromBufferAttribute(m.geometry.attributes.position as THREE.BufferAttribute, src);
      (m as THREE.SkinnedMesh).applyBoneTransform(src, v);
    }
    v.applyMatrix4(m.matrixWorld).applyMatrix4(toRifle);
    pos.push(v.x, v.y, v.z);
    c.copy(extTex ? new THREE.Color(1, 1, 1) : mat.color);
    if (tex) {
      tex(uv!.getX(i), uv!.getY(i), c);
      if (!extTex) c.multiply(mat.color);
    }
    col.push(c.r, c.g, c.b);
  }
}
if (params.get('length')) {
  // scale so the gun is `length` m along the barrel (X once in the rifle frame)
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < pos.length; i += 3) (lo = Math.min(lo, pos[i])), (hi = Math.max(hi, pos[i]));
  const k = Number(params.get('length')) / (hi - lo);
  for (let i = 0; i < pos.length; i++) pos[i] *= k;
}
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
geo.computeBoundingBox();
const bb = geo.boundingBox!;
const ctr = bb.getCenter(new THREE.Vector3());
geo.translate(-ctr.x, -ctr.y, -ctr.z);
geo.computeVertexNormals();
const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
const size = bb.getSize(new THREE.Vector3());

// preview: left = looking along -Z (X right, Y up), right = looking down from +Y... both in the output frame
const r = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
r.setSize(1000, 500);
r.setScissorTest(true);
document.body.appendChild(r.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x445566);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.5));
scene.add(mesh);
const L = Math.max(size.x, size.y, size.z);
const cam = new THREE.OrthographicCamera(-L * 0.6, L * 0.6, L * 0.6, -L * 0.6, -100 * L, 100 * L);
for (const [i, eye, upv] of [
  [0, new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1)], // side: X right, Z up
  [1, new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)], // top: X right, Y up
] as const) {
  cam.position.copy(eye);
  cam.up.copy(upv);
  cam.lookAt(0, 0, 0);
  r.setViewport(i * 500, 0, 500, 500);
  r.setScissor(i * 500, 0, 500, 500);
  r.render(scene, cam);
}
let glb: string | null = null;
if (barrel && down) {
  const buf = (await new GLTFExporter().parseAsync(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true })), { binary: true })) as ArrayBuffer;
  const u8 = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  glb = btoa(bin);
}
(window as unknown as { __out: unknown }).__out = { size: size.toArray().map((v) => +v.toFixed(3)), tris: pos.length / 9, glb };
document.title = 'ready';
