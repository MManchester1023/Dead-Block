import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HUMAN_HEIGHT } from '../config/world';

/**
 * Animated characters for crowds of thousands (doc §14 v4.1 crowd tech).
 *
 * Skinned meshes with one AnimationMixer each don't scale past a couple of hundred. Instead every
 * animation is sampled at load time into a handful of frozen poses ("flipbook" frames). Each pose
 * becomes one InstancedMesh, and every character currently in that pose is one instance of it.
 * Draw calls = number of poses in use, no matter if it's 50 zombies or 2,000.
 *
 * Models (CREDITS.md): soldiers/engineers = "Military RTS Character 1" rigged on Mixamo with Mixamo
 * animations (v4.18); main zombie = pxltiger's "Zombie"; female zombie = jeferson's "female zombie"
 * rigged on Mixamo with Mixamo zombie animations (v4.18). Material colours are
 * baked into vertex colours so each pose is a single draw call (the source meshes have ~120 groups).
 */

export type Clip = 'idle' | 'walk' | 'run' | 'shoot' | 'punch' | 'death' | 'work';

// v4.9 (round 4 #33): roughly twice the poses per clip, so limbs no longer snap between few frames
const CLIP_SOURCES: Record<Clip, { name: string; frames: number; loop: boolean }> = {
  idle: { name: 'Idle', frames: 12, loop: true },
  walk: { name: 'Walk', frames: 20, loop: true },
  run: { name: 'Run', frames: 14, loop: true },
  shoot: { name: 'Shoot_OneHanded', frames: 8, loop: true },
  punch: { name: 'Punch', frames: 10, loop: true },
  death: { name: 'Defeat', frames: 14, loop: false },
  work: { name: 'PickUp', frames: 10, loop: true },
};

export interface CharacterSpec {
  key: string;
  url: string;
  clips: Clip[];
  /** Material-name → colour overrides (the source colours are very dark in places). */
  recolor?: Record<string, number>;
  rifle?: boolean;
  /** Extra scale on top of the 1.8 m normalisation (x/z, y). */
  girth?: number;
  height?: number;
  /** Vertex-clustering cell size in metres (crowd LOD); omit to keep full detail. */
  simplify?: number;
  /** Colour steps per channel that the clustering keeps apart (default 8; lower = fewer triangles). */
  simplifyColors?: number;
  /** Animation names in this file, where they differ from the Quaternius names above. */
  clipNames?: Partial<Record<Clip, string>>;
  /** True if the death clip ends lying on the ground; otherwise the corpse is tipped over (#34). */
  deathFalls?: boolean;
  /** v4.18 (Mixamo): each clip from its own animation file, applied to this model's skeleton by bone name. */
  clipFiles?: Partial<Record<Clip, string>>;
  /** Base-colour texture to bake into vertex colours when the model file doesn't embed one. */
  texture?: string;
  /** Bone the procedural rifle is held in (default: Quaternius 'FistR'). */
  rifleBone?: string;
  /** A real rifle model (glTF) instead of the box rifle (v4.18). */
  rifleModel?: string;
  /** Rifle orientation fix-up in the hand bone's frame (Euler, radians). */
  rifleRot?: [number, number, number];
  /** Pin the hips' horizontal position (Mixamo clips downloaded without "In Place" walk forward). */
  inPlace?: boolean;
  /** Multiply every baked colour (e.g. engineers: a warmer, dustier version of the same soldier). */
  tint?: number;
  /** Clips baked as a single held pose at this fraction of the clip (e.g. an idle from a firing clip). */
  clipHold?: Partial<Record<Clip, number>>;
  /** Per-mesh base-colour textures, by skinned-mesh name (Mixamo drops material names and textures). */
  textureByMesh?: Record<string, string>;
  /** Per-mesh flat colours, by skinned-mesh name (eyes, lashes…). */
  colorByMesh?: Record<string, number>;
}

export interface Flipbook {
  key: string;
  deathFalls: boolean;
  frames: Record<string, THREE.BufferGeometry[]>;
  durations: Record<string, number>;
  loops: Record<string, boolean>;
}

/** Load, normalise to metres facing +X, and bake every requested clip into frames. */
export async function bakeCharacter(spec: CharacterSpec): Promise<Flipbook> {
  let obj: THREE.Object3D;
  if (/\.glb$|\.gltf$/i.test(spec.url)) {
    const gltf = await new GLTFLoader().loadAsync(spec.url);
    obj = gltf.scene;
    obj.animations = gltf.animations;
  } else obj = await new FBXLoader().loadAsync(spec.url);
  obj.updateMatrixWorld(true);
  // separate animation files (Mixamo) and an external texture, loaded alongside the model
  const fileClips: Partial<Record<Clip, THREE.AnimationClip>> = {};
  /** Rest height of the hips in each animation file's own skeleton (its units can differ from the model's). */
  const fileHipsY: Partial<Record<Clip, number>> = {};
  if (spec.clipFiles) {
    const fbx = new FBXLoader();
    await Promise.all(
      Object.entries(spec.clipFiles).map(async ([clip, url]) => {
        const a = await fbx.loadAsync(url!);
        if (a.animations[0]) fileClips[clip as Clip] = a.animations[0];
        a.traverse((o) => {
          if ((o as THREE.Bone).isBone && /hips$/i.test(o.name) && fileHipsY[clip as Clip] === undefined) fileHipsY[clip as Clip] = o.position.y;
        });
      }),
    );
  }
  const extTex = spec.texture ? await new THREE.TextureLoader().loadAsync(spec.texture) : null;
  const meshTex: Record<string, THREE.Texture> = {};
  for (const [mesh, url] of Object.entries(spec.textureByMesh ?? {})) meshTex[mesh] = await new THREE.TextureLoader().loadAsync(url);

  // every skinned part (Quaternius files are one mesh; Sketchfab exports are often split per limb)
  const parts: THREE.SkinnedMesh[] = [];
  obj.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) parts.push(o as THREE.SkinnedMesh);
  });
  if (!parts.length) throw new Error(`${spec.key}: no skinned mesh`);
  const offsets: number[] = [];
  let n = 0;
  for (const sk of parts) {
    offsets.push(n);
    n += sk.geometry.attributes.position.count;
  }

  // per-vertex colour from the material groups, and one merged index for all parts
  const colors = new Float32Array(n * 3);
  const merged: number[] = [];
  const c = new THREE.Color();
  parts.forEach((sk, pi) => {
    const base = sk.geometry;
    const off = offsets[pi];
    const pn = base.attributes.position.count;
    const mats = (Array.isArray(sk.material) ? sk.material : [sk.material]) as (THREE.MeshPhongMaterial | THREE.MeshStandardMaterial)[];
    const uv = base.attributes.uv as THREE.BufferAttribute | undefined;
    const idx = base.index;
    for (const g of base.groups.length ? base.groups : [{ start: 0, count: idx ? idx.count : pn, materialIndex: 0 }]) {
      const m = mats[g.materialIndex ?? 0];
      const over = spec.recolor?.[m.name];
      if (over !== undefined) c.set(over);
      else c.copy(m.color);
      // textured models (the Sketchfab glTFs): bake the texture colour at each vertex's UV
      const flat = spec.colorByMesh?.[sk.name];
      const map = meshTex[sk.name] ?? extTex ?? m.map;
      const tex = over === undefined && flat === undefined && map && uv ? texSampler(map) : null;
      if (flat !== undefined) c.set(flat);
      for (let i = g.start; i < g.start + g.count; i++) {
        const v = idx ? idx.getX(i) : i;
        merged.push(v + off);
        if (tex) {
          tex(uv!.getX(v), uv!.getY(v), c);
          if (!extTex && !meshTex[sk.name]) c.multiply(m.color);
        }
        if (spec.tint !== undefined) c.multiply(new THREE.Color(spec.tint));
        colors[(v + off) * 3] = c.r;
        colors[(v + off) * 3 + 1] = c.g;
        colors[(v + off) * 3 + 2] = c.b;
      }
    }
  });
  const mergedIndex = new THREE.BufferAttribute(n > 65535 ? new Uint32Array(merged) : new Uint16Array(merged), 1);

  /** Current skinned pose of every vertex, in world space, into `out` (optionally normalised). */
  const v = new THREE.Vector3();
  const pose = (out: Float32Array | null, onPoint?: (p: THREE.Vector3) => void, m?: THREE.Matrix4) => {
    parts.forEach((sk, pi) => {
      sk.skeleton.update();
      const P = sk.geometry.attributes.position as THREE.BufferAttribute;
      const off = offsets[pi];
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i);
        sk.applyBoneTransform(i, v);
        v.applyMatrix4(sk.matrixWorld);
        if (m) v.applyMatrix4(m);
        if (onPoint) onPoint(v);
        if (out) {
          out[(off + i) * 3] = v.x;
          out[(off + i) * 3 + 1] = v.y;
          out[(off + i) * 3 + 2] = v.z;
        }
      }
    });
  };

  // normalisation: feet on y=0, 1.8 m tall, facing +X (models face +Z). Measured on the skinned
  // vertices themselves: Sketchfab exports carry unit-scale / axis-flip nodes that fool Box3.setFromObject.
  const bbox = new THREE.Box3();
  pose(null, (p) => bbox.expandByPoint(p));
  const srcH = bbox.max.y - bbox.min.y;
  const s = (HUMAN_HEIGHT * (spec.height ?? 1)) / srcH;
  const norm = new THREE.Matrix4()
    .makeRotationY(Math.PI / 2)
    .multiply(new THREE.Matrix4().makeScale(s * (spec.girth ?? 1), s, s * (spec.girth ?? 1)))
    .multiply(new THREE.Matrix4().makeTranslation(-(bbox.min.x + bbox.max.x) / 2, -bbox.min.y, -(bbox.min.z + bbox.max.z) / 2));

  const mixer = new THREE.AnimationMixer(obj);
  const fist = spec.rifle ? obj.getObjectByName(spec.rifleBone ?? 'FistR') : undefined;
  // Mixamo hips: pin x/z to the rest position so a walk that travels forward loops in place
  let hips: THREE.Object3D | undefined;
  obj.traverse((o) => {
    if (!hips && (o as THREE.Bone).isBone && /hips$/i.test(o.name)) hips = o;
  });
  const hipsRest = hips ? hips.position.clone() : null;
  const rifle = spec.rifle ? (spec.rifleModel ? await loadRifleModel(spec.rifleModel) : rifleGeometry(1)) : undefined; // built in metres

  const book: Flipbook = { key: spec.key, deathFalls: !!spec.deathFalls, frames: {}, durations: {}, loops: {} };
  // round 4 #33: one simplification plan (made from the first pose) is reused for every frame, so the
  // decimated mesh is identical frame to frame instead of shimmering
  let plan: ClusterPlan | null = null;
  for (const clip of spec.clips) {
    const src = { ...CLIP_SOURCES[clip], name: spec.clipNames?.[clip] ?? CLIP_SOURCES[clip].name };
    const anim = fileClips[clip] ?? obj.animations.find((a) => a.name.endsWith('|' + src.name) || a.name === src.name);
    if (!anim) continue;
    mixer.stopAllAction();
    const action = mixer.clipAction(anim);
    action.reset().play();
    const frames: THREE.BufferGeometry[] = [];
    const hold = spec.clipHold?.[clip];
    for (let f = 0; f < (hold !== undefined ? 1 : src.frames); f++) {
      const t = hold !== undefined ? hold * anim.duration : src.loop ? (f / src.frames) * anim.duration : (f / (src.frames - 1)) * anim.duration * 0.999;
      mixer.setTime(t);
      if (spec.inPlace && hips && hipsRest) {
        hips.position.x = hipsRest.x;
        hips.position.z = hipsRest.z;
        // the clip's hip height is in its own skeleton's units: rescale to this model's
        const fy = fileHipsY[clip];
        if (fy) hips.position.y = hipsRest.y * (hips.position.y / fy);
      }
      obj.updateMatrixWorld(true);
      const pos = new Float32Array(n * 3);
      pose(pos, undefined, norm);
      let g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      g.setIndex(mergedIndex);
      if (rifle && fist && clip !== 'work') { // hands are busy while working
        // place the rifle by the hand's position + orientation only (the bone matrix also carries the
        // FBX unit scale, which would make the gun ~100x too big)
        const hp = new THREE.Vector3();
        const hq = new THREE.Quaternion();
        fist.matrixWorld.decompose(hp, hq, new THREE.Vector3());
        hp.applyMatrix4(norm);
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2).multiply(hq);
        if (spec.rifleRot) q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...spec.rifleRot)));
        const r = rifle.clone().applyMatrix4(new THREE.Matrix4().compose(hp, q, new THREE.Vector3(1, 1, 1)));
        g = mergeSimple(g, r);
      }
      if (spec.simplify) {
        plan ??= makeClusterPlan(g, spec.simplify, spec.simplifyColors ?? 8);
        g = applyClusterPlan(plan, g);
      }
      g.computeVertexNormals();
      g.computeBoundingSphere();
      frames.push(g);
    }
    book.frames[clip] = frames;
    book.durations[clip] = anim.duration;
    book.loops[clip] = src.loop;
  }
  mixer.stopAllAction();
  return book;
}

const rifleCache = new Map<string, Promise<THREE.BufferGeometry>>();

/**
 * A rifle model (v4.18: "Low-poly M4 assault rifle" by szaw, CC-BY 4.0) in the same frame as the box rifle:
 * metres, muzzle along +Y, magazine down (-Z), the pistol grip at the origin (that's where the hand is).
 * The source mesh has the barrel on +X and the magazine on -Z; parts are coloured by their materials.
 */
function loadRifleModel(url: string): Promise<THREE.BufferGeometry> {
  let p = rifleCache.get(url);
  if (!p) {
    p = (async () => {
      const gltf = await new GLTFLoader().loadAsync(url);
      const parts: THREE.BufferGeometry[] = [];
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        const col = (m.material as THREE.MeshStandardMaterial).color ?? new THREE.Color(0x222222);
        const c = col.clone().lerp(new THREE.Color(0x3a3a38), 0.35); // near-black PBR colours read better lifted a little
        const n = g.attributes.position.count;
        const colors = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
        const out = new THREE.BufferGeometry();
        out.setAttribute('position', g.attributes.position.clone()); // raw mesh space (all parts share one parent)
        out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        parts.push(out);
      });
      let geo = parts.reduce((a, b) => mergeSimple(a, b));
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      const len = bb.max.x - bb.min.x;
      const s = 0.84 / len; // an M4 is ~84 cm long
      // pistol grip: a bit behind the magazine well, below the receiver
      const gripX = bb.min.x + len * 0.33;
      const gripZ = bb.min.z + (bb.max.z - bb.min.z) * 0.45;
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = (pos.getX(i) - gripX) * s;
        const y = pos.getY(i) * s;
        const z = (pos.getZ(i) - gripZ) * s;
        pos.setXYZ(i, -y, x, z); // barrel +X → +Y, keep -Z down (a proper rotation)
      }
      pos.needsUpdate = true;
      // crowd LOD: ~6k triangles is a lot to carry in every soldier's hands
      const plan = makeClusterPlan(geo, 0.012, 6);
      geo = applyClusterPlan(plan, geo);
      geo.deleteAttribute('normal');
      return geo;
    })();
    rifleCache.set(url, p);
  }
  return p;
}

/** A simple rifle in the hand bone's local space (bone units = 1/s metres). Points along the bone's +Y. */
function rifleGeometry(unitsPerMetre: number): THREE.BufferGeometry {
  const u = unitsPerMetre;
  const parts: [number, number, number, number, number, number, number][] = [
    // w, h, d, x, y, z, colour
    [0.07, 0.75, 0.09, 0, 0.18, 0.06, 0x1e1e1e], // receiver + barrel, along +Y
    [0.05, 0.16, 0.08, 0, -0.02, -0.05, 0x2a2a2a], // magazine
    [0.06, 0.22, 0.07, 0, -0.22, 0.03, 0x3a3226], // stock
  ];
  const geos = parts.map(([w, h, d, x, y, z, col]) => {
    const b = new THREE.BoxGeometry(w * u, h * u, d * u).toNonIndexed();
    b.translate(x * u, y * u, z * u);
    const cc = new THREE.Color(col);
    const arr = new Float32Array(b.attributes.position.count * 3);
    for (let i = 0; i < b.attributes.position.count; i++) arr.set([cc.r, cc.g, cc.b], i * 3);
    b.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    b.deleteAttribute('normal');
    b.deleteAttribute('uv');
    return b;
  });
  return geos.reduce((a, b) => mergeSimple(a, b));
}

/** Reads a texture's pixels once; returns a sampler (u, v) → colour (sRGB → linear). */
function texSampler(tex: THREE.Texture): ((u: number, v: number, out: THREE.Color) => void) | null {
  const img = tex.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!img || !img.width) return null;
  const w = Math.min(512, img.width);
  const h = Math.min(512, img.height);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  return (u, v, out) => {
    u = u - Math.floor(u);
    v = v - Math.floor(v);
    const x = Math.min(w - 1, Math.floor(u * w));
    const y = Math.min(h - 1, Math.floor((tex.flipY ? 1 - v : v) * h));
    const i = (y * w + x) * 4;
    out.setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, THREE.SRGBColorSpace);
  };
}

/**
 * Vertex-clustering decimation: snap vertices to a grid of `cell` metres, merge everything in a cell,
 * drop collapsed triangles. Crude but O(n) and invisible at crowd distance; turns ~4–10k-triangle
 * characters into ~1–2k so thousands of zombies stay affordable on the GPU.
 *
 * The clustering is decided once, on a reference pose (makeClusterPlan), then applied to every
 * animation frame (applyClusterPlan): each frame then has exactly the same triangles, which is what
 * stops the "shimmering limbs" of re-simplifying every pose independently.
 */
interface ClusterPlan {
  remap: Int32Array;
  clusters: number;
  counts: Float32Array;
  index: number[];
  colors: Float32Array;
}

function makeClusterPlan(g: THREE.BufferGeometry, cell: number, colorSteps = 8): ClusterPlan {
  const pos = g.attributes.position.array as Float32Array;
  const col = g.attributes.color.array as Float32Array;
  const idx = g.index ? (g.index.array as ArrayLike<number>) : null;
  const triCount = (idx ? idx.length : pos.length / 3) / 3;
  const map = new Map<string, number>();
  const cols: number[] = [];
  const counts: number[] = [];
  const remap = new Int32Array(pos.length / 3);
  for (let v = 0; v < pos.length / 3; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    // keep colours apart so faces/eyes don't smear into skin
    const key = `${Math.round(x / cell)},${Math.round(y / cell)},${Math.round(z / cell)},${Math.round(col[v * 3] * colorSteps)},${Math.round(col[v * 3 + 1] * colorSteps)}`;
    let id = map.get(key);
    if (id === undefined) {
      id = counts.length;
      map.set(key, id);
      cols.push(col[v * 3], col[v * 3 + 1], col[v * 3 + 2]);
      counts.push(0);
    }
    counts[id]++;
    remap[v] = id;
  }
  const index: number[] = [];
  for (let t = 0; t < triCount; t++) {
    const a = remap[idx ? idx[t * 3] : t * 3];
    const b = remap[idx ? idx[t * 3 + 1] : t * 3 + 1];
    const c = remap[idx ? idx[t * 3 + 2] : t * 3 + 2];
    if (a !== b && b !== c && a !== c) index.push(a, b, c);
  }
  return { remap, clusters: counts.length, counts: new Float32Array(counts), index, colors: new Float32Array(cols) };
}

function applyClusterPlan(plan: ClusterPlan, g: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = g.attributes.position.array as Float32Array;
  const P = new Float32Array(plan.clusters * 3);
  for (let v = 0; v < plan.remap.length; v++) {
    const id = plan.remap[v];
    P[id * 3] += pos[v * 3];
    P[id * 3 + 1] += pos[v * 3 + 1];
    P[id * 3 + 2] += pos[v * 3 + 2];
  }
  for (let i = 0; i < plan.clusters; i++) {
    const k = 1 / plan.counts[i];
    P[i * 3] *= k;
    P[i * 3 + 1] *= k;
    P[i * 3 + 2] *= k;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('color', new THREE.BufferAttribute(plan.colors, 3));
  out.setIndex(plan.index);
  return out.toNonIndexed(); // flat-shaded facets suit the stylised look
}

/** Merge two geometries with position+color (index-free result). */
function mergeSimple(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const A = a.index ? a.toNonIndexed() : a;
  const B = b.index ? b.toNonIndexed() : b;
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'color']) {
    const x = A.attributes[name].array as Float32Array;
    const y = B.attributes[name].array as Float32Array;
    const z = new Float32Array(x.length + y.length);
    z.set(x);
    z.set(y, x.length);
    out.setAttribute(name, new THREE.BufferAttribute(z, 3));
  }
  return out;
}

/**
 * One InstancedMesh per (clip, frame). Each render frame: begin(), add() every character, end().
 */
export class Crowd {
  private meshes: Record<string, THREE.InstancedMesh[]> = {};
  private counts: Record<string, number[]> = {};
  private tmp = new THREE.Object3D();
  private col = new THREE.Color();
  readonly group = new THREE.Group();

  /** Above this many instances the crowd stops casting shadows (shadows double the triangle cost). */
  shadowLimit = Infinity;

  constructor(readonly book: Flipbook, readonly capacity: number) {
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    for (const [clip, frames] of Object.entries(book.frames)) {
      this.meshes[clip] = frames.map((geo) => {
        const m = new THREE.InstancedMesh(geo, mat, capacity);
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
        m.count = 0;
        m.visible = false;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.group.add(m);
        return m;
      });
      this.counts[clip] = frames.map(() => 0);
    }
  }

  has(clip: Clip): boolean {
    return !!this.meshes[clip];
  }

  begin(): void {
    for (const k of Object.keys(this.counts)) this.counts[k].fill(0);
  }

  /** `t` is seconds into the clip (looping clips wrap; one-shots hold the last frame). `tilt` tips the body backwards (radians). */
  add(clip: Clip, t: number, x: number, z: number, facing: number, scale = 1, tint?: number, sink = 0, scaleY = scale, tilt = 0): void {
    const frames = this.meshes[clip] ?? this.meshes.idle ?? Object.values(this.meshes)[0];
    const key = this.meshes[clip] ? clip : this.meshes.idle ? 'idle' : Object.keys(this.meshes)[0];
    const dur = this.book.durations[key];
    const nf = frames.length;
    let f: number;
    if (this.book.loops[key]) f = Math.floor((((t / dur) % 1) + 1) % 1 * nf) % nf;
    else f = Math.min(nf - 1, Math.floor((t / dur) * (nf - 1) + 0.5));
    const i = this.counts[key][f];
    if (i >= this.capacity) return;
    this.counts[key][f] = i + 1;
    const m = frames[f];
    this.tmp.position.set(x, -sink, z);
    this.tmp.rotation.set(0, -facing, tilt);
    this.tmp.scale.set(scale, scaleY, scale);
    this.tmp.updateMatrix();
    m.setMatrixAt(i, this.tmp.matrix);
    if (tint !== undefined) m.setColorAt(i, this.col.set(tint));
  }

  end(): void {
    let total = 0;
    for (const k of Object.keys(this.counts)) for (const c of this.counts[k]) total += c;
    const shadows = total <= this.shadowLimit;
    for (const [k, frames] of Object.entries(this.meshes))
      frames.forEach((m, f) => {
        m.count = this.counts[k][f];
        m.visible = m.count > 0;
        m.castShadow = shadows;
        if (m.count) {
          m.instanceMatrix.needsUpdate = true;
          if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }
      });
  }
}

// ---------------------------------------------------------------- the cast

// Mixamo "Rifle Idle" (the shooter pack's "Rifle Aiming Idle" won't parse in FBXLoader)
const SOLDIER_CLIPS: Partial<Record<Clip, string>> = {
  idle: 'models/characters/soldier/idle.fbx',
  walk: 'models/characters/soldier/walk.fbx',
  shoot: 'models/characters/soldier/shoot.fbx',
  death: 'models/characters/soldier/death.fbx',
};

export const CHARACTER_SPECS: CharacterSpec[] = [
  // v4.18: "Military RTS Character 1" (britdawgmasterfunk, CC-BY 4.0), rigged on Mixamo, with Mixamo
  // shooter-pack animations; replaces the cartoon Quaternius soldier and worker (#66)
  {
    key: 'soldier',
    url: 'models/characters/soldier/soldier_rts.fbx',
    texture: 'models/characters/soldier/soldier_rts.png',
    clips: ['idle', 'walk', 'shoot', 'death'],
    clipFiles: SOLDIER_CLIPS,
    inPlace: true,
    deathFalls: true,
    rifle: true,
    rifleBone: 'mixamorigRightHand',
    rifleModel: 'models/weapons/m4.glb',
  },
  {
    // same soldier, dustier, with Mixamo "Working On Device" while building / repairing / planting
    key: 'engineer',
    url: 'models/characters/soldier/soldier_rts.fbx',
    texture: 'models/characters/soldier/soldier_rts.png',
    clips: ['idle', 'walk', 'shoot', 'death', 'work'],
    clipFiles: { ...SOLDIER_CLIPS, work: 'models/characters/soldier/work.fbx' },
    inPlace: true,
    deathFalls: true,
    rifle: true,
    rifleBone: 'mixamorigRightHand',
    rifleModel: 'models/weapons/m4.glb',
    tint: 0xe8d4a0,
  },
  {
    // v4.9: "Zombie" by pxltiger (CC-BY 4.0, see CREDITS.md). Real fall-back death (#34), in-place walk/run.
    key: 'zombieM',
    url: 'models/zombieidle.glb',
    clips: ['idle', 'walk', 'run', 'punch', 'death'],
    clipNames: { walk: 'Walk_InPlace', run: 'Run_InPlace', punch: 'Attack', death: 'FallingBack' },
    deathFalls: true,
    simplify: 0.05,
  },
  {
    // v4.18: "female zombie" (jeferson, CC-BY-SA 4.0) rigged on Mixamo, with Mixamo zombie animations.
    key: 'zombieF',
    url: 'models/characters/zombieF/zombie_female.fbx',
    textureByMesh: { Body: 'models/characters/zombieF/body.png', Tops: 'models/characters/zombieF/material.png', Bottoms: 'models/characters/zombieF/bottom.png' },
    colorByMesh: { Eyes: 0xb8b090, Eyelashes: 0x1a1410 },
    clips: ['idle', 'walk', 'run', 'punch', 'death'],
    clipFiles: {
      idle: 'models/characters/zombieF/idle.fbx',
      punch: 'models/characters/zombieF/attack.fbx',
      walk: 'models/characters/zombieF/walk.fbx',
      run: 'models/characters/zombieF/run.fbx',
      death: 'models/characters/zombieF/death.fbx',
    },
    inPlace: true,
    deathFalls: true,
    simplify: 0.07, // ~43k-vertex source: crowd-weight it like the main zombie
    simplifyColors: 3,
  },
];

/** Load the whole cast. Returns null (and the game keeps its box placeholders) if anything fails. */
export async function loadCast(): Promise<Record<string, Flipbook> | null> {
  // FBXLoader warns (harmlessly) about >4 skin weights per vertex on these models; keep the console clean
  const warn = console.warn;
  console.warn = (...a: unknown[]) => {
    if (typeof a[0] === 'string' && a[0].includes('skinning weights')) return;
    // Mixamo clips animate finger bones that lighter rigs leave out; harmless
    if (typeof a[0] === 'string' && a[0].includes('No target node found for track')) return;
    warn(...a);
  };
  try {
    const books = await Promise.all(CHARACTER_SPECS.map(bakeCharacter));
    return Object.fromEntries(books.map((b) => [b.key, b]));
  } catch (err) {
    warn('[characters] falling back to placeholder figures:', err);
    return null;
  } finally {
    console.warn = warn;
  }
}
