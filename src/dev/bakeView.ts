// Dev-only page (dev-bake.html): bake one character exactly as the game does and show poses of a clip.
//   ?key=soldier&clip=walk&n=6   (n poses spread over the clip, side by side, seen from the front-left)
import * as THREE from 'three';
import { CHARACTER_SPECS, TRIAL_SPECS, bakeCharacter, type Clip } from '../render/characters';

const params = new URLSearchParams(location.search);
const key = params.get('key') ?? 'soldier';
const clip = (params.get('clip') ?? 'walk') as Clip;
const n = Number(params.get('n') ?? '6');
const yaw = Number(params.get('yaw') ?? '0.6');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(1200, 500);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x445566);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(3, 6, 4);
scene.add(sun);
scene.add(new THREE.GridHelper(20, 20, 0x667766, 0x556070));
const spec = [...CHARACTER_SPECS, ...TRIAL_SPECS].find((s) => s.key === key)!;
const book = await bakeCharacter({ ...spec, clips: [clip], simplify: params.has('lod') ? spec.simplify : undefined });
const frames = book.frames[clip] ?? [];
const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
for (let i = 0; i < n && frames.length; i++) {
  const f = frames[Math.floor((i / n) * frames.length)];
  const m = new THREE.Mesh(f, mat);
  m.rotation.y = -Math.PI / 2 + yaw; // baked facing +X; turn towards the camera
  m.position.x = (i - (n - 1) / 2) * 1.9;
  scene.add(m);
}
const cam = new THREE.PerspectiveCamera(30, 1200 / 500, 0.1, 100);
cam.position.set(0, 1.6, 12);
cam.lookAt(0, 0.9, 0);
renderer.render(scene, cam);
(window as unknown as { __info: unknown }).__info = { frames: frames.length, tris: frames[0] ? (frames[0].index ? frames[0].index.count / 3 : frames[0].attributes.position.count / 3) : 0 };
document.title = 'ready';
