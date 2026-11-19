import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CELL } from '../config/world';
import type { Structure } from '../sim/entities';
import { PAL } from './palette';
import { models } from './ModelLibrary';

/**
 * Procedural meshes for things the simulation places at run time: structures, hives, and the box
 * figures used when the character models fail to load. Pure builders: no scene, no state.
 */

/** Soldier placeholder meshes are authored ~1.14 tall; scale to a 1.8 m person. */
export const SOLDIER_SCALE = 1.6;
export const MAX_ZOMBIES = 320;
export const ZOMBIE_TYPES = ['walker', 'runner', 'bloater'] as const;

/** A structure's model, centred on its footprint (metres), at ground level. */
/** STATUS #50: structures drawn with a loaded model (manifest key) instead of their procedural shapes. */
const STRUCTURE_MODELS: Record<string, string> = { medBay: 'medTent', vehicleBay: 'vehicleBay' };

export function buildStructureMesh(s: Structure): THREE.Group {
  const g = new THREE.Group();
  const w = s.size.w * CELL; // metres
  const h = s.size.h * CELL;
  const add = (geo: THREE.BufferGeometry, color: number, y: number, x = 0, z = 0) => {
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, transparent: true }));
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  // STATUS #50: the owner's models where there are some (Medical Tent by Aidan Callaghan; Salah3D's garage)
  const modelKey = STRUCTURE_MODELS[s.def.id];
  const model = modelKey ? models.instance(modelKey) : null;
  if (model) {
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = (m.material as THREE.Material).clone(); // its own, so this one can be tinted / faded
      (m.material as THREE.Material).transparent = true;
      m.castShadow = m.receiveShadow = true;
    });
    if (s.size.w !== s.def.size.w) model.rotation.y = Math.PI / 2; // placed turned 90°
    g.add(model);
    return g;
  }
  switch (s.def.id) {
    case 'baseWall':
      add(new THREE.BoxGeometry(w, 4, h), PAL.concrete, 2);
      break;
    case 'sandbags':
      for (let i = 0; i < Math.max(w, h); i++) {
        const along = i - (Math.max(w, h) - 1) / 2;
        const geo = new THREE.BoxGeometry(w > h ? 0.95 : 0.8, 0.42, w > h ? 0.8 : 0.95);
        add(geo, PAL.sandbag, 0.21, w > h ? along : 0, w > h ? 0 : along);
        add(geo.clone().scale(0.9, 1, 0.9), new THREE.Color(PAL.sandbag).offsetHSL(0, 0, -0.06).getHex(), 0.62, w > h ? along + 0.25 : 0, w > h ? 0 : along + 0.25);
      }
      break;
    case 'wire': {
      // v4.39: the owner's barbed wire model (CliffUnderside, CC-BY 4.0), one coil stretched along the
      // whole run; its geometry is shared, each wire gets its own material (opacity while it's built)
      const coil = models.instance('wire');
      let geo: THREE.BufferGeometry | undefined;
      coil?.traverse((o) => {
        if (!geo && (o as THREE.Mesh).isMesh) geo = (o as THREE.Mesh).geometry;
      });
      if (geo) {
        const m = add(geo, PAL.wire, 0);
        m.scale.setScalar(Math.max(w, h));
        m.rotation.y = w > h ? 0 : Math.PI / 2;
        break;
      }
      for (let i = 0; i < Math.max(w, h); i++) {
        const along = i - (Math.max(w, h) - 1) / 2;
        const m = add(new THREE.TorusGeometry(0.5, 0.04, 4, 8), PAL.wire, 0.5, w > h ? along : 0, w > h ? 0 : along);
        m.rotation.y = w > h ? 0 : Math.PI / 2;
      }
      break;
    }
    case 'mgNest': {
      // sandbag ring (two courses, gap at the back for the crew), roof on four posts (v4.5)
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        if (Math.abs(Math.cos(a) + 1) < 0.15) continue; // entrance at the back (-x)
        for (const [y, r, s] of [[0.22, 2.3, 1], [0.62, 2.25, 0.92]]) {
          const bag = add(new THREE.BoxGeometry(1.1 * s, 0.42, 0.75), new THREE.Color(PAL.sandbag).offsetHSL(0, 0, (i % 3) * 0.02 - (y > 0.5 ? 0.05 : 0)).getHex(), y, Math.cos(a) * r, Math.sin(a) * r);
          bag.rotation.y = -a + Math.PI / 2;
        }
      }
      for (const [px, pz] of [[1.7, 1.7], [1.7, -1.7], [-1.7, 1.7], [-1.7, -1.7]]) add(new THREE.BoxGeometry(0.15, 2.5, 0.15), 0x5a4a32, 1.25, px, pz);
      add(new THREE.BoxGeometry(4.4, 0.12, 4.4), 0x6e7262, 2.55); // corrugated sheet roof
      for (let k = -2; k <= 2; k++) add(new THREE.BoxGeometry(4.4, 0.06, 0.12), 0x5e6254, 2.63, 0, k * 0.85);
      add(new THREE.BoxGeometry(3.6, 0.4, 3.6), PAL.sandbag, 2.82); // bags on the roof against shrapnel
      add(new THREE.BoxGeometry(0.25, 0.9, 0.25), 0x2a2a2a, 0.75); // tripod post
      const gun = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.3), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), new THREE.MeshLambertMaterial({ color: 0x1b1b1b }));
      barrel.position.x = 0.9;
      gun.add(body, barrel);
      gun.position.y = 1.3;
      gun.name = 'turret';
      g.add(gun);
      break;
    }
    case 'powerStation': {
      // turbine hall, transformer yard, stack and pylon; the status lamp shows offline/online
      add(new THREE.BoxGeometry(w * 0.55, 7, h - 1), 0x8a8a80, 3.5, -w * 0.2, 0); // turbine hall
      add(new THREE.BoxGeometry(w * 0.55 + 0.3, 0.4, h - 0.7), 0x5a5a56, 7.2, -w * 0.2, 0); // roof edge
      add(new THREE.CylinderGeometry(0.9, 1.1, 14, 10), 0x7a706a, 7, -w * 0.38, -h * 0.25); // stack
      for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(1.6, 2.2, 1.4), 0x4e5a52, 1.1, w * 0.18 + (k % 2) * 2.4 - 1, (k - 1) * 3); // transformers
      add(new THREE.BoxGeometry(w * 0.4, 0.15, h - 0.6), 0x6a6a64, 0.08, w * 0.25, 0); // yard slab
      add(new THREE.BoxGeometry(0.25, 11, 0.25), 0x5a5a5a, 5.5, w * 0.42, 0); // pylon mast
      add(new THREE.BoxGeometry(0.15, 0.15, 4.5), 0x5a5a5a, 10.2, w * 0.42, 0); // pylon arm
      const lamp = add(new THREE.SphereGeometry(0.45, 10, 8), 0xc83a2a, 7.9, -w * 0.05, 0);
      lamp.name = 'lamp';
      break;
    }
    case 'vehicleBay': {
      // fallback when the owner's garage model (Salah3D's modular pack) isn't loaded: a shed with a roller door
      add(new THREE.BoxGeometry(w - 0.6, 4, h - 0.6), 0x8a8478, 2);
      add(new THREE.BoxGeometry(w - 0.2, 0.3, h - 0.2), 0x5a5c5e, 4.15);
      add(new THREE.BoxGeometry(w * 0.55, 3, 0.1), 0x6a6e70, 1.5, 0, -h / 2 + 0.25);
      break;
    }
    case 'medBay': {
      // field hospital: white tent block with a red cross, generator, stretchers
      add(new THREE.BoxGeometry(w - 1, 3.2, h - 1), 0xd8d6cc, 1.6);
      add(new THREE.BoxGeometry(w - 0.6, 0.3, h - 0.6), 0xb8b6ac, 3.35);
      add(new THREE.BoxGeometry(2.4, 0.7, 0.05), 0xc8302a, 2.1, 0, h / 2 - 0.47);
      add(new THREE.BoxGeometry(0.7, 2.4, 0.05), 0xc8302a, 2.1, 0, h / 2 - 0.47);
      add(new THREE.BoxGeometry(1.2, 1, 0.9), 0x4a5a3a, 0.5, w / 2 - 0.4, -h / 2 + 0.8); // generator
      for (const x of [-1.6, 1.6]) add(new THREE.BoxGeometry(2, 0.35, 0.7), 0x6a6a5a, 0.5, x, h / 2 + 0.6); // stretchers
      const lamp = add(new THREE.SphereGeometry(0.3, 8, 6), 0x404040, 3.7, w / 2 - 1, 0);
      lamp.name = 'lamp';
      break;
    }
    case 'guardTower': {
      // timber watchtower: four legs with cross-bracing, plank platform, sandbag parapet, ladder
      const H = s.def.garrison?.height ?? 5;
      const hw = w / 2 - 0.4;
      const hd = h / 2 - 0.4;
      for (const [x, z] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) add(new THREE.BoxGeometry(0.35, H + 1.2, 0.35), 0x6a5238, (H + 1.2) / 2, x, z);
      for (const z of [-hd, hd]) {
        const b = add(new THREE.BoxGeometry(w * 1.05, 0.15, 0.12), 0x5a4430, H / 2, 0, z);
        b.rotation.z = Math.atan2(H * 0.8, w);
      }
      for (const x of [-hw, hw]) {
        const b = add(new THREE.BoxGeometry(0.12, 0.15, h * 1.05), 0x5a4430, H / 2, x, 0);
        b.rotation.x = -Math.atan2(H * 0.8, h);
      }
      add(new THREE.BoxGeometry(w, 0.3, h), 0x7a6046, H, 0, 0); // platform
      for (const [x, z, sw, sd] of [[0, -hd, w, 0.6], [0, hd, w, 0.6], [-hw, 0, 0.6, h], [hw, 0, 0.6, h]]) add(new THREE.BoxGeometry(sw, 0.9, sd), PAL.sandbag, H + 0.6, x, z); // parapet
      // open-topped, so the squad on it stays visible from the iso camera
      add(new THREE.BoxGeometry(0.12, H, 0.5), 0x4a3a28, H / 2, hw + 0.25, 0); // ladder
      break;
    }
    case 'outpost': {
      add(new THREE.BoxGeometry(w - 3, 2.6, h - 4), 0x5d6b3a, 1.3); // command tent
      add(new THREE.BoxGeometry(0.12, 7, 0.12), 0x333333, 3.5, w / 2 - 1, -h / 2 + 1); // radio mast
      add(new THREE.BoxGeometry(1.4, 0.8, 0.05), 0x4a6a8a, 6.4, w / 2 - 0.3, -h / 2 + 1); // flag
      for (const [x, z] of [[-w / 2 + 1, h / 2 - 1], [w / 2 - 1, h / 2 - 1]]) add(new THREE.BoxGeometry(2.2, 0.9, 0.9), PAL.sandbag, 0.45, x, z);
      break;
    }
    case 'commandPost':
      add(new THREE.BoxGeometry(w - 1, 5, h - 1), 0x5f6553, 2.5);
      add(new THREE.BoxGeometry(0.2, 10, 0.2), 0x2a2a2a, 10, w / 3, 0);
      add(new THREE.BoxGeometry(2.4, 0.12, 2.4), 0xb0b0a0, 14.5, w / 3, 0);
      break;
    case 'barracks': {
      // Quonset hut: half-cylinder along X, arc up (v4.5: was rotated half underground)
      const r = Math.min(h / 2, 4);
      const len = w - 1;
      add(new THREE.BoxGeometry(w, 0.3, h), 0x7a7a72, 0.15); // slab
      add(new THREE.CylinderGeometry(r, r, len, 18, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), 0x5d6b3a, 0.3);
      for (let k = 0; k <= 6; k++) add(new THREE.CylinderGeometry(r + 0.04, r + 0.04, 0.12, 18, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), 0x4e5a30, 0.3, -len / 2 + (k * len) / 6); // ribs
      add(new THREE.BoxGeometry(0.2, 2.6, 2.2), 0x3a3a2a, 1.6, len / 2 + 0.05, 0); // door
      add(new THREE.BoxGeometry(0.25, 0.3, 2.8), 0x4a4a3a, 3.05, len / 2 + 0.05, 0); // door hood
      for (const sz of [1, -1]) for (let k = 0; k < 3; k++) {
        const x = -len / 3 + (k * len) / 3;
        const win = add(new THREE.BoxGeometry(1.2, 0.8, 0.1), 0x2e3c46, 2.4, x, sz * (r * 0.72));
        win.rotation.x = sz * 0.75;
      }
      for (const sz of [1.6, -1.6]) add(new THREE.BoxGeometry(0.9, 0.9, 0.9), PAL.sandbag, 0.75, len / 2 + 1.2, sz);
      break;
    }
    case 'supplyDepot':
      for (let i = 0; i < 14; i++) add(new THREE.BoxGeometry(1.8, 1.4, 1.8), i % 3 ? 0x7a6a4a : 0x5a6a3a, 0.7 + (i > 9 ? 1.4 : 0), -w / 2 + 1.5 + (i % 5) * 2.1, Math.floor((i % 10) / 5) * 2.2 - 1.5);
      add(new THREE.BoxGeometry(w, 0.15, h), 0x6a6050, 0.08);
      break;
    default:
      add(new THREE.BoxGeometry(w, 2, h), 0x777777, 1);
  }
  return g;
}

/** A hive: pulsing core, tendrils, a pool of goo. `core` is the part that pulses. */
export function buildHiveMesh(): { group: THREE.Group; core: THREE.Mesh } {
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(3, 1), new THREE.MeshLambertMaterial({ color: PAL.hive, emissive: PAL.hiveGlow, emissiveIntensity: 0.25, flatShading: true }));
  core.position.y = 2;
  core.castShadow = true;
  group.add(core);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const t = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.45, 0.75), new THREE.MeshLambertMaterial({ color: 0x4a1a28 }));
    t.position.set(Math.cos(a) * 3.5, 0.25, Math.sin(a) * 3.5);
    t.rotation.y = -a;
    group.add(t);
  }
  const goo = new THREE.Mesh(new THREE.CircleGeometry(8, 20), new THREE.MeshBasicMaterial({ color: 0x3a1420, transparent: true, opacity: 0.6, depthWrite: false }));
  goo.rotation.x = -Math.PI / 2;
  goo.position.y = 0.07;
  group.add(goo);
  return { group, core };
}

/** Box soldier (fallback when the character models aren't loaded). */
export function makeSoldier(color: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, -0.1) });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.28), dark);
  legs.position.y = 0.2;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.42, 0.4), mat);
  torso.position.y = 0.62;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), new THREE.MeshLambertMaterial({ color: PAL.skin }));
  head.position.y = 0.95;
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.28), new THREE.MeshLambertMaterial({ color: PAL.helmet }));
  helmet.position.y = 1.08;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.08), new THREE.MeshLambertMaterial({ color: 0x1e1e1e }));
  gun.position.set(0.28, 0.7, 0.12);
  for (const o of [legs, torso, head, helmet, gun]) {
    o.castShadow = true;
    g.add(o);
  }
  g.scale.setScalar(SOLDIER_SCALE);
  return g;
}

/** Instanced box zombies per type (fallback when the character models aren't loaded). */
export function makeZombieMeshes(): Map<string, THREE.InstancedMesh> {
  const out = new Map<string, THREE.InstancedMesh>();
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const humanoid = (fat: number) =>
    mergeGeometries([
      box(0.22, 0.45, 0.32 * fat, 0, 0.23, 0), // legs
      box(0.32 * fat, 0.5, 0.48 * fat, 0.05, 0.7, 0), // torso, hunched forward
      box(0.28, 0.28, 0.28, 0.15, 1.08, 0), // head
      box(0.5, 0.1, 0.1, 0.3, 0.85, 0.2 * fat), // arms reaching forward
      box(0.5, 0.1, 0.1, 0.3, 0.85, -0.2 * fat),
    ])!;
  const colors: Record<string, number> = { walker: PAL.walker, runner: PAL.runner, bloater: PAL.bloater };
  for (const t of ZOMBIE_TYPES) {
    // authored ~1.2 tall; scale to a 1.8 m person
    const geo = humanoid(t === 'bloater' ? 1.9 : t === 'runner' ? 0.85 : 1).scale(1.5, 1.5, 1.5);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), MAX_ZOMBIES);
    mesh.castShadow = true;
    mesh.count = 0;
    const c = new THREE.Color();
    for (let i = 0; i < MAX_ZOMBIES; i++) mesh.setColorAt(i, c.set(colors[t]).offsetHSL(((i * 37) % 11) / 200 - 0.025, 0, ((i * 13) % 9) / 90 - 0.05));
    mesh.frustumCulled = false;
    out.set(t, mesh);
  }
  return out;
}
