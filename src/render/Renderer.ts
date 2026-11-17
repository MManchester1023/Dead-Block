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
import { facadeTexture, groundTexture } from './textures';

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
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig: CameraRig;
  pixelScale = 0.5;

  private squadViews = new Map<number, SquadView>();
  private structViews = new Map<number, THREE.Object3D>();
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

  constructor(container: HTMLElement, private overlay: HTMLElement, private world: World) {
    this.gl = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(this.pixelScale * Math.min(2, window.devicePixelRatio));
    this.gl.setSize(window.innerWidth, window.innerHeight);
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl.domElement.classList.add('pixelated');
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
    this.buildZombieMeshes();

    this.tracerGeo.setAttribute('position', new THREE.BufferAttribute(this.tracerPos, 3));
    const tracerLines = new THREE.LineSegments(this.tracerGeo, new THREE.LineBasicMaterial({ color: PAL.tracer, transparent: true, opacity: 0.9 }));
    tracerLines.frustumCulled = false;
    this.scene.add(tracerLines);

    this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 1), new THREE.MeshBasicMaterial({ color: 0x77dd77, transparent: true, opacity: 0.45, depthWrite: false }));
    this.ghost.visible = false;
    this.scene.add(this.ghost);

    this.hookEvents();
    window.addEventListener('resize', () => this.resize());
  }

  // ---------------------------------------------------------------- static world

  private buildStatic(): void {
    const m = this.world.map;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(m.width, m.height),
      new THREE.MeshLambertMaterial({ map: groundTexture(m) }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(m.width / 2, 0, m.height / 2);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // apron of wasteland so the map edge isn't a cliff into the void
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(m.width + 240, m.height + 240), new THREE.MeshLambertMaterial({ color: 0x2f2c26 }));
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(m.width / 2, -0.02, m.height / 2);
    this.scene.add(apron);

    for (const b of m.buildings) {
      const g = new THREE.Group();
      const tex = facadeTexture(b.id * 31);
      // each facade tile is 2 bays × 2 floors ≈ 7 m × 6 m
      tex.repeat.set(Math.max(1, Math.round(Math.max(b.rect.w, b.rect.h) / 7)), Math.max(1, Math.round(b.height / 6)));
      const wallMat = new THREE.MeshLambertMaterial({ color: b.color, map: tex });
      const roofMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(b.color).offsetHSL(0, -0.04, -0.04) });
      const mats = [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat];
      const body = new THREE.Mesh(new THREE.BoxGeometry(b.rect.w, b.height, b.rect.h), mats);
      body.position.y = b.height / 2;
      // buildings cast but don't receive: swiftshader/low-end GPUs acne-black the large roof faces otherwise
      body.castShadow = true;
      g.add(body);
      // parapet + rooftop clutter (future: rooftop positions, doc §5)
      const parMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(b.color).offsetHSL(0, 0, 0.06) });
      for (const [w, d, x, z] of [
        [b.rect.w, 0.4, 0, -b.rect.h / 2 + 0.2],
        [b.rect.w, 0.4, 0, b.rect.h / 2 - 0.2],
        [0.4, b.rect.h, -b.rect.w / 2 + 0.2, 0],
        [0.4, b.rect.h, b.rect.w / 2 - 0.2, 0],
      ]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, d), parMat);
        p.position.set(x, b.height + 0.4, z);
        p.castShadow = true;
        g.add(p);
      }
      if (b.rect.w * b.rect.h > 270) {
        const ac = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 2), new THREE.MeshLambertMaterial({ color: 0x8c8f8a }));
        ac.position.set(b.rect.w * 0.2, b.height + 0.7, -b.rect.h * 0.15);
        ac.castShadow = true;
        g.add(ac);
      }
      g.position.set(b.rect.x + b.rect.w / 2, 0, b.rect.y + b.rect.h / 2);
      this.scene.add(g);
    }

    for (const p of m.props) {
      const g = new THREE.Group();
      const col = new THREE.Color(p.color);
      // real sedan: 4.6 × 1.85 m, 1.45 m tall
      const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.75, 1.85), new THREE.MeshLambertMaterial({ color: col }));
      body.position.y = 0.6;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 1.65), new THREE.MeshLambertMaterial({ color: col.clone().offsetHSL(0, -0.1, -0.08) }));
      cab.position.set(-0.25, 1.2, 0);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.32, 1.67), new THREE.MeshLambertMaterial({ color: 0x2b3438 }));
      glass.position.set(-0.25, 1.22, 0);
      for (const o of [body, cab, glass]) {
        o.castShadow = true;
        g.add(o);
      }
      // wheels (v4.2 playtest note) — abandoned cars sit a bit low, some on flats
      const tyre = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });
      const rim = new THREE.MeshLambertMaterial({ color: 0x8a8a86 });
      const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12).rotateX(Math.PI / 2);
      const rimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.26, 8).rotateX(Math.PI / 2);
      for (const [wx, wz] of [[1.45, 0.86], [1.45, -0.86], [-1.45, 0.86], [-1.45, -0.86]]) {
        const flat = (p.id + wx * 3 + wz * 7) % 5 === 0;
        const y = flat ? 0.24 : 0.34;
        const wh = new THREE.Mesh(wheelGeo, tyre);
        wh.position.set(wx, y, wz);
        const r = new THREE.Mesh(rimGeo, rim);
        r.position.set(wx, y, wz);
        wh.castShadow = true;
        g.add(wh, r);
      }
      body.position.y = 0.72; // lifted onto its wheels
      cab.position.y = 1.32;
      glass.position.y = 1.34;
      // bumpers + lights for a bit more silhouette
      for (const sx of [2.33, -2.33]) {
        const bump = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 1.8), new THREE.MeshLambertMaterial({ color: 0x3a3a3a }));
        bump.position.set(sx, 0.48, 0);
        g.add(bump);
      }
      for (const lz of [0.65, -0.65]) {
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.32), new THREE.MeshBasicMaterial({ color: 0xd8d2b0 }));
        head.position.set(2.31, 0.78, lz);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.32), new THREE.MeshBasicMaterial({ color: 0x8a2020 }));
        tail.position.set(-2.31, 0.78, lz);
        g.add(head, tail);
      }
      g.position.set(p.pos.x, 0, p.pos.y);
      if (p.h > p.w) g.rotation.y = Math.PI / 2;
      g.rotation.y += ((p.id % 7) - 3) * 0.04; // abandoned, not parked neatly
      this.scene.add(g);
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
    const members = s.members.map(() => {
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
        add(new THREE.CylinderGeometry(2.4, 2.6, 1.0, 10, 1, true), PAL.sandbag, 0.5);
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
      case 'barracks':
        add(new THREE.CylinderGeometry(h / 2, h / 2, w, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2), 0x5d6b3a, 0);
        add(new THREE.BoxGeometry(0.2, 2.6, 2.2), 0x3a3a2a, 1.3, w / 2, 0);
        break;
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
    ev.on('zombieKilled', (e) => this.spawnSplat(e.pos));
    ev.on('toxicCloud', (e) => this.spawnCloud(e.pos, e.radius, e.duration));
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

  private spawnSplat(p: Vec2): void {
    if (this.fx.length > 600) return;
    const s = new THREE.Mesh(new THREE.CircleGeometry(0.6 + Math.random() * 0.5, 6), new THREE.MeshBasicMaterial({ color: PAL.blood, transparent: true, opacity: 0.7, depthWrite: false }));
    s.rotation.x = -Math.PI / 2;
    s.position.set(p.x, 0.04, p.y);
    this.addFx(s, 40, (_t, fx) => ((s.material as THREE.MeshBasicMaterial).opacity = 0.7 * Math.min(1, fx.life / 8)));
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

  setGhost(tile: { x: number; y: number } | null, size = { w: 1, h: 1 }, ok = true): void {
    this.ghost.visible = !!tile;
    if (!tile) return;
    this.ghost.scale.set(size.w * CELL, 1, size.h * CELL);
    this.ghost.position.set((tile.x + size.w / 2) * CELL, 0.75, (tile.y + size.h / 2) * CELL);
    (this.ghost.material as THREE.MeshBasicMaterial).color.set(ok ? 0x77dd77 : PAL.danger);
  }

  // ---------------------------------------------------------------- frame

  render(realDt: number, simDt: number, selected: Set<number>): void {
    this.time += realDt;
    const w = this.world;
    this.rig.apply(realDt);

    // squads
    const seen = new Set<number>();
    for (const s of w.squads) {
      if (!s.alive) continue;
      seen.add(s.id);
      const v = this.squadView(s);
      v.group.position.set(s.pos.x, 0, s.pos.y);
      v.ring.visible = selected.has(s.id);
      s.members.forEach((m, i) => {
        const g = v.members[i];
        g.visible = m.alive;
        if (!m.alive) return;
        const bob = s.moving ? Math.abs(Math.sin(this.time * 10 + i)) * 0.1 : 0;
        g.position.set(m.pos.x, bob, m.pos.y);
        g.rotation.y = -m.facing;
        g.scale.y = SOLDIER_SCALE * (s.inCover && !s.moving ? 0.82 : 1); // crouch behind cover
      });
      this.placeLabel(v.label, s.pos, 3.4, () => this.squadLabelHtml(s, selected.has(s.id)));
    }
    for (const [id, v] of this.squadViews)
      if (!seen.has(id)) {
        this.scene.remove(v.group);
        v.members.forEach((m) => this.scene.remove(m));
        v.label.remove();
        this.squadViews.delete(id);
      }

    // zombies
    const counts: Record<string, number> = { walker: 0, runner: 0, bloater: 0 };
    for (const z of w.zombies) {
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
        return `<b>HIVE</b> · stage ${h.stage}/4<div class="bar"><i style="width:${pct}%"></i></div>`;
      });
    }

    // district overlays (infestation → red tint) + ops-map labels
    for (const [id, ov] of this.districtOverlays) {
      const d = w.districts.get(id)!;
      const mat = ov.material as THREE.MeshBasicMaterial;
      mat.opacity = d.secured ? 0.07 : 0.04 + (d.infestation / 100) * 0.26;
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

  /** Tier 2 hook (doc §14): day/night lighting from the in-game day fraction. */
  private applyTimeOfDay(f: number): void {
    const daylight = Math.max(0.12, Math.sin(f * Math.PI));
    this.sun.intensity = 2.2 * daylight;
    this.hemi.intensity = 0.4 + 0.8 * daylight;
  }

  private squadLabelHtml(s: Squad, sel: boolean): string {
    const pips = s.members
      .map((m) => {
        const k = m.alive ? m.hp / m.maxHp : 0;
        const cls = !m.alive ? 'dead' : k < 0.35 ? 'low' : k < 0.7 ? 'mid' : '';
        return `<span class="pip ${cls}"></span>`;
      })
      .join('');
    const cover = s.inCover ? '<span class="tag">COVER</span>' : '';
    const lvl = s.level ? `<span class="tag lvl">${s.levelName.toUpperCase()}</span>` : '';
    return `<div class="sname ${sel ? 'sel' : ''}">${s.name}${lvl}${cover}</div><div class="pips">${pips}</div>`;
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

  togglePixelation(): void {
    this.pixelScale = this.pixelScale < 1 ? 1 : 0.5;
    this.resize();
  }

  resize(): void {
    this.gl.setPixelRatio(this.pixelScale * Math.min(2, window.devicePixelRatio));
    this.gl.setSize(window.innerWidth, window.innerHeight);
    this.rig.resize(window.innerWidth, window.innerHeight);
  }
}
