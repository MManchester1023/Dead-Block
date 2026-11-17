import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { HUMAN_HEIGHT } from '../config/world';

/**
 * Animated characters for crowds of thousands (doc §14 v4.1 crowd tech).
 *
 * Skinned meshes with one AnimationMixer each don't scale past a couple of hundred. Instead every
 * animation is sampled at load time into a handful of frozen poses ("flipbook" frames). Each pose
 * becomes one InstancedMesh, and every character currently in that pose is one instance of it.
 * Draw calls = number of poses in use, no matter if it's 50 zombies or 2,000.
 *
 * Models: Quaternius "Ultimate Animated Character Pack" (CC0), see CREDITS.md. Material colours are
 * baked into vertex colours so each pose is a single draw call (the source meshes have ~120 groups).
 */

export type Clip = 'idle' | 'walk' | 'shoot' | 'punch' | 'death' | 'work';

const CLIP_SOURCES: Record<Clip, { name: string; frames: number; loop: boolean }> = {
  idle: { name: 'Idle', frames: 6, loop: true },
  walk: { name: 'Walk', frames: 10, loop: true },
  shoot: { name: 'Shoot_OneHanded', frames: 4, loop: true },
  punch: { name: 'Punch', frames: 6, loop: true },
  death: { name: 'Defeat', frames: 8, loop: false },
  work: { name: 'PickUp', frames: 6, loop: true },
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
}

export interface Flipbook {
  key: string;
  frames: Record<string, THREE.BufferGeometry[]>;
  durations: Record<string, number>;
  loops: Record<string, boolean>;
}

/** Load, normalise to metres facing +X, and bake every requested clip into frames. */
export async function bakeCharacter(spec: CharacterSpec): Promise<Flipbook> {
  const obj = await new FBXLoader().loadAsync(spec.url);
  obj.updateMatrixWorld(true);
  let skinned: THREE.SkinnedMesh | undefined;
  obj.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && !skinned) skinned = o as THREE.SkinnedMesh;
  });
  if (!skinned) throw new Error(`${spec.key}: no skinned mesh`);
  const sk = skinned;
  const base = sk.geometry;
  const mats = (Array.isArray(sk.material) ? sk.material : [sk.material]) as THREE.MeshPhongMaterial[];

  // per-vertex colour from the material groups
  const n = base.attributes.position.count;
  const colors = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (const g of base.groups.length ? base.groups : [{ start: 0, count: n, materialIndex: 0 }]) {
    const m = mats[g.materialIndex ?? 0];
    const over = spec.recolor?.[m.name];
    if (over !== undefined) c.set(over);
    else c.copy(m.color);
    const idx = base.index;
    for (let i = g.start; i < g.start + g.count; i++) {
      const v = idx ? idx.getX(i) : i;
      colors[v * 3] = c.r;
      colors[v * 3 + 1] = c.g;
      colors[v * 3 + 2] = c.b;
    }
  }

  // normalisation: feet on y=0, 1.8 m tall, facing +X (models face +Z)
  const bbox = new THREE.Box3().setFromObject(obj);
  const srcH = bbox.max.y - bbox.min.y;
  const s = (HUMAN_HEIGHT * (spec.height ?? 1)) / srcH;
  const norm = new THREE.Matrix4()
    .makeRotationY(Math.PI / 2)
    .multiply(new THREE.Matrix4().makeScale(s * (spec.girth ?? 1), s, s * (spec.girth ?? 1)))
    .multiply(new THREE.Matrix4().makeTranslation(-(bbox.min.x + bbox.max.x) / 2, -bbox.min.y, -(bbox.min.z + bbox.max.z) / 2));

  const mixer = new THREE.AnimationMixer(obj);
  const fist = spec.rifle ? obj.getObjectByName('FistR') : undefined;
  const rifle = spec.rifle ? rifleGeometry(1) : undefined; // built in metres

  const book: Flipbook = { key: spec.key, frames: {}, durations: {}, loops: {} };
  const v = new THREE.Vector3();
  for (const clip of spec.clips) {
    const src = CLIP_SOURCES[clip];
    const anim = obj.animations.find((a) => a.name.endsWith('|' + src.name) || a.name === src.name);
    if (!anim) continue;
    mixer.stopAllAction();
    const action = mixer.clipAction(anim);
    action.reset().play();
    const frames: THREE.BufferGeometry[] = [];
    for (let f = 0; f < src.frames; f++) {
      const t = src.loop ? (f / src.frames) * anim.duration : (f / (src.frames - 1)) * anim.duration * 0.999;
      mixer.setTime(t);
      obj.updateMatrixWorld(true);
      sk.skeleton.update();
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(base.attributes.position as THREE.BufferAttribute, i);
        sk.applyBoneTransform(i, v);
        v.applyMatrix4(sk.matrixWorld).applyMatrix4(norm);
        pos[i * 3] = v.x;
        pos[i * 3 + 1] = v.y;
        pos[i * 3 + 2] = v.z;
      }
      let g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      if (base.index) g.setIndex(base.index);
      if (rifle && fist) {
        // place the rifle by the hand's position + orientation only (the bone matrix also carries the
        // FBX unit scale, which would make the gun ~100x too big)
        const hp = new THREE.Vector3();
        const hq = new THREE.Quaternion();
        fist.matrixWorld.decompose(hp, hq, new THREE.Vector3());
        hp.applyMatrix4(norm);
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2).multiply(hq);
        const r = rifle.clone().applyMatrix4(new THREE.Matrix4().compose(hp, q, new THREE.Vector3(1, 1, 1)));
        g = mergeSimple(g, r);
      }
      if (spec.simplify) g = clusterSimplify(g, spec.simplify);
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

/**
 * Vertex-clustering decimation: snap vertices to a grid of `cell` metres, merge everything in a cell,
 * drop collapsed triangles. Crude but O(n) and invisible at crowd distance; turns ~4–10k-triangle
 * characters into ~1–2k so thousands of zombies stay affordable on the GPU.
 */
function clusterSimplify(g: THREE.BufferGeometry, cell: number): THREE.BufferGeometry {
  const pos = g.attributes.position.array as Float32Array;
  const col = g.attributes.color.array as Float32Array;
  const idx = g.index ? (g.index.array as ArrayLike<number>) : null;
  const triCount = (idx ? idx.length : pos.length / 3) / 3;
  const map = new Map<string, number>();
  const sums: number[] = [];
  const cols: number[] = [];
  const counts: number[] = [];
  const remap = new Int32Array(pos.length / 3);
  for (let v = 0; v < pos.length / 3; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    // keep colours apart so faces/eyes don't smear into skin
    const key = `${Math.round(x / cell)},${Math.round(y / cell)},${Math.round(z / cell)},${Math.round(col[v * 3] * 8)},${Math.round(col[v * 3 + 1] * 8)}`;
    let id = map.get(key);
    if (id === undefined) {
      id = counts.length;
      map.set(key, id);
      sums.push(0, 0, 0);
      cols.push(col[v * 3], col[v * 3 + 1], col[v * 3 + 2]);
      counts.push(0);
    }
    sums[id * 3] += x;
    sums[id * 3 + 1] += y;
    sums[id * 3 + 2] += z;
    counts[id]++;
    remap[v] = id;
  }
  const outIdx: number[] = [];
  for (let t = 0; t < triCount; t++) {
    const a = remap[idx ? idx[t * 3] : t * 3];
    const b = remap[idx ? idx[t * 3 + 1] : t * 3 + 1];
    const c = remap[idx ? idx[t * 3 + 2] : t * 3 + 2];
    if (a !== b && b !== c && a !== c) outIdx.push(a, b, c);
  }
  const P = new Float32Array(counts.length * 3);
  for (let i = 0; i < counts.length; i++) {
    P[i * 3] = sums[i * 3] / counts[i];
    P[i * 3 + 1] = sums[i * 3 + 1] / counts[i];
    P[i * 3 + 2] = sums[i * 3 + 2] / counts[i];
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cols), 3));
  out.setIndex(outIdx);
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

  /** `t` is seconds into the clip (looping clips wrap; one-shots hold the last frame). */
  add(clip: Clip, t: number, x: number, z: number, facing: number, scale = 1, tint?: number, sink = 0, scaleY = scale): void {
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
    this.tmp.rotation.set(0, -facing, 0);
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

export const CHARACTER_SPECS: CharacterSpec[] = [
  {
    key: 'soldier',
    url: 'models/characters/Soldier_Male.fbx',
    clips: ['idle', 'walk', 'shoot', 'death'],
    rifle: true,
    recolor: { Skin: 0xc4977a, Main: 0x4f5a34, DarkGreen: 0x39432a, Helmet: 0x3e4a2c, Black: 0x1c1c1c },
  },
  {
    key: 'engineer',
    url: 'models/characters/Worker_Male.fbx',
    clips: ['idle', 'walk', 'shoot', 'death', 'work'],
    rifle: true,
    recolor: { Skin: 0xc4977a, Shirt: 0x7a6a48, Vest: 0xc88a2a, Pants: 0x4a4a3a, Hat: 0xd8b030 },
  },
  {
    key: 'zombieM',
    url: 'models/characters/Zombie_Male.fbx',
    clips: ['idle', 'walk', 'punch', 'death'],
    simplify: 0.06,
    recolor: { Skin: 0x8a9a5a, Clothes: 0x4a4a6a, Pants: 0x6a5e3a, DarkClothes: 0x2a2a3a, Guts: 0x7a2a1a, Brain: 0x86705e, Bones: 0xc8b890 },
  },
  {
    key: 'zombieF',
    url: 'models/characters/Zombie_Female.fbx',
    clips: ['idle', 'walk', 'punch', 'death'],
    simplify: 0.09,
    recolor: { Skin: 0x8fa060, Clothes: 0x6a3a4a, Pants: 0x5a5a4a, DarkClothes: 0x2a2a2a, Guts: 0x7a2a1a, Bones: 0xc8b890, Hair: 0x3a2a1a },
  },
];

/** Load the whole cast. Returns null (and the game keeps its box placeholders) if anything fails. */
export async function loadCast(): Promise<Record<string, Flipbook> | null> {
  // FBXLoader warns (harmlessly) about >4 skin weights per vertex on these models; keep the console clean
  const warn = console.warn;
  console.warn = (...a: unknown[]) => {
    if (typeof a[0] === 'string' && a[0].includes('skinning weights')) return;
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
