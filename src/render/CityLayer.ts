import * as THREE from 'three';
import type { Rect } from '../core/math';
import type { BuildingDef, PropDef } from '../sim/map';
import { groundJob, GROUND_PX } from './procgen/ground';
import { buildCity } from './procgen/buildings';
import { drawDecor, makeCar, scatterDecor, makePumpIsland, drawCanopy, makeBorder, type DecorPlacement } from './procgen/props';
import { Batch } from './procgen/batch';
import { models } from './ModelLibrary';
import { PAL } from './palette';
import type { RenderCtx } from './context';

/** Numbered model variants the manifest lists (car1, car2…, tree1…, shrub1…), in order. */
const variantCache = new Map<string, string[]>();
function variants(base: string): string[] {
  let v = variantCache.get(base);
  if (!v) {
    v = [];
    for (let i = 1; models.has(`${base}${i}`); i++) v.push(`${base}${i}`);
    variantCache.set(base, v);
  }
  return v;
}
const carKinds = () => variants('car');

/** Round 16 #193: the car pack's colours toned down (share of grey mixed in, then brightness). */
const CAR_TONE = { desaturate: 0.3, brightness: 0.85 };
const toned = new WeakSet<THREE.BufferGeometry>();
/** Tone a car model's colours once (its geometry is shared by every car of that model). */
function dullCar(model: THREE.Object3D): void {
  model.traverse((o) => {
    const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    const col = g?.attributes.color as THREE.BufferAttribute | undefined;
    if (!g || !col || toned.has(g)) return;
    toned.add(g);
    for (let i = 0; i < col.count; i++) {
      const r = col.getX(i), gg = col.getY(i), b = col.getZ(i);
      const lum = 0.299 * r + 0.587 * gg + 0.114 * b;
      const k = CAR_TONE.desaturate, s = CAR_TONE.brightness;
      col.setXYZ(i, (r + (lum - r) * k) * s, (gg + (lum - gg) * k) * s, (b + (lum - b) * k) * s);
    }
    col.needsUpdate = true;
  });
}

/** Chunk size (metres): 64 nav cells. STATUS #14, v4.46. */
const CHUNK = 192;
/** Ground texels per metre far away / on the ops map (full detail is GROUND_PX). */
const LOW_PX = 1;
/** Keep at most this many chunks at full detail, and with their buildings and props built. */
const MAX_FULL = 16;
const MAX_CONTENT = 30;
/** Milliseconds per frame for painting ground once the first view is up. */
const PAINT_MS = 4;

type Occluder = { mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; box: THREE.Box3; opacity: number };

/** One square of the city: its ground (at no / low / full detail) and, once near, its buildings and props. */
interface Chunk {
  rect: Rect;
  ground: THREE.Mesh;
  lod: 0 | 1 | 2;
  job: { lod: 1 | 2; step: (ms: number) => boolean; canvas: HTMLCanvasElement } | null;
  content: THREE.Group | null;
  occluders: Occluder[];
  buildings: BuildingDef[];
  decor: DecorPlacement[];
  props: PropDef[];
  canopies: Rect[];
  seen: number;
}

/**
 * The city itself: ground, buildings, street props, cars, gas-station canopies, the fences around
 * regions that haven't opened, and the per-district tint overlays. STATUS #14 (v4.46): the city comes in
 * 192 m chunks that build as the camera nears them (ground first at low detail, then full; then the
 * buildings and props) and are let go again, past a budget, when far away. A map of any size then costs
 * only what's around the camera, and no single texture has to hold the whole city. Per frame it also
 * fades buildings that hide units and retints the districts.
 */
export class CityLayer {
  private chunks: Chunk[] = [];
  private frame = 0;
  /** Chunks near the camera still waiting for their ground or buildings (0 = everything in view is done). */
  pending = 0;
  private fences = new Map<string, THREE.Object3D>();
  private districtOverlays = new Map<string, THREE.Mesh>();
  private districtLabels = new Map<string, HTMLDivElement>();

  constructor(private ctx: RenderCtx) {
    const { scene, world } = ctx;
    const m = world.map;

    const apron = new THREE.Mesh(new THREE.PlaneGeometry(m.width + 240, m.height + 240), new THREE.MeshLambertMaterial({ color: 0x4a4436 }));
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(m.width / 2, -0.02, m.height / 2);
    apron.receiveShadow = true;
    scene.add(apron);

    // the chunk grid, each with a plain ground plane until its texture is painted
    const nx = Math.ceil(m.width / CHUNK);
    const ny = Math.ceil(m.height / CHUNK);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const rect = { x: i * CHUNK, y: j * CHUNK, w: Math.min(CHUNK, m.width - i * CHUNK), h: Math.min(CHUNK, m.height - j * CHUNK) };
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(rect.w, rect.h), new THREE.MeshLambertMaterial({ color: 0x6c6048 }));
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(rect.x + rect.w / 2, 0, rect.y + rect.h / 2);
        ground.receiveShadow = true;
        scene.add(ground);
        this.chunks.push({ rect, ground, lod: 0, job: null, content: null, occluders: [], buildings: [], decor: [], props: [], canopies: [], seen: 0 });
      }
    const chunkAt = (x: number, y: number) => this.chunks[Math.min(ny - 1, Math.max(0, Math.floor(y / CHUNK))) * nx + Math.min(nx - 1, Math.max(0, Math.floor(x / CHUNK)))];
    for (const b of m.buildings) chunkAt(b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h / 2).buildings.push(b);
    for (const d of scatterDecor(m, world.grid)) chunkAt(d.x, d.z).decor.push(d);
    for (const p of m.props) chunkAt(p.pos.x, p.pos.y).props.push(p);
    for (const r of m.canopies) chunkAt(r.x + r.w / 2, r.y + r.h / 2).canopies.push(r);

    // the first view is built straight away, in full; the rest streams in as the camera moves
    this.stream(Infinity);

    for (const d of m.districts) {
      if (!world.districts.get(d.id)?.locked || !d.borders) continue; // (a loaded game may have opened it)
      const fence = new THREE.Group();
      for (const b of d.borders) fence.add(makeBorder(m, b));
      scene.add(fence);
      this.fences.set(d.id, fence);
    }

    for (const d of m.districts) {
      if (d.id === 'base') continue;
      const ov = new THREE.Mesh(
        new THREE.PlaneGeometry(d.rect.w, d.rect.h),
        new THREE.MeshBasicMaterial({ color: PAL.infest, transparent: true, opacity: 0.2, depthWrite: false }),
      );
      ov.rotation.x = -Math.PI / 2;
      ov.position.set(d.rect.x + d.rect.w / 2, 0.06, d.rect.y + d.rect.h / 2);
      scene.add(ov);
      this.districtOverlays.set(d.id, ov);
      this.districtLabels.set(d.id, ctx.labels.make(ctx.overlay, 'district-label'));
    }
  }

  /** Every frame: build what the camera is near (within the paint budget), let go of what's far past the budget. */
  update(): void {
    // the first frame builds the whole view at once (the camera has moved to the base by then)
    this.stream(this.frame <= 1 ? Infinity : PAINT_MS);
  }

  private stream(budgetMs: number): void {
    const { rig } = this.ctx;
    this.frame++;
    const t = rig.target;
    const reach = rig.viewRadius;
    const near = (c: Chunk, extra: number) => {
      const dx = Math.max(c.rect.x - t.x, 0, t.x - (c.rect.x + c.rect.w));
      const dz = Math.max(c.rect.y - t.z, 0, t.z - (c.rect.y + c.rect.h));
      return Math.hypot(dx, dz) <= reach + extra;
    };
    const dist = (c: Chunk) => Math.hypot(c.rect.x + c.rect.w / 2 - t.x, c.rect.y + c.rect.h / 2 - t.z);
    const order = [...this.chunks].sort((a, b) => dist(a) - dist(b));
    const want = rig.strategic ? 1 : 2;
    const t0 = performance.now();
    const left = () => budgetMs - (performance.now() - t0);
    this.pending = 0;
    for (const c of order) {
      const inView = near(c, 0);
      const soon = near(c, CHUNK * 0.75); // one step ahead of the camera
      if (inView || soon) c.seen = this.frame;
      // buildings and props first when a chunk comes near (cheap), then its ground
      if (soon && !c.content && left() > 0) this.buildContent(c);
      // near chunks get the camera's level of detail too (nearest first, within the budget); anything
      // without a texture gets the quick low-detail one at once so the ground is never blank
      const goal: 0 | 1 | 2 = inView || soon ? want : 0;
      if (goal >= 1 && c.lod === 0) {
        const job = groundJob(this.ctx.world.map, c.rect, LOW_PX);
        job.step(Infinity);
        this.setGround(c, job.canvas, 1);
      }
      if (goal > c.lod && left() > 0) {
        if (!c.job || c.job.lod < goal) {
          const P = goal === 2 ? GROUND_PX : LOW_PX;
          const job = groundJob(this.ctx.world.map, c.rect, P);
          c.job = { lod: goal as 1 | 2, ...job };
        }
        // low detail is quick: always finish it; full detail paints within the budget
        if (c.job.step(c.job.lod === 1 ? Infinity : Math.max(1, left()))) {
          this.setGround(c, c.job.canvas, c.job.lod);
          c.job = null;
        }
      }
      if (goal > c.lod || (soon && !c.content)) this.pending++;
    }
    // over budget: the chunks seen longest ago drop back to low detail, then lose their buildings
    const full = this.chunks.filter((c) => c.lod === 2).sort((a, b) => a.seen - b.seen);
    for (const c of full.slice(0, Math.max(0, full.length - MAX_FULL))) if (c.seen < this.frame) this.dropGround(c);
    const built = this.chunks.filter((c) => c.content).sort((a, b) => a.seen - b.seen);
    for (const c of built.slice(0, Math.max(0, built.length - MAX_CONTENT))) if (c.seen < this.frame) this.dropContent(c);
  }

  private setGround(c: Chunk, canvas: HTMLCanvasElement, lod: 1 | 2): void {
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const mat = c.ground.material as THREE.MeshLambertMaterial;
    mat.map?.dispose();
    mat.map = tex;
    mat.color.set(0xffffff);
    mat.needsUpdate = true;
    c.lod = lod;
  }

  /** Back to low detail (a far chunk over the budget): repaint small, free the big texture. */
  private dropGround(c: Chunk): void {
    const job = groundJob(this.ctx.world.map, c.rect, LOW_PX);
    job.step(Infinity);
    this.setGround(c, job.canvas, 1);
  }

  /** A chunk's buildings, street decor, cars, pumps and canopies. */
  private buildContent(c: Chunk): void {
    const { world } = this.ctx;
    const m = world.map;
    const grp = new THREE.Group();
    const treeKinds = variants('tree');
    const plant = (x: number, z: number, scale: number, seed: number) => {
      const t = models.instance(treeKinds[Math.abs(seed) % treeKinds.length]);
      if (!t) return;
      t.position.set(x, 0, z);
      t.rotation.y += (seed % 628) / 100;
      t.scale.multiplyScalar(scale);
      t.userData.shared = true;
      grp.add(t);
    };
    buildCity(
      m,
      (b, batch, trees) => {
        const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
        const mesh = batch.build(mat);
        grp.add(mesh);
        // v4.59: the yard trees are the owner's tree models too
        for (const t of trees) plant(t.x, t.z, t.scale, Math.floor(t.x * 131 + t.z * 977));
        // STATUS #50: a hospital gets a white roof panel with a red cross, readable from above
        if (b.landmark === 'hospital') {
          const cx = b.rect.x + b.rect.w / 2;
          const cz = b.rect.y + b.rect.h / 2;
          const side = Math.min(b.rect.w, b.rect.h) * 0.6;
          const y = b.floors * 3.2 + 0.06; // round 16 #197: on the roof (an apartment's roof is floors × 3.2 m; its height adds the parapet)
          const panel = new THREE.Mesh(new THREE.BoxGeometry(side, 0.12, side), new THREE.MeshLambertMaterial({ color: 0xf2efe6 }));
          panel.position.set(cx, y, cz);
          grp.add(panel);
          for (const [sx, sz] of [[0.62, 0.2], [0.2, 0.62]]) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(side * sx, 0.14, side * sz), new THREE.MeshLambertMaterial({ color: 0xc8302a }));
            bar.position.set(cx, y + 0.05, cz);
            grp.add(bar);
          }
        }
        const top = b.height + (b.kind === 'houses' ? 4 : b.kind === 'apartment' ? 4 : 2.5); // roofs, tanks, signs
        c.occluders.push({ mesh, mat, box: new THREE.Box3(new THREE.Vector3(b.rect.x, 0, b.rect.y), new THREE.Vector3(b.rect.x + b.rect.w, top, b.rect.y + b.rect.h)), opacity: 1 });
      },
      c.buildings,
      treeKinds.length > 0,
    );
    const decor = new Batch();
    for (const d of c.decor) {
      // v4.58: trees and shrubs from the owner's tree packs (tree1…, shrub1…), one per spot by its seed;
      // v4.59: palms too (the packs have none), so no procedural tree is left once the models load
      const vs = variants(d.kind === 'palm' ? 'tree' : d.kind);
      const model = models.instance(vs.length ? vs[Math.abs(d.seed) % vs.length] : d.kind);
      if (model) {
        model.position.set(d.x, 0, d.z);
        model.rotation.y += -d.ry;
        model.scale.multiplyScalar(d.scale);
        model.userData.shared = true; // geometry and materials belong to the model library
        grp.add(model);
      } else drawDecor(decor, d);
    }
    if (c.decor.length) grp.add(decor.build());
    for (const r of c.canopies) {
      const cb = new Batch();
      drawCanopy(cb, r);
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
      const mesh = cb.build(mat);
      grp.add(mesh);
      c.occluders.push({ mesh, mat, box: new THREE.Box3(new THREE.Vector3(r.x, 0, r.y), new THREE.Vector3(r.x + r.w, 6, r.y + r.h)), opacity: 1 });
    }
    for (const p of c.props) {
      if (p.kind === 'pump') {
        grp.add(makePumpIsland(p));
        continue;
      }
      // v4.56: the owner's car pack (car1…car10 in the model manifest); each car picks one by its id,
      // and half face the other way
      const kinds = carKinds();
      const model = models.instance(kinds.length ? kinds[p.id % kinds.length] : 'car');
      if (model) {
        dullCar(model);
        model.position.set(p.pos.x, 0, p.pos.y);
        model.rotation.y += (p.h > p.w ? Math.PI / 2 : 0) + ((p.id % 7) - 3) * 0.05 + (Math.floor(p.id / 3) % 2 ? Math.PI : 0);
        model.userData.shared = true;
        grp.add(model);
      } else grp.add(makeCar(p));
    }
    this.ctx.scene.add(grp);
    c.content = grp;
  }

  private dropContent(c: Chunk): void {
    if (!c.content) return;
    this.ctx.scene.remove(c.content);
    c.content.traverse((o) => {
      if (o.userData.shared) return;
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mt of mats) mt.dispose();
      }
    });
    c.content = null;
    c.occluders = [];
  }

  /** How many chunks there are and how many are built (for checks and the dev tools). */
  get chunkStats(): { chunks: number; full: number; low: number; content: number } {
    return { chunks: this.chunks.length, full: this.chunks.filter((c) => c.lod === 2).length, low: this.chunks.filter((c) => c.lod === 1).length, content: this.chunks.filter((c) => c.content).length };
  }

  /** A region opened: its fence comes down. Returns the fence lines (for the dust), or nothing if it had none. */
  removeFence(districtId: string): Rect[] {
    const fence = this.fences.get(districtId);
    if (!fence) return [];
    this.ctx.scene.remove(fence);
    this.fences.delete(districtId);
    return this.ctx.world.districts.get(districtId)?.def.borders ?? [];
  }

  /** District overlays (infestation → red tint) and their ops-map labels. */
  updateDistricts(): void {
    const { world: w, rig, labels } = this.ctx;
    for (const [id, ov] of this.districtOverlays) {
      const d = w.districts.get(id)!;
      const mat = ov.material as THREE.MeshBasicMaterial;
      // a faint tint at street level (keep the asphalt grey), a clear read on the ops map
      const k = rig.strategic ? 1 : 0.25;
      if (d.locked) {
        // not open yet: dimmed, so the playable area reads clearly
        mat.opacity = rig.strategic ? 0.55 : 0.5;
        mat.color.set(0x111316);
      } else {
        mat.opacity = (d.secured ? 0.07 : 0.04 + (d.infestation / 100) * 0.26) * k;
        mat.color.set(d.secured ? 0x5d8a4a : PAL.infest);
      }
      const lab = this.districtLabels.get(id)!;
      lab.style.display = rig.strategic ? 'block' : 'none';
      if (rig.strategic)
        labels.place(lab, { x: d.def.rect.x + d.def.rect.w / 2, y: d.def.rect.y + d.def.rect.h / 2 }, 0, () =>
          `<div class="dname">${d.def.name}</div><div>${d.locked ? 'RESTRICTED · opens when the previous region is secured' : d.secured ? 'SECURED' : `${Math.ceil(d.infestation)}% infested`}</div>`,
        );
    }
  }

  /**
   * See-through buildings (v4.5 next-step 1): any building between the camera and one of your
   * squads (or a hive / a structure under construction) fades to a ghost so you never lose units
   * behind a block. Analytic ray-vs-box per building, so it costs nothing.
   */
  fadeOccluders(dt: number): void {
    const { world: w, rig } = this.ctx;
    const toCam = new THREE.Vector3();
    rig.camera.getWorldDirection(toCam).negate();
    const points: THREE.Vector3[] = [];
    for (const s of w.squads) if (s.alive) points.push(new THREE.Vector3(s.pos.x, 1, s.pos.y));
    for (const st of w.structures) if (st.alive && !st.built) points.push(new THREE.Vector3(st.pos.x, 0.8, st.pos.y));
    for (const h of w.hives) if (h.alive) points.push(new THREE.Vector3(h.pos.x, 1.5, h.pos.y));
    const ray = new THREE.Ray();
    const k = 1 - Math.exp(-10 * dt);
    for (const b of this.chunks.flatMap((c) => c.occluders)) {
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
}
