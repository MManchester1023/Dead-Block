import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Vec2 } from '../core/math';
import { isEnabled } from '../config/features';
import { BALANCE } from '../config/balance';
import { CELL } from '../config/world';
import type { World } from '../sim/World';
import type { Squad, Structure, Hive } from '../sim/entities';
import { CameraRig } from './CameraRig';
import { PAL } from './palette';
import { buildGroundTexture } from './procgen/ground';
import { buildCity } from './procgen/buildings';
import { drawDecor, makeCar, scatterDecor } from './procgen/props';
import { Batch } from './procgen/batch';
import { models } from './ModelLibrary';
import { squadStatus } from '../ui/status';
import { Crowd, type Clip, type Flipbook } from './characters';

interface SquadView {
  group: THREE.Group;
  ring: THREE.Mesh;
  members: THREE.Group[];
  label: HTMLDivElement;
}

interface Fx {
  obj: THREE.Object3D;
  life: number;
  max: number;
  update: (t: number, fx: Fx) => void;
}

const ZOMBIE_TYPES = ['walker', 'runner', 'bloater'] as const;
/** Soldier meshes are authored ~1.14 tall; scale to a 1.8 m person. */
const SOLDIER_SCALE = 1.6;
const MAX_ZOMBIES = 320;

/** World (x, y) → scene (x, h, y). The renderer only reads the simulation; it never mutates it. */
const CRATE_FALL_SEC = 6;
const FLYOVER_SPEED = 55; // m/s across the ground: slower than a real C-130 so you can watch it pass

/** Flat top-down silhouette of a four-engine cargo plane (~40 m span), nose along +x. */
function cargoPlaneShadow(): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  const pts: [number, number][] = [
    [15, 0], [13, 1.8], [4, 2.1], [2.5, 20], [-1.5, 20], [-2.5, 2.1], [-11, 1.8], [-13, 6.5], [-15.5, 6.5],
    [-15, 0], [-15.5, -6.5], [-13, -6.5], [-11, -1.8], [-2.5, -2.1], [-1.5, -20], [2.5, -20], [4, -2.1], [13, -1.8],
  ];
  s.moveTo(...pts[0]);
  for (const p of pts.slice(1)) s.lineTo(...p);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig: CameraRig;

  private squadViews = new Map<number, SquadView>();
  private structViews = new Map<number, THREE.Object3D>();
  private buildings: { mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; box: THREE.Box3; opacity: number }[] = [];
  private structLabels = new Map<number, HTMLDivElement>();
  private hiveViews = new Map<number, { group: THREE.Group; core: THREE.Mesh; label: HTMLDivElement }>();
  private zombieMeshes = new Map<string, THREE.InstancedMesh>();
  private districtOverlays = new Map<string, THREE.Mesh>();
  private districtLabels = new Map<string, HTMLDivElement>();
  private fx: Fx[] = [];
  private tracers: { a: Vec2; b: Vec2; life: number; heavy: boolean }[] = [];
  private tracerGeo = new THREE.BufferGeometry();
  private tracerPos = new Float32Array(1024 * 6);
  private tmpObj = new THREE.Object3D();
  private ghost: THREE.Mesh;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private time = 0;

  /** Animated character crowds (null → box placeholders, e.g. if the models failed to load). */
  private crowds: Record<string, Crowd> | null = null;
  private prevPos = new Map<number, { x: number; y: number }>();
  private corpses: { key: string; x: number; z: number; facing: number; t0: number; sx: number; sy: number; tint?: number }[] = [];
  private animClock = 0;
  private rallyFlag: THREE.Group;
  private flyovers = new Map<number, { mesh: THREE.Mesh; dir: Vec2; done: boolean }>();
  private ghostArrow: THREE.Mesh;
  private ghostRange: THREE.Mesh;
  /** Entity under the mouse (squad, structure or hive id): health bars only show on hover or selection (#35). */
  hovered: number | null = null;
  /** Selected base building, so its bar shows too. */
  selectedStructure: number | null = null;

  constructor(container: HTMLElement, private overlay: HTMLElement, private world: World, cast: Record<string, Flipbook> | null = null) {
    // full-resolution, anti-aliased isometric 3D (v4.3: the pixel-art filter was dropped)
    this.gl = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.gl.setSize(window.innerWidth, window.innerHeight);
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.gl.domElement);

    this.rig = new CameraRig({ w: world.map.width, h: world.map.height });
    this.scene.background = new THREE.Color(0x24262a);

    this.hemi = new THREE.HemisphereLight(0xc8ccd0, 0x3a3428, 1.2);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
    this.sun.position.set(world.map.width / 2 - 66, 210, world.map.height / 2 + 114);
    this.sun.target.position.set(world.map.width / 2, 0, world.map.height / 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    const sc = this.sun.shadow.camera;
    sc.left = -225;
    sc.right = 225;
    sc.top = 180;
    sc.bottom = -180;
    sc.far = 600;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.2;
    this.scene.add(this.sun, this.sun.target);

    this.buildStatic();
    if (cast) {
      this.crowds = {
        soldier: new Crowd(cast.soldier, 96),
        engineer: new Crowd(cast.engineer, 48),
        zombieM: new Crowd(cast.zombieM, 2000),
        zombieF: new Crowd(cast.zombieF, 2000),
      };
      for (const c of Object.values(this.crowds)) this.scene.add(c.group);
      this.crowds.zombieM.shadowLimit = this.crowds.zombieF.shadowLimit = 300;
    } else this.buildZombieMeshes();

    this.tracerGeo.setAttribute('position', new THREE.BufferAttribute(this.tracerPos, 3));
    const tracerLines = new THREE.LineSegments(this.tracerGeo, new THREE.LineBasicMaterial({ color: PAL.tracer, transparent: true, opacity: 0.9 }));
    tracerLines.frustumCulled = false;
    this.scene.add(tracerLines);

    this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 1), new THREE.MeshBasicMaterial({ color: 0x77dd77, transparent: true, opacity: 0.45, depthWrite: false }));
    this.ghost.visible = false;
    this.scene.add(this.ghost);

    // ghost extras (round 4 #42): a double-headed arrow along the way a wall runs (flips with R),
    // and the firing-range ring for armed structures
    const arrow = new THREE.Shape();
    const hl = 0.5, hw = 0.32, sw = 0.09; // unit-length arrow along +x, centred
    arrow.moveTo(-0.5, 0);
    arrow.lineTo(-0.5 + hl * 0.5, hw);
    arrow.lineTo(-0.5 + hl * 0.5, sw);
    arrow.lineTo(0.5 - hl * 0.5, sw);
    arrow.lineTo(0.5 - hl * 0.5, hw);
    arrow.lineTo(0.5, 0);
    arrow.lineTo(0.5 - hl * 0.5, -hw);
    arrow.lineTo(0.5 - hl * 0.5, -sw);
    arrow.lineTo(-0.5 + hl * 0.5, -sw);
    arrow.lineTo(-0.5 + hl * 0.5, -hw);
    arrow.closePath();
    this.ghostArrow = new THREE.Mesh(new THREE.ShapeGeometry(arrow), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide }));
    this.ghostArrow.rotation.x = -Math.PI / 2;
    this.ghostArrow.renderOrder = 10;
    this.ghostArrow.visible = false;
    this.ghostRange = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    this.ghostRange.rotation.x = -Math.PI / 2;
    this.ghostRange.visible = false;
    this.scene.add(this.ghostArrow, this.ghostRange);

    // Barracks rally flag (round 4 #36): pole + blue pennant, follows world.map.rally
    this.rallyFlag = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), new THREE.MeshLambertMaterial({ color: 0x3a3a3a }));
    pole.position.y = 1.5;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshLambertMaterial({ color: 0x4a7ab8, side: THREE.DoubleSide }));
    cloth.position.set(0.6, 2.6, 0);
    this.rallyFlag.add(pole, cloth);
    this.scene.add(this.rallyFlag);

    this.hookEvents();
    window.addEventListener('resize', () => this.resize());
  }

  // ---------------------------------------------------------------- static world

  private buildStatic(): void {
    const m = this.world.map;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(m.width, m.height), new THREE.MeshLambertMaterial({ map: buildGroundTexture(m) }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(m.width / 2, 0, m.height / 2);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // apron of wasteland so the map edge isn't a cliff into the void
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(m.width + 240, m.height + 240), new THREE.MeshLambertMaterial({ color: 0x4a4436 }));
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(m.width / 2, -0.02, m.height / 2);
    apron.receiveShadow = true;
    this.scene.add(apron);

    // procedural city (doc §14 v4.1): one mesh per building (so it can fade when it hides units),
    // all street props merged into a single mesh
    buildCity(m, (b, batch) => {
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
      const mesh = batch.build(mat);
      this.scene.add(mesh);
      const top = b.height + (b.kind === 'houses' ? 4 : b.kind === 'apartment' ? 4 : 2.5); // roofs, tanks, signs
      this.buildings.push({ mesh, mat, box: new THREE.Box3(new THREE.Vector3(b.rect.x, 0, b.rect.y), new THREE.Vector3(b.rect.x + b.rect.w, top, b.rect.y + b.rect.h)), opacity: 1 });
    });
    const city = new Batch();
    for (const d of scatterDecor(m, this.world.grid)) {
      const model = models.instance(d.kind);
      if (model) {
        model.position.set(d.x, 0, d.z);
        model.rotation.y += -d.ry;
        model.scale.multiplyScalar(d.scale);
        this.scene.add(model);
      } else drawDecor(city, d);
    }
    this.scene.add(city.build());

    for (const p of m.props) {
      const model = models.instance('car');
      if (model) {
        model.position.set(p.pos.x, 0, p.pos.y);
        model.rotation.y += (p.h > p.w ? Math.PI / 2 : 0) + ((p.id % 7) - 3) * 0.05;
        this.scene.add(model);
      } else this.scene.add(makeCar(p));
    }

    for (const d of m.districts) {
      if (d.id === 'base') continue;
      const ov = new THREE.Mesh(
        new THREE.PlaneGeometry(d.rect.w, d.rect.h),
        new THREE.MeshBasicMaterial({ color: PAL.infest, transparent: true, opacity: 0.2, depthWrite: false }),
      );
      ov.rotation.x = -Math.PI / 2;
      ov.position.set(d.rect.x + d.rect.w / 2, 0.06, d.rect.y + d.rect.h / 2);
      this.scene.add(ov);
      this.districtOverlays.set(d.id, ov);
      const lab = document.createElement('div');
      lab.className = 'district-label';
      this.overlay.appendChild(lab);
      this.districtLabels.set(d.id, lab);
    }
  }

  private buildZombieMeshes(): void {
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
      this.scene.add(mesh);
      this.zombieMeshes.set(t, mesh);
    }
  }

  // ---------------------------------------------------------------- dynamic sync

  private makeSoldier(color: number): THREE.Group {
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

  private squadView(s: Squad): SquadView {
    let v = this.squadViews.get(s.id);
    if (v) return v;
    const group = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.7, 3.1, 32), new THREE.MeshBasicMaterial({ color: PAL.select, transparent: true, opacity: 0.85, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    group.add(ring);
    const color = s.def.id === 'engineer' ? PAL.engineer : PAL.olive;
    const members = (this.crowds ? [] : s.members).map(() => {
      const m = this.makeSoldier(color);
      this.scene.add(m);
      return m;
    });
    this.scene.add(group);
    const label = document.createElement('div');
    label.className = 'squad-label';
    this.overlay.appendChild(label);
    v = { group, ring, members, label };
    this.squadViews.set(s.id, v);
    return v;
  }

  private structView(s: Structure): THREE.Object3D {
    let o = this.structViews.get(s.id);
    if (o) return o;
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
      case 'wire':
        for (let i = 0; i < Math.max(w, h); i++) {
          const along = i - (Math.max(w, h) - 1) / 2;
          const m = add(new THREE.TorusGeometry(0.5, 0.04, 4, 8), PAL.wire, 0.5, w > h ? along : 0, w > h ? 0 : along);
          m.rotation.y = w > h ? 0 : Math.PI / 2;
        }
        break;
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
    g.position.set(s.pos.x, 0, s.pos.y);
    this.scene.add(g);
    this.structViews.set(s.id, g);
    return g;
  }

  private hiveView(h: Hive) {
    let v = this.hiveViews.get(h.id);
    if (v) return v;
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
    group.position.set(h.pos.x, 0, h.pos.y);
    this.scene.add(group);
    const label = document.createElement('div');
    label.className = 'hive-label';
    this.overlay.appendChild(label);
    v = { group, core, label };
    this.hiveViews.set(h.id, v);
    return v;
  }

  // ---------------------------------------------------------------- events → fx

  private hookEvents(): void {
    const ev = this.world.events;
    ev.on('shot', (e) => {
      if (this.tracers.length < 1000) this.tracers.push({ a: e.from, b: e.to, life: e.heavy ? 0.12 : 0.06, heavy: !!e.heavy });
    });
    ev.on('explosion', (e) => this.spawnExplosion(e.pos, e.radius, e.type === 'toxic' ? 0x8fbf3a : 0xffa040));
    ev.on('zombieKilled', (e) => {
      this.spawnSplat(e.pos);
      if (this.crowds) {
        const look = zombieLook(e.id, e.defId);
        this.corpses.push({ key: look.key, x: e.pos.x, z: e.pos.y, facing: e.facing, t0: this.animClock, sx: look.sx, sy: look.sy, tint: look.tint });
        if (this.corpses.length > 600) this.corpses.shift();
      }
    });
    ev.on('memberKilled', (e) => {
      if (this.crowds) this.corpses.push({ key: e.unitId === 'engineer' ? 'engineer' : 'soldier', x: e.pos.x, z: e.pos.y, facing: e.facing, t0: this.animClock, sx: 1, sy: 1 });
    });
    ev.on('toxicCloud', (e) => this.spawnCloud(e.pos, e.radius, e.duration));
    ev.on('smoke', (e) => this.spawnSmoke(e.pos, e.color, e.duration));
    ev.on('bleed', (e) => this.spawnBleed(e.pos, e.from, e.heavy));
  }

  private addFx(obj: THREE.Object3D, life: number, update: Fx['update']): void {
    this.scene.add(obj);
    this.fx.push({ obj, life, max: life, update });
  }

  private spawnExplosion(p: Vec2, r: number, color: number): void {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.set(p.x, 1.2, p.y);
    this.addFx(m, 0.45, (t, fx) => {
      const k = 1 - fx.life / fx.max;
      m.scale.setScalar(0.3 + k * r);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      void t;
    });
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(r * 0.6, 10), new THREE.MeshBasicMaterial({ color: 0x1a1814, transparent: true, opacity: 0.55, depthWrite: false }));
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.set(p.x, 0.05, p.y);
    this.addFx(scorch, 60, (_t, fx) => ((scorch.material as THREE.MeshBasicMaterial).opacity = 0.55 * Math.min(1, fx.life / 10)));
  }

  /** Death: a dark pool that spreads out under the body and slowly dries (v4.5). */
  private spawnSplat(p: Vec2): void {
    if (this.fx.length > 700) return;
    const r = 0.7 + Math.random() * 0.6;
    const s = new THREE.Mesh(new THREE.CircleGeometry(1, 9), new THREE.MeshBasicMaterial({ color: 0x3e0c08, transparent: true, opacity: 0.8, depthWrite: false }));
    s.rotation.x = -Math.PI / 2;
    s.rotation.z = Math.random() * 6;
    s.position.set(p.x + (Math.random() - 0.5) * 0.4, 0.04 + Math.random() * 0.01, p.y + (Math.random() - 0.5) * 0.4);
    s.scale.set(0.2, 0.2 * (0.7 + Math.random() * 0.5), 1);
    this.addFx(s, 45, (_t, fx) => {
      const k = Math.min(1, (fx.max - fx.life) / 1.6); // spreads over ~1.6 s
      s.scale.x = r * (0.2 + 0.8 * k);
      s.scale.y = r * 0.85 * (0.2 + 0.8 * k);
      (s.material as THREE.MeshBasicMaterial).opacity = 0.8 * Math.min(1, fx.life / 10);
    });
  }

  private activeSprays = 0;
  /** Hit: a spurt of droplets thrown away from the shooter, plus a few spots on the ground (v4.5). */
  private spawnBleed(p: Vec2, from: Vec2 | undefined, heavy: boolean): void {
    if (this.activeSprays > 90 || this.fx.length > 700) return;
    this.activeSprays++;
    const away = from ? Math.atan2(p.y - from.y, p.x - from.x) : Math.random() * Math.PI * 2;
    const g = new THREE.Group();
    const n = heavy ? 9 : 5;
    const drops: { m: THREE.Mesh; vx: number; vy: number; vz: number }[] = [];
    const mat = new THREE.MeshBasicMaterial({ color: 0x7a1410 });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), mat);
      const a = away + (Math.random() - 0.5) * 1.1;
      const sp = 1.5 + Math.random() * (heavy ? 3.5 : 2.2);
      drops.push({ m, vx: Math.cos(a) * sp, vy: 1 + Math.random() * 2, vz: Math.sin(a) * sp });
      m.position.set(0, 1.2 + Math.random() * 0.3, 0);
      g.add(m);
    }
    g.position.set(p.x, 0, p.y);
    let last = 0;
    let done = false;
    this.addFx(g, 0.6, (t, fx) => {
      const dt = last ? Math.min(0.05, t - last) : 0.016;
      last = t;
      for (const d of drops) {
        d.vy -= 9.8 * dt;
        d.m.position.x += d.vx * dt;
        d.m.position.y = Math.max(0.03, d.m.position.y + d.vy * dt);
        d.m.position.z += d.vz * dt;
      }
      if (fx.life <= 0.02 && !done) {
        done = true;
        this.activeSprays--;
      }
    });
    if (Math.random() < 0.5) {
      // a couple of spots where it landed
      const spot = new THREE.Mesh(new THREE.CircleGeometry(0.18 + Math.random() * 0.15, 6), new THREE.MeshBasicMaterial({ color: 0x4a0e0a, transparent: true, opacity: 0.75, depthWrite: false }));
      spot.rotation.x = -Math.PI / 2;
      spot.position.set(p.x + Math.cos(away) * 1.2, 0.035, p.y + Math.sin(away) * 1.2);
      this.addFx(spot, 25, (_t, fx) => ((spot.material as THREE.MeshBasicMaterial).opacity = 0.75 * Math.min(1, fx.life / 6)));
    }
  }

  private spawnCloud(p: Vec2, r: number, dur: number): void {
    const c = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6), new THREE.MeshBasicMaterial({ color: 0x9fbf3a, transparent: true, opacity: 0.3, depthWrite: false }));
    c.scale.y = 0.4;
    c.position.set(p.x, 1, p.y);
    this.addFx(c, dur, (t, fx) => {
      (c.material as THREE.MeshBasicMaterial).opacity = 0.3 * Math.min(1, fx.life / 2);
      c.rotation.y = t * 0.3;
    });
  }

  /** Coloured marker smoke (doc §8: every call-in has its own colour). A billowing, drifting column. */
  private spawnSmoke(p: Vec2, color: number, duration: number): void {
    const g = new THREE.Group();
    const puffs: { m: THREE.Mesh; phase: number; drift: number }[] = [];
    const geo = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, emissive: color, emissiveIntensity: 0.15 }));
      g.add(m);
      puffs.push({ m, phase: i / 14, drift: (i % 3) - 1 });
    }
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.35, 8), new THREE.MeshLambertMaterial({ color: 0x4a5a3a }));
    can.position.y = 0.18;
    g.add(can);
    g.position.set(p.x, 0, p.y);
    this.addFx(g, duration, (t, fx) => {
      const fade = Math.min(1, fx.life / 3);
      for (const pf of puffs) {
        const k = (t * 0.25 + pf.phase) % 1; // 0 at the can, 1 at the top of the column
        pf.m.position.set(k * 3 + pf.drift * k * 1.5, 0.6 + k * 11, pf.drift * 0.6 * k + k * 1.2);
        pf.m.scale.setScalar(0.6 + k * 2.4);
        (pf.m.material as THREE.MeshLambertMaterial).opacity = (1 - k) * 0.65 * fade;
      }
    });
  }

  private crateViews = new Map<number, THREE.Group>();
  private syncCrates(): void {
    const w = this.world;
    const seen = new Set<number>();
    for (const c of w.crates) {
      seen.add(c.id);
      let v = this.crateViews.get(c.id);
      if (!v) {
        v = new THREE.Group();
        const crate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.4), new THREE.MeshLambertMaterial({ color: 0x6a6a3a }));
        crate.position.y = 0.55;
        crate.castShadow = true;
        const band = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.15, 1.45), new THREE.MeshLambertMaterial({ color: 0x2a2a1a }));
        band.position.y = 0.55;
        const chute = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xd8d0b8, side: THREE.DoubleSide }));
        chute.position.y = 6;
        chute.name = 'chute';
        const lines = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 0.5, 5, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x8a8670, wireframe: true }));
        lines.position.y = 3.5;
        lines.name = 'lines';
        v.add(crate, band, chute, lines);
        this.scene.add(v);
        this.crateViews.set(c.id, v);
      }
      // round 4 #37: a cargo plane's shadow sweeps over first; the crate leaves the ramp as it passes
      const untilLand = c.landsAt - w.time;
      const released = c.landed || untilLand <= CRATE_FALL_SEC;
      v.visible = released;
      this.flyover(c.id, c.pos, untilLand - CRATE_FALL_SEC);
      const height = c.landed ? 0 : Math.max(0, untilLand) * 7;
      v.position.set(c.pos.x, height, c.pos.y);
      v.getObjectByName('chute')!.visible = !c.landed;
      v.getObjectByName('lines')!.visible = !c.landed;
    }
    for (const [id, v] of this.crateViews)
      if (!seen.has(id)) {
        this.scene.remove(v);
        this.crateViews.delete(id);
      }
    for (const [id, f] of this.flyovers)
      if (!seen.has(id) && f.done) {
        this.scene.remove(f.mesh);
        this.flyovers.delete(id);
      }
  }

  /**
   * Aircraft shadow sweeping over `pos` (reused later for gun runs, bombing runs, AC-130 orbits).
   * `tOverhead` = seconds until it's directly above. Approaches from the base side.
   */
  private flyover(id: number, pos: Vec2, tOverhead: number): void {
    let f = this.flyovers.get(id);
    if (!f) {
      const mesh = new THREE.Mesh(cargoPlaneShadow(), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 2;
      this.scene.add(mesh);
      const gate = this.world.map.baseGate;
      const dx = pos.x - (gate.x + gate.w);
      const dy = pos.y - (gate.y + gate.h / 2);
      const l = Math.hypot(dx, dy) || 1;
      f = { mesh, dir: { x: dx / l, y: dy / l }, done: false };
      this.flyovers.set(id, f);
    }
    const along = -tOverhead * FLYOVER_SPEED; // metres past the drop point
    f.done = along > 400;
    f.mesh.visible = !f.done && along > -400;
    f.mesh.position.set(pos.x + f.dir.x * along, 0.15, pos.y + f.dir.y * along);
    f.mesh.rotation.z = -Math.atan2(f.dir.y, f.dir.x);
  }

  marker(p: Vec2, color: number): void {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.4, 20), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(p.x, 0.09, p.y);
    this.addFx(m, 0.6, (_t, fx) => {
      const k = 1 - fx.life / fx.max;
      m.scale.setScalar(1 + k * 1.5);
      (m.material as THREE.MeshBasicMaterial).opacity = 1 - k;
    });
  }

  setGhost(tile: { x: number; y: number } | null, size = { w: 1, h: 1 }, ok = true, range = 0): void {
    this.ghost.visible = !!tile;
    this.ghostArrow.visible = !!tile && size.w !== size.h;
    this.ghostRange.visible = !!tile && range > 0;
    if (!tile) return;
    const cx = (tile.x + size.w / 2) * CELL;
    const cz = (tile.y + size.h / 2) * CELL;
    this.ghost.scale.set(size.w * CELL, 1, size.h * CELL);
    this.ghost.position.set(cx, 0.75, cz);
    (this.ghost.material as THREE.MeshBasicMaterial).color.set(ok ? 0x77dd77 : PAL.danger);
    if (this.ghostArrow.visible) {
      const len = Math.max(size.w, size.h) * CELL + 1.5;
      this.ghostArrow.position.set(cx, 1.6, cz);
      this.ghostArrow.scale.set(len, 2.2, 1);
      this.ghostArrow.rotation.z = size.w > size.h ? 0 : Math.PI / 2;
    }
    if (this.ghostRange.visible) {
      this.ghostRange.position.set(cx, 0.12, cz);
      this.ghostRange.scale.setScalar(range);
    }
  }

  // ---------------------------------------------------------------- frame

  render(realDt: number, simDt: number, selected: Set<number>): void {
    this.time += realDt;
    this.animClock += simDt;
    const w = this.world;
    this.rig.apply(realDt);
    this.rallyFlag.position.set(w.map.rally.x, 0, w.map.rally.y);
    this.rallyFlag.rotation.y = Math.sin(this.time * 1.3) * 0.15;
    if (this.crowds) this.renderCrowds(simDt);
    this.fadeOccluders(realDt);

    // squads
    const seen = new Set<number>();
    for (const s of w.squads) {
      if (!s.alive) continue;
      seen.add(s.id);
      const v = this.squadView(s);
      v.group.position.set(s.pos.x, 0, s.pos.y);
      v.ring.visible = selected.has(s.id);
      if (!this.crowds) s.members.forEach((m, i) => {
        const g = v.members[i];
        g.visible = m.alive;
        if (!m.alive) return;
        const bob = s.moving ? Math.abs(Math.sin(this.time * 10 + i)) * 0.1 : 0;
        g.position.set(m.pos.x, bob, m.pos.y);
        g.rotation.y = -m.facing;
        g.scale.y = SOLDIER_SCALE * (s.inCover && !s.moving ? 0.82 : 1); // crouch behind cover
      });
      this.placeLabel(v.label, s.pos, 3.4, () => this.squadLabelHtml(s, selected.has(s.id), this.hovered === s.id));
    }
    for (const [id, v] of this.squadViews)
      if (!seen.has(id)) {
        this.scene.remove(v.group);
        v.members.forEach((m) => this.scene.remove(m));
        v.label.remove();
        this.squadViews.delete(id);
      }

    // zombies (placeholder boxes, only when the character models aren't loaded)
    const counts: Record<string, number> = { walker: 0, runner: 0, bloater: 0 };
    if (!this.crowds) for (const z of w.zombies) {
      if (!z.alive) continue;
      const type = this.zombieMeshes.has(z.def.id) ? z.def.id : 'walker';
      const mesh = this.zombieMeshes.get(type)!;
      const i = counts[type]++;
      if (i >= MAX_ZOMBIES) continue;
      const lurch = z.state === 'idle' ? 0 : Math.sin(this.time * (z.def.speed * 4) + z.id) * 0.12;
      this.tmpObj.position.set(z.pos.x, 0, z.pos.y);
      this.tmpObj.rotation.set(0, -z.facing, lurch);
      this.tmpObj.scale.setScalar(z.state === 'attack' ? 1.05 : 1);
      this.tmpObj.updateMatrix();
      mesh.setMatrixAt(i, this.tmpObj.matrix);
    }
    for (const [t, mesh] of this.zombieMeshes) {
      mesh.count = Math.min(MAX_ZOMBIES, counts[t]);
      mesh.instanceMatrix.needsUpdate = true;
    }

    // structures
    const sseen = new Set<number>();
    for (const s of w.structures) {
      if (!s.alive) continue;
      sseen.add(s.id);
      const o = this.structView(s);
      const k = s.built ? 1 : 0.15 + 0.85 * Math.min(1, s.buildProgress / s.def.buildTime);
      o.scale.y = k;
      o.traverse((c) => {
        const mat = (c as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
        if (mat && 'opacity' in mat) mat.opacity = s.built ? 1 : 0.55;
      });
      const turret = o.getObjectByName('turret');
      if (turret) turret.rotation.y = -s.facing;
      // progress bar while unfinished, health bar while damaged (v4.4: resume / repair)
      // build progress always shows; health only on hover / selection (#35)
      const focus = this.hovered === s.id || this.selectedStructure === s.id;
      const needsBar = !s.built || (focus && s.hp < s.def.hp - 0.5);
      let lab = this.structLabels.get(s.id);
      if (needsBar) {
        if (!lab) {
          lab = document.createElement('div');
          lab.className = 'struct-label';
          this.overlay.appendChild(lab);
          this.structLabels.set(s.id, lab);
        }
        const pct = s.built ? (s.hp / s.def.hp) * 100 : Math.min(100, (s.buildProgress / s.def.buildTime) * 100);
        this.placeLabel(lab, s.pos, 2.5, () =>
          `<span>${s.built ? 'Damaged' : 'Unfinished'} ${Math.floor(pct)}%</span><div class="bar ${s.built ? 'hp' : 'build'}"><i style="width:${pct.toFixed(0)}%"></i></div>`,
        );
      } else if (lab) {
        lab.remove();
        this.structLabels.delete(s.id);
      }
    }
    for (const [id, lab] of this.structLabels)
      if (!sseen.has(id)) {
        lab.remove();
        this.structLabels.delete(id);
      }
    for (const [id, o] of this.structViews)
      if (!sseen.has(id)) {
        this.scene.remove(o);
        this.structViews.delete(id);
        const p = new THREE.Vector3();
        o.getWorldPosition(p);
        this.spawnExplosion({ x: p.x, y: p.z }, 1.5, 0x9a8a6a);
      }

    // hives
    for (const h of w.hives) {
      const v = this.hiveView(h);
      if (!h.alive) {
        if (v.group.visible) {
          v.group.visible = false;
          v.label.remove();
        }
        continue;
      }
      const pulse = 1 + Math.sin(this.time * (1.5 + h.stage)) * 0.06;
      v.core.scale.setScalar((0.8 + h.stage * 0.18) * pulse);
      (v.core.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.15 + h.stage * 0.12 + (pulse - 1) * 2;
      this.placeLabel(v.label, h.pos, 7, () => {
        const pct = Math.max(0, h.hp / BALANCE.hive.hpByStage[h.stage - 1]) * 100;
        return `<b>HIVE</b> · stage ${h.stage}/4${this.hovered === h.id ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ''}`;
      });
    }

    this.syncCrates();

    // district overlays (infestation → red tint) + ops-map labels
    for (const [id, ov] of this.districtOverlays) {
      const d = w.districts.get(id)!;
      const mat = ov.material as THREE.MeshBasicMaterial;
      // a faint tint at street level (keep the asphalt grey), a clear read on the ops map
      const k = this.rig.strategic ? 1 : 0.25;
      mat.opacity = (d.secured ? 0.07 : 0.04 + (d.infestation / 100) * 0.26) * k;
      mat.color.set(d.secured ? 0x5d8a4a : PAL.infest);
      const lab = this.districtLabels.get(id)!;
      lab.style.display = this.rig.strategic ? 'block' : 'none';
      if (this.rig.strategic)
        this.placeLabel(lab, { x: d.def.rect.x + d.def.rect.w / 2, y: d.def.rect.y + d.def.rect.h / 2 }, 0, () =>
          `<div class="dname">${d.def.name}</div><div>${d.secured ? 'SECURED' : `${Math.ceil(d.infestation)}% infested`}</div>`,
        );
    }

    // tracers
    let n = 0;
    for (const t of this.tracers) {
      t.life -= realDt;
      if (t.life <= 0 || n >= 1024) continue;
      const o = n * 6;
      this.tracerPos.set([t.a.x, 1.3, t.a.y, t.b.x, 1.1, t.b.y], o);
      n++;
    }
    this.tracers = this.tracers.filter((t) => t.life > 0);
    this.tracerGeo.setDrawRange(0, n * 2);
    (this.tracerGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    // fx (sim-time paced so pause freezes the battlefield)
    for (const f of this.fx) {
      f.life -= simDt > 0 ? simDt : 0;
      f.update(this.time, f);
    }
    for (const f of this.fx) if (f.life <= 0) this.scene.remove(f.obj);
    this.fx = this.fx.filter((f) => f.life > 0);

    if (isEnabled('dayNight')) this.applyTimeOfDay(w.dayTimer / BALANCE.economy.dayLengthSec);

    this.gl.render(this.scene, this.rig.camera);
  }

  /**
   * See-through buildings (v4.5 next-step 1): any building between the camera and one of your
   * squads (or a hive / a structure under construction) fades to a ghost so you never lose units
   * behind a block. Analytic ray-vs-box per building, so it costs nothing.
   */
  private fadeOccluders(dt: number): void {
    const w = this.world;
    const toCam = new THREE.Vector3();
    this.rig.camera.getWorldDirection(toCam).negate();
    const points: THREE.Vector3[] = [];
    for (const s of w.squads) if (s.alive) points.push(new THREE.Vector3(s.pos.x, 1, s.pos.y));
    for (const st of w.structures) if (st.alive && !st.built) points.push(new THREE.Vector3(st.pos.x, 0.8, st.pos.y));
    for (const h of w.hives) if (h.alive) points.push(new THREE.Vector3(h.pos.x, 1.5, h.pos.y));
    const ray = new THREE.Ray();
    const k = 1 - Math.exp(-10 * dt);
    for (const b of this.buildings) {
      let hides = false;
      for (const p of points) {
        // skip units standing inside the footprint's margin (e.g. on the sidewalk right next to it)
        ray.set(p, toCam);
        if (ray.intersectsBox(b.box) && !b.box.containsPoint(p)) {
          hides = true;
          break;
        }
      }
      const target = hides ? 0.18 : 1;
      b.opacity += (target - b.opacity) * k;
      if (Math.abs(b.opacity - target) < 0.01) b.opacity = target;
      const see = b.opacity < 0.99;
      if (see !== b.mat.transparent) {
        b.mat.transparent = see;
        b.mat.depthWrite = !see;
        b.mat.needsUpdate = true;
      }
      b.mat.opacity = b.opacity;
    }
  }

  /** Animated soldiers, engineers, zombies and corpses via flipbook crowds. */
  private renderCrowds(simDt: number): void {
    const w = this.world;
    const C = this.crowds!;
    for (const c of Object.values(C)) c.begin();
    const t = this.animClock;
    const speedOf = (id: number, x: number, y: number) => {
      const p = this.prevPos.get(id);
      this.prevPos.set(id, { x, y });
      return p && simDt > 0 ? Math.hypot(x - p.x, y - p.y) / simDt : 0;
    };

    for (const s of w.squads) {
      if (!s.alive) continue;
      const crowd = s.def.id === 'engineer' ? C.engineer : C.soldier;
      const order = s.currentOrder?.type;
      const working = !s.moving && (order === 'build' || order === 'repair' || order === 'deconstruct' || order === 'charge');
      s.members.forEach((m, i) => {
        if (!m.alive) return;
        const key = s.id * 8 + i + 1e7;
        const v = speedOf(key, m.pos.x, m.pos.y);
        const phase = (s.id * 0.37 + i * 0.61) % 1;
        let clip: Clip = 'idle';
        let ct = t + phase * 4;
        if (working && crowd.has('work')) clip = 'work';
        else if (w.time - m.lastShot < 0.7) clip = 'shoot';
        else if (v > 0.4) {
          clip = 'walk';
          ct = t * Math.min(3, Math.max(0.7, v / 2.2)) + phase;
        }
        crowd.add(clip, ct, m.pos.x, m.pos.y, m.facing);
      });
    }

    for (const z of w.zombies) {
      if (!z.alive) continue;
      const look = zombieLook(z.id, z.def.id);
      const crowd = C[look.key];
      const v = speedOf(z.id, z.pos.x, z.pos.y);
      const phase = ((z.id * 0.618) % 1) * 3;
      let clip: Clip = 'idle';
      let ct = t + phase;
      if (z.state === 'attack') clip = 'punch';
      else if (v > 4 && crowd.has('run')) {
        clip = 'run';
        ct = t * Math.min(1.8, Math.max(0.8, v / 6)) + phase;
      } else if (v > 0.3) {
        clip = 'walk';
        ct = t * Math.min(3.2, Math.max(0.6, v / 1.8)) + phase;
      }
      crowd.add(clip, ct, z.pos.x, z.pos.y, z.facing, look.sx, look.tint, 0, look.sy);
    }
    if (this.prevPos.size > 8000) this.prevPos.clear();

    // corpses: play the death once, lie there a while, then sink into the ground. Models whose death
    // clip doesn't end on the ground get tipped over backwards as it finishes (round 4 #34).
    this.corpses = this.corpses.filter((c) => t - c.t0 < 50);
    for (const c of this.corpses) {
      const age = t - c.t0;
      const crowd = C[c.key];
      let sink = age > 42 ? (age - 42) * 0.15 : 0;
      let tilt = 0;
      if (!crowd.book.deathFalls) {
        const start = (crowd.book.durations.death ?? 1) * 0.45;
        const k = Math.min(1, Math.max(0, (age - start) / 0.45));
        tilt = k * k * (Math.PI / 2) * 0.96; // accelerate into the fall
        sink -= k * 0.14; // keep the back on the asphalt, not half under it
      }
      crowd.add('death', age, c.x, c.z, c.facing, c.sx, c.tint, sink, c.sy, tilt);
    }
    for (const c of Object.values(C)) c.end();
  }

  /** Tier 2 hook (doc §14): day/night lighting from the in-game day fraction. */
  private applyTimeOfDay(f: number): void {
    const daylight = Math.max(0.12, Math.sin(f * Math.PI));
    this.sun.intensity = 2.2 * daylight;
    this.hemi.intensity = 0.4 + 0.8 * daylight;
  }

  /** Squad whose name label is under this screen point (clicking a name selects it; #39). */
  squadAtLabel(x: number, y: number): number | null {
    for (const [id, v] of this.squadViews) {
      if (v.label.style.display === 'none') continue;
      const n = v.label.querySelector('.sname');
      if (!n) continue;
      const r = n.getBoundingClientRect();
      if (x >= r.left - 3 && x <= r.right + 3 && y >= r.top - 3 && y <= r.bottom + 3) return id;
    }
    return null;
  }

  private squadLabelHtml(s: Squad, sel: boolean, hover = false): string {
    const k = s.hp / s.maxHp;
    const bar = `<span class="hpbar"><i class="${k < 0.35 ? 'low' : k < 0.7 ? 'mid' : ''}" style="width:${(k * 100).toFixed(0)}%"></i></span>`;
    const pips = bar + s.members.map((m) => `<span class="pip ${m.alive ? '' : 'dead'}"></span>`).join('');
    const st = squadStatus(s, this.world);
    const cover = st.tone === 'idle' && st.text === 'IDLE' ? '' : `<span class="status ${st.tone}">${st.text}</span>`;
    const lvl = s.level ? `<span class="tag lvl">${s.levelName.toUpperCase()}</span>` : '';
    const bars = sel || hover ? `<div class="pips">${pips}</div>` : '';
    return `<div class="sname ${sel ? 'sel' : ''} ${hover ? 'hover' : ''}">${s.name}${lvl}</div>${cover ? `<div>${cover}</div>` : ''}${bars}`;
  }

  private labelCache = new WeakMap<HTMLElement, string>();
  private placeLabel(el: HTMLElement, p: Vec2, h: number, html: () => string): void {
    const v = new THREE.Vector3(p.x, h, p.y).project(this.rig.camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    const off = x < -50 || y < -50 || x > window.innerWidth + 50 || y > window.innerHeight + 50;
    el.style.display = off ? 'none' : 'block';
    if (off) return;
    el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -100%)`;
    const s = html();
    if (this.labelCache.get(el) !== s) {
      el.innerHTML = s;
      this.labelCache.set(el, s);
    }
  }

  // ---------------------------------------------------------------- picking

  worldToScreen(p: Vec2): { x: number; y: number } {
    const v = new THREE.Vector3(p.x, 1, p.y).project(this.rig.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }

  screenToGround(sx: number, sy: number): Vec2 {
    const ndc = new THREE.Vector2((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.rig.camera);
    const t = -ray.ray.origin.y / ray.ray.direction.y;
    const hit = ray.ray.origin.clone().addScaledVector(ray.ray.direction, t);
    return { x: hit.x, y: hit.z };
  }

  resize(): void {
    this.gl.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.gl.setSize(window.innerWidth, window.innerHeight);
    this.rig.resize(window.innerWidth, window.innerHeight);
  }
}

/** Which body and tint a zombie gets: varied by id, Bloaters swollen and sickly, Runners lean. */
function zombieLook(id: number, defId: string): { key: string; sx: number; sy: number; tint: number } {
  const h = ((id * 2654435761) >>> 0) / 4294967296;
  const shade = 0.82 + h * 0.3;
  const grey = Math.round(Math.min(1, shade) * 255);
  const tint = (grey << 16) | (grey << 8) | grey;
  if (defId === 'bloater') return { key: 'zombieM', sx: 1.7, sy: 1.12, tint: 0xd8f0a0 };
  if (defId === 'runner') return { key: 'zombieF', sx: 0.92, sy: 1.02, tint };
  return { key: h < 0.3 ? 'zombieF' : 'zombieM', sx: 1, sy: 0.96 + h * 0.1, tint };
}
