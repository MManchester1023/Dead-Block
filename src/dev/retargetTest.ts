// Dev-only page (dev-retarget.html): check Mixamo → Character Creator retargeting visually.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { MIXAMO_TO_CC, makeRetargeter } from '../render/retarget';

const params = new URLSearchParams(location.search);
const clipFile = params.get('clip') ?? 'walking.fbx';
const t = Number(params.get('t') ?? '0.3');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(1000, 600);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x445566);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.5));
const cam = new THREE.PerspectiveCamera(35, 1000 / 600, 0.1, 100);
cam.position.set(0.8, 1.3, 5.2);
cam.lookAt(0.8, 0.9, 0);

const fbx = new FBXLoader();
const src = await fbx.loadAsync('/assets-src/models/mixamo/shooter-pack/X Bot.fbx');
const anim = await fbx.loadAsync(`/assets-src/models/mixamo/shooter-pack/${clipFile}`);
src.scale.setScalar(0.01); // Mixamo FBX is in cm
scene.add(src);

const gl = await new GLTFLoader().loadAsync('/assets-src/models/soldier_full_tactical_gear.glb');
const tgt = gl.scene;
scene.add(tgt);
// rest poses
tgt.traverse((o) => (o as THREE.SkinnedMesh).isSkinnedMesh && (o as THREE.SkinnedMesh).skeleton.pose());
tgt.updateMatrixWorld(true);
// size + place the soldier next to the bot
const box = new THREE.Box3().setFromObject(tgt);
const info: Record<string, unknown> = { tgtBox: [box.min.toArray().map((v) => +v.toFixed(2)), box.max.toArray().map((v) => +v.toFixed(2))] };
const h = box.max.y - box.min.y;
tgt.scale.multiplyScalar(1.8 / h);
tgt.updateMatrixWorld(true);
const box2 = new THREE.Box3().setFromObject(tgt);
tgt.position.set(1.6 - (box2.min.x + box2.max.x) / 2, -box2.min.y, -(box2.min.z + box2.max.z) / 2);
tgt.updateMatrixWorld(true);
src.updateMatrixWorld(true);
// facing check: hips → left thigh (should point the same way on both)
const wp = (o?: THREE.Object3D) => (o ? o.getWorldPosition(new THREE.Vector3()) : null);
const sL = wp(src.getObjectByName('mixamorigLeftUpLeg'))!.sub(wp(src.getObjectByName('mixamorigHips'))!);
const tL = wp(tgt.getObjectByName('CC_Base_L_Thigh'))!.sub(wp(tgt.getObjectByName('CC_Base_Hip'))!);
info.srcLeft = sL.normalize().toArray().map((v) => +v.toFixed(2));
info.tgtLeft = tL.normalize().toArray().map((v) => +v.toFixed(2));

const rt = makeRetargeter(src, tgt, MIXAMO_TO_CC);
const mixer = new THREE.AnimationMixer(src);
const clip = anim.animations[0];
info.clip = [clip.name, clip.duration.toFixed(2), clip.tracks.length];
mixer.clipAction(clip).play();
mixer.setTime(t * clip.duration);
rt.apply();
renderer.render(scene, cam);
(window as unknown as { __info: unknown }).__info = info;
document.title = 'ready';
