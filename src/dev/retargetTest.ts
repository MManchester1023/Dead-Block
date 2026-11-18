// Dev-only page (dev-retarget.html): check Mixamo → other-rig retargeting, side by side, with numbers.
//   ?model=models/characters/rifleman/low_poly_soldier.glb&map=kolos&clip=walk&t=0.3&bind=1
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { MIXAMO_TO_KOLOS, MIXAMO_TO_RIGIFY, RIGIFY_PARENTS, bonesByBase, makeRetargeter, rebuildHierarchy } from '../render/retarget';

const params = new URLSearchParams(location.search);
const clipFile = `models/characters/soldier/${params.get('clip') ?? 'walk'}.fbx`;
const t = Number(params.get('t') ?? '0.3');
const map = params.get('map') === 'rigify' ? MIXAMO_TO_RIGIFY : MIXAMO_TO_KOLOS;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(1000, 600);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x445566);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.5));
const cam = new THREE.PerspectiveCamera(35, 1000 / 600, 0.1, 100);
cam.position.set(0.8, 1.3, 5.2);
cam.lookAt(0.8, 0.9, 0);

const src = await new FBXLoader().loadAsync(clipFile);
src.scale.setScalar(0.01);
scene.add(src);
src.add(new THREE.SkeletonHelper(src));

const gl = await new GLTFLoader().loadAsync(params.get('model')!);
const tgt = gl.scene;
scene.add(tgt);
const root = params.get('root') ? tgt.getObjectByName(params.get('root')!)! : tgt;
if (params.get('map') === 'rigify') rebuildHierarchy(root, RIGIFY_PARENTS);
if (params.get('bind')) tgt.traverse((o) => (o as THREE.SkinnedMesh).isSkinnedMesh && (o as THREE.SkinnedMesh).skeleton.pose());
tgt.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(tgt, true);
tgt.scale.multiplyScalar(1.8 / (box.max.y - box.min.y));
tgt.updateMatrixWorld(true);
const box2 = new THREE.Box3().setFromObject(tgt, true);
tgt.position.set(1.6 - (box2.min.x + box2.max.x) / 2, -box2.min.y, -(box2.min.z + box2.max.z) / 2);
tgt.updateMatrixWorld(true);
src.updateMatrixWorld(true);
const S = bonesByBase(src);
const T = bonesByBase(root);
const wp = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
const dirs = (label: string) => {
  const out: Record<string, unknown> = {};
  for (const [a, b] of [['mixamorigRightArm', 'mixamorigRightForeArm'], ['mixamorigRightForeArm', 'mixamorigRightHand'], ['mixamorigLeftUpLeg', 'mixamorigLeftLeg'], ['mixamorigSpine', 'mixamorigNeck']]) {
    const sd = wp(S.get(b)!).sub(wp(S.get(a)!)).normalize();
    const td = wp(T.get(map[b])!).sub(wp(T.get(map[a])!)).normalize();
    out[a] = { src: sd.toArray().map((v) => +v.toFixed(2)), tgt: td.toArray().map((v) => +v.toFixed(2)) };
  }
  return { [label]: out };
};
const info: Record<string, unknown> = { ...dirs('rest') };
const rt = makeRetargeter(src, root, map);
const mixer = new THREE.AnimationMixer(src);
const clip = src.animations[0];
mixer.clipAction(clip).play();
mixer.setTime(t * clip.duration);
rt.apply();
Object.assign(info, dirs('posed'));
tgt.add(new THREE.SkeletonHelper(root));
renderer.render(scene, cam);
(window as unknown as { __info: unknown }).__info = info;
document.title = 'ready';
