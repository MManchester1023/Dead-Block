// Dev-only page (dev-model.html): look at a model at rest, list its bones and meshes.
//   ?model=/assets-src/models/x.glb
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const params = new URLSearchParams(location.search);
const url = params.get('model')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(1000, 600);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x445566);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.5));
const gl = await new GLTFLoader().loadAsync(url);
const root = gl.scene;
scene.add(root);
if (params.get('anim')) {
  const mx = new THREE.AnimationMixer(root);
  mx.clipAction(gl.animations[0]).play();
  mx.setTime(Number(params.get('anim')));
} else if (params.get('rot')) {
  // bind pose, then turn one bone 40° about world Z: the mesh should follow cleanly
  root.traverse((o) => (o as THREE.SkinnedMesh).isSkinnedMesh && (o as THREE.SkinnedMesh).skeleton.pose());
  const b = root.getObjectByName(params.get('rot')!)!;
  b.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.7));
} else if (!params.get('raw')) root.traverse((o) => (o as THREE.SkinnedMesh).isSkinnedMesh && (o as THREE.SkinnedMesh).skeleton.pose());
root.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(root);
const c = box.getCenter(new THREE.Vector3());
const size = box.getSize(new THREE.Vector3());
const cam = new THREE.PerspectiveCamera(35, 1000 / 600, 0.01, 100000);
const d = Math.max(size.x, size.y) * 1.9;
cam.position.set(c.x, c.y, c.z + d);
cam.lookAt(c);
renderer.render(scene, cam);
const meshes: unknown[] = [];
root.traverse((o) => {
  const m = o as THREE.SkinnedMesh;
  if (!m.isMesh) return;
  const b = new THREE.Box3().setFromObject(m);
  meshes.push([m.name, m.isSkinnedMesh ? m.skeleton.bones.length : 0, b.min.toArray().map((v) => +v.toFixed(2)), b.max.toArray().map((v) => +v.toFixed(2))]);
});
const bones: string[] = [];
root.traverse((o) => (o as THREE.Bone).isBone && bones.push(o.name));
(window as unknown as { __info: unknown }).__info = { box: [box.min.toArray(), box.max.toArray()], meshes, bones };
document.title = 'ready';
