/**
 * Rifle fitter (dev page `dev-rifle.html`): line the rifle model up in the soldier's hand by eye.
 *
 * Shows the soldier at full detail playing any of its animations, with the rifle placed exactly the way
 * the game places it (hand position + orientation, then the fit below). Sliders change the fit live;
 * "Download m4.json" saves it. Put that file in `public/models/weapons/` (replacing the old one) and the
 * game uses it on the next load.
 */
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CHARACTER_SPECS, DEFAULT_FIT, loadRifleFit, loadRifleModel, rifleFitMatrix, type RifleFit } from '../render/characters';

// round 10: pick the unit (any Mixamo-rigged character that holds a gun) and the gun, from the panel:
// dev-rifle.html?unit=engineer&gun=models/weapons/scar.glb (default: the unit's own gun)
const UNITS: Record<string, string> = { soldier: 'Rifleman', engineer: 'Engineer' };
const GUNS: Record<string, string> = {
  'models/weapons/m4_kolos.glb': 'M4 (rifleman’s own)',
  'models/weapons/scar.glb': 'SCAR (engineer’s own)',
  'models/weapons/barrett.glb': 'Barrett (sniper, later)',
  'models/weapons/m4.glb': 'M4 (old, szaw)',
};
const query = new URLSearchParams(location.search);
const UNIT = query.get('unit') ?? 'soldier';
const SPEC = CHARACTER_SPECS.find((s) => s.key === UNIT)!;
const MODEL = SPEC.url;
const RIFLE = query.get('gun') ?? SPEC.rifleModel!;
const HAND = SPEC.rifleBone!;
const CLIPS: Record<string, string> = SPEC.clipFiles as Record<string, string>;
const FIT_FILE = RIFLE.split('/').pop()!.replace(/\.glb$/, '.json');

// ---------------------------------------------------------------- scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3a3e44);
scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(3, 6, 4);
scene.add(sun);
const grid = new THREE.GridHelper(4, 16, 0x667766, 0x4a4e54);
scene.add(grid);
const cam = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 50);
cam.position.set(1.6, 1.6, 2.2);
const controls = new OrbitControls(cam, renderer.domElement);
controls.target.set(0, 1.1, 0);
controls.update();
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
});

// ---------------------------------------------------------------- soldier, normalised like the game does
const fbx = new FBXLoader();
const soldier = await fbx.loadAsync(MODEL);
const tex = SPEC.texture ? await new THREE.TextureLoader().loadAsync(SPEC.texture) : null;
if (tex) tex.colorSpace = THREE.SRGBColorSpace;
soldier.traverse((o) => {
  const m = o as THREE.SkinnedMesh;
  if (!m.isSkinnedMesh) return;
  m.geometry.computeVertexNormals(); // the round 10 models came through OBJ without normals
  // textured model: the texture; otherwise keep each material's own colour
  const mats = Array.isArray(m.material) ? m.material : [m.material];
  const lam = mats.map((x) => new THREE.MeshLambertMaterial(tex ? { map: tex } : { color: (x as THREE.MeshPhongMaterial).color }));
  m.material = Array.isArray(m.material) ? lam : lam[0];
});
soldier.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(soldier, true);
const s = 1.8 / (box.max.y - box.min.y);
// same as the game's normalisation: feet on y=0, 1.8 m tall, facing +X
const holder = new THREE.Group();
holder.matrixAutoUpdate = false;
holder.matrix
  .makeRotationY(Math.PI / 2)
  .multiply(new THREE.Matrix4().makeScale(s, s, s))
  .multiply(new THREE.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2));
holder.add(soldier);
scene.add(holder);
const hand = soldier.getObjectByName(HAND)!;
let hips: THREE.Object3D | undefined;
soldier.traverse((o) => {
  if (!hips && (o as THREE.Bone).isBone && /hips$/i.test(o.name)) hips = o;
});
const hipsRest = hips!.position.clone();

const clips: Record<string, { clip: THREE.AnimationClip; hipsY: number }> = {};
for (const [k, url] of Object.entries(CLIPS)) {
  const a = await fbx.loadAsync(url);
  let hy = 0;
  a.traverse((o) => {
    if (!hy && (o as THREE.Bone).isBone && /hips$/i.test(o.name)) hy = o.position.y;
  });
  clips[k] = { clip: a.animations[0], hipsY: hy };
}
const mixer = new THREE.AnimationMixer(soldier);

// ---------------------------------------------------------------- rifle
const rifleGeo = await loadRifleModel(RIFLE);
const rifle = new THREE.Mesh(rifleGeo.clone(), new THREE.MeshLambertMaterial({ vertexColors: true }));
rifle.geometry.computeVertexNormals();
rifle.matrixAutoUpdate = false;
scene.add(rifle);
// a small marker where the grip should be (the rifle's origin)
const gripDot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffcc33, depthTest: false }));
gripDot.renderOrder = 5;
gripDot.matrixAutoUpdate = false;
scene.add(gripDot);

let fit: RifleFit = await loadRifleFit(RIFLE);

// ---------------------------------------------------------------- UI
const ui = document.createElement('div');
ui.innerHTML = `
<style>
  #fit { position: fixed; top: 10px; left: 10px; width: 330px; padding: 10px 12px; background: #1c1e22ee; color: #e8e6dc; font: 12px system-ui, sans-serif; border: 1px solid #555; }
  #fit h2 { font-size: 14px; margin: 0 0 6px; } #fit p { margin: 4px 0 8px; color: #b8b8ac; line-height: 1.35; }
  #fit label { display: grid; grid-template-columns: 92px 1fr 54px; gap: 6px; align-items: center; margin: 3px 0; }
  #fit input[type=number] { width: 54px; } #fit .row { display: flex; gap: 6px; margin: 6px 0; flex-wrap: wrap; }
  #fit button, #fit select { font: 12px system-ui; padding: 3px 8px; } #fit textarea { width: 100%; height: 80px; font: 11px monospace; }
  #fit .sep { border-top: 1px solid #444; margin: 8px 0; }
</style>
<div id="fit">
  <h2>Rifle fitter</h2>
  <p>Line the pistol grip up with the right hand (the yellow dot is the grip point). Check several animations. Drag to orbit the view, scroll to zoom.</p>
  <div class="row">Unit <select id="unit">${Object.entries(UNITS).map(([k, n]) => `<option value="${k}" ${k === UNIT ? 'selected' : ''}>${n}</option>`).join('')}</select>
    Gun <select id="gun">${Object.entries(GUNS).map(([k, n]) => `<option value="${k}" ${k === RIFLE ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
  <div class="row">Animation <select id="clip"></select> <button id="play">Pause</button></div>
  <label>Time <input id="time" type="range" min="0" max="1" step="0.001" value="0"><span id="tval"></span></label>
  <div class="sep"></div>
  <div id="sliders"></div>
  <div class="row"><button id="reset">Reset to saved</button><button id="zero">Zero all</button></div>
  <div class="sep"></div>
  <div class="row"><button id="dl"><b>Download ${FIT_FILE}</b></button><button id="copy">Copy</button></div>
  <p>The fit belongs to the gun (one <b>${FIT_FILE}</b>, whoever holds it); which gun each unit carries in the game is set in <code>characters.ts</code>${RIFLE === SPEC.rifleModel ? '' : ` (the ${UNITS[UNIT]} carries a different one)`}. Put <b>${FIT_FILE}</b> in <code>public/models/weapons/</code> (replace the old one), or upload it there on GitHub. The game picks it up on the next load.</p>
  <textarea id="json" readonly></textarea>
</div>`;
document.body.appendChild(ui);
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const clipSel = $<HTMLSelectElement>('clip');
for (const k of Object.keys(clips)) clipSel.add(new Option(k, k));
clipSel.value = 'shoot';

const SLIDERS: { key: string; label: string; min: number; max: number; step: number; get: () => number; set: (v: number) => void }[] = [
  { key: 'ox', label: 'Slide sideways (m)', min: -0.3, max: 0.3, step: 0.002, get: () => fit.offset[0], set: (v) => (fit.offset[0] = v) },
  { key: 'oy', label: 'Slide fwd/back (m)', min: -0.4, max: 0.4, step: 0.002, get: () => fit.offset[1], set: (v) => (fit.offset[1] = v) },
  { key: 'oz', label: 'Slide up/down (m)', min: -0.3, max: 0.3, step: 0.002, get: () => fit.offset[2], set: (v) => (fit.offset[2] = v) },
  { key: 'rx', label: 'Tilt (°)', min: -180, max: 180, step: 1, get: () => fit.rotationDeg[0], set: (v) => (fit.rotationDeg[0] = v) },
  { key: 'ry', label: 'Roll (°)', min: -180, max: 180, step: 1, get: () => fit.rotationDeg[1], set: (v) => (fit.rotationDeg[1] = v) },
  { key: 'rz', label: 'Turn (°)', min: -180, max: 180, step: 1, get: () => fit.rotationDeg[2], set: (v) => (fit.rotationDeg[2] = v) },
  { key: 'sc', label: 'Size', min: 0.5, max: 1.6, step: 0.01, get: () => fit.scale, set: (v) => (fit.scale = v) },
];
const sliderBox = $('sliders');
for (const sl of SLIDERS) {
  const row = document.createElement('label');
  row.innerHTML = `${sl.label}<input type="range" min="${sl.min}" max="${sl.max}" step="${sl.step}"><input type="number" step="${sl.step}">`;
  const [range, num] = row.querySelectorAll('input');
  const apply = (v: number) => {
    sl.set(v);
    range.value = String(v);
    num.value = String(+v.toFixed(3));
    showJson();
  };
  range.addEventListener('input', () => apply(Number(range.value)));
  num.addEventListener('change', () => apply(Number(num.value)));
  (sl as unknown as { refresh: () => void }).refresh = () => {
    range.value = String(sl.get());
    num.value = String(+sl.get().toFixed(3));
  };
  sliderBox.appendChild(row);
}
const refreshAll = () => {
  for (const sl of SLIDERS) (sl as unknown as { refresh: () => void }).refresh();
  showJson();
};
const round = (v: number) => +v.toFixed(3);
const fitJson = () => JSON.stringify({ offset: fit.offset.map(round), rotationDeg: fit.rotationDeg.map(round), scale: round(fit.scale) }, null, 2);
function showJson(): void {
  $<HTMLTextAreaElement>('json').value = fitJson();
}
$('reset').onclick = async () => {
  fit = await loadRifleFit(RIFLE);
  refreshAll();
};
$('zero').onclick = () => {
  fit = structuredClone(DEFAULT_FIT);
  refreshAll();
};
$('dl').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([fitJson() + '\n'], { type: 'application/json' }));
  a.download = FIT_FILE;
  a.click();
};
$('copy').onclick = () => void navigator.clipboard?.writeText(fitJson());
let playing = true;
$('play').onclick = () => {
  playing = !playing;
  $('play').textContent = playing ? 'Pause' : 'Play';
};
const timeSlider = $<HTMLInputElement>('time');
timeSlider.addEventListener('input', () => {
  playing = false;
  $('play').textContent = 'Play';
});
refreshAll();

// ---------------------------------------------------------------- loop
let current = '';
let t = 0;
const clock = new THREE.Clock();
const hp = new THREE.Vector3();
const hq = new THREE.Quaternion();
const place = new THREE.Matrix4();
renderer.setAnimationLoop(() => {
  const k = clipSel.value;
  const c = clips[k];
  if (k !== current) {
    mixer.stopAllAction();
    mixer.clipAction(c.clip).play();
    current = k;
    t = 0;
  }
  const dur = c.clip.duration || 1;
  if (playing) {
    t = (t + clock.getDelta()) % dur;
    timeSlider.value = String(t / dur);
  } else {
    clock.getDelta();
    t = Number(timeSlider.value) * dur;
  }
  $('tval').textContent = `${t.toFixed(2)} s`;
  mixer.setTime(t);
  // in place, like the game (hips pinned; the clip's hip height rescaled to this skeleton)
  hips!.position.x = hipsRest.x;
  hips!.position.z = hipsRest.z;
  if (c.hipsY) hips!.position.y = hipsRest.y * (hips!.position.y / c.hipsY);
  holder.updateMatrixWorld(true);
  // the game places the rifle by the hand's world position + orientation, then applies the fit
  hand.matrixWorld.decompose(hp, hq, new THREE.Vector3());
  place.compose(hp, hq, new THREE.Vector3(1, 1, 1));
  rifle.matrix.copy(place).multiply(rifleFitMatrix(fit));
  gripDot.matrix.copy(rifle.matrix);
  rifle.visible = k !== 'work';
  controls.update();
  renderer.render(scene, cam);
});
document.title = 'Rifle fitter';

// unit / gun pickers reload the page with the new choice (each unit's model and clips load fresh)
for (const id of ['unit', 'gun'] as const)
  document.getElementById(id)!.addEventListener('change', (e) => {
    const q = new URLSearchParams(location.search);
    q.set(id, (e.target as HTMLSelectElement).value);
    if (id === 'unit') q.delete('gun'); // a new unit starts with its own gun
    location.search = q.toString();
  });
