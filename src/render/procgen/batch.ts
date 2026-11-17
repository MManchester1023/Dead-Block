import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Collects lots of small static pieces (window frames, fence posts, palm fronds…) with baked
 * vertex colours and merges them into one mesh: one draw call instead of thousands.
 * Everything procedural for the city goes through here.
 */
export class Batch {
  private geos: THREE.BufferGeometry[] = [];
  private tmp = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();

  get size(): number {
    return this.geos.length;
  }

  /** Add a geometry (cloned) with a flat colour and optional transform. */
  add(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, matrix?: THREE.Matrix4): this {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g = g.index ? g.toNonIndexed() : g;
    this.geos.push(g);
    return this;
  }

  /** Box centred at (x, y, z), rotated by ry around Y (and optional rx/rz). */
  box(w: number, h: number, d: number, color: THREE.ColorRepresentation, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): this {
    return this.add(new THREE.BoxGeometry(w, h, d), color, this.trs(x, y, z, ry, rx, rz));
  }

  cyl(rTop: number, rBot: number, h: number, seg: number, color: THREE.ColorRepresentation, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0): this {
    return this.add(new THREE.CylinderGeometry(rTop, rBot, h, seg), color, this.trs(x, y, z, ry, rx, rz));
  }

  trs(x: number, y: number, z: number, ry = 0, rx = 0, rz = 0, s = 1): THREE.Matrix4 {
    this.e.set(rx, ry, rz, 'YXZ');
    this.q.setFromEuler(this.e);
    return this.tmp.clone().compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(s, s, s));
  }

  /** Move everything collected here into another batch, applying a transform (local → world). */
  transferTo(target: Batch, matrix: THREE.Matrix4): void {
    for (const g of this.geos) {
      g.applyMatrix4(matrix);
      target.geos.push(g);
    }
    this.geos = [];
  }

  /** Merge into a single mesh. */
  build(material?: THREE.Material): THREE.Mesh {
    const geo = this.geos.length ? mergeGeometries(this.geos)! : new THREE.BufferGeometry();
    const mesh = new THREE.Mesh(geo, material ?? new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.geos = [];
    return mesh;
  }
}

/** Triangular-prism gable roof: ridge along local X, width along Z, peak at height `rise`. Non-indexed. */
export function gableRoof(length: number, width: number, rise: number, overhang = 0.4): THREE.BufferGeometry {
  const L = length / 2 + overhang;
  const W = width / 2 + overhang;
  const p = (x: number, y: number, z: number) => [x, y, z];
  const A = p(-L, 0, -W), B = p(L, 0, -W), C = p(L, rise, 0), D = p(-L, rise, 0);
  const E = p(-L, 0, W), F = p(L, 0, W);
  const tris = [
    // north slope
    A, D, C, A, C, B,
    // south slope
    E, F, C, E, C, D,
    // gable ends
    A, E, D, B, C, F,
    // underside
    A, B, F, A, F, E,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}

/** Deterministic small hash → [0,1). */
export function hash(...n: number[]): number {
  let h = 2166136261;
  for (const v of n) {
    h ^= Math.floor(v * 1000) | 0;
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
