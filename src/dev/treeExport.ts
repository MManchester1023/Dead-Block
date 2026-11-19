// Dev-only page (dev-treeexport.html, v4.58): the owner's low-poly tree packs (free use) → one small GLB per
// tree or shrub: material colours baked into vertex colours, merged, big ones simplified to ~900
// triangles, trunk base at the origin, scaled to a height (trees keep their size relative to the rest of
// their pack). Driven by tools/assets/export-trees.cjs.
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer';

const MAX_TRIS = 900;

interface Job {
  url: string;
  /** Object names to export as shrubs (the rest are trees). */
  shrubs: string[];
}

async function exportTrees(jobs: Job[]): Promise<{ kind: 'tree' | 'shrub'; name: string; b64: string; tris: number; height: number }[]> {
  await MeshoptSimplifier.ready;
  const out: { kind: 'tree' | 'shrub'; name: string; b64: string; tris: number; height: number }[] = [];
  for (const job of jobs) {
    const root = await new FBXLoader().loadAsync(job.url);
    root.updateMatrixWorld(true);
    const items = root.children.filter((o) => {
      let has = false;
      o.traverse((c) => (has ||= (c as THREE.Mesh).isMesh));
      return has;
    });
    const heights = items.map((o) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).y);
    const tallestTree = Math.max(...items.filter((o) => !job.shrubs.includes(o.name)).map((o, i) => heights[items.indexOf(o)] ?? i));
    const shrubTallest = Math.max(1e-6, ...items.filter((o) => job.shrubs.includes(o.name)).map((o) => heights[items.indexOf(o)]));
    for (const [k, item] of items.entries()) {
      const shrub = job.shrubs.includes(item.name);
      const pos: number[] = [];
      const col: number[] = [];
      const v = new THREE.Vector3();
      const c = new THREE.Color();
      item.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const g = m.geometry;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        const P = g.attributes.position;
        const index = g.index;
        const groups = g.groups.length ? g.groups : [{ start: 0, count: index ? index.count : P.count, materialIndex: 0 }];
        for (const gr of groups) {
          const mat = mats[gr.materialIndex ?? 0] as THREE.MeshPhongMaterial;
          c.copy(mat?.color ?? new THREE.Color(0x888888));
          for (let i = gr.start; i < gr.start + gr.count; i++) {
            const vi = index ? index.getX(i) : i;
            v.fromBufferAttribute(P, vi).applyMatrix4(m.matrixWorld);
            pos.push(v.x, v.y, v.z);
            col.push(c.r, c.g, c.b);
          }
        }
      });
      let g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.computeBoundingBox();
      const bb = g.boundingBox!;
      // trunk base at the origin: centre the lowest tenth (the trunk), not the whole crown
      const pa = g.attributes.position.array as Float32Array;
      let sx = 0, sz = 0, n = 0;
      const low = bb.min.y + (bb.max.y - bb.min.y) * 0.1;
      for (let i = 0; i < pa.length; i += 3) if (pa[i + 1] <= low) (sx += pa[i]), (sz += pa[i + 2]), n++;
      g.translate(-(n ? sx / n : (bb.min.x + bb.max.x) / 2), -bb.min.y, -(n ? sz / n : (bb.min.z + bb.max.z) / 2));
      // height: trees 6–9.5 m by their size in the pack, shrubs 1–1.6 m
      const h = heights[k];
      const target = shrub ? 1 + 0.6 * (h / shrubTallest) : 6 + 3.5 * Math.max(0, (h / tallestTree - 0.55) / 0.45);
      const s = target / h;
      g.scale(s, s, s);
      const welded = mergeVertices(g, 1e-4);
      let idx: Uint32Array = new Uint32Array(welded.index!.array);
      if (idx.length / 3 > MAX_TRIS) {
        const [simple] = MeshoptSimplifier.simplify(idx, welded.attributes.position.array as Float32Array, 3, MAX_TRIS * 3, 0.02);
        idx = simple;
      }
      welded.setIndex(new THREE.BufferAttribute(idx, 1));
      g = welded;
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
      const glb = (await new GLTFExporter().parseAsync(mesh, { binary: true })) as ArrayBuffer;
      const bytes = new Uint8Array(glb);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      out.push({ kind: shrub ? 'shrub' : 'tree', name: item.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), b64: btoa(bin), tris: idx.length / 3, height: +target.toFixed(2) });
    }
  }
  return out;
}

interface TexturedJob {
  url: string;
  /** Per material name: its base colour and (for leaf cards) opacity image. */
  mats: Record<string, { diffuse: string; opacity?: string }>;
  /** Each tree or shrub: the object names that make it up (a trunk and its branches, or one piece). */
  items: { name: string; parts: string[]; kind: 'tree' | 'shrub' }[];
}

const loadImage = async (url: string) => {
  const im = new Image();
  im.src = url;
  await im.decode();
  return im;
};

/**
 * v4.66: the owner's forest pack (99.Miles): leaves are cards with cut-out textures, so these keep their
 * UVs and a texture (opacity folded into its alpha, alpha-tested, double-sided) instead of baked colours.
 * A tree drawn from the shared atlas gets only its own crop of it (≤ 256 px); tiling textures (the detailed
 * trees' bark and branches) are just shrunk. Trunk base at the origin, scaled like exportTrees.
 */
async function exportTexturedTrees(job: TexturedJob): Promise<{ kind: 'tree' | 'shrub'; name: string; b64: string; tris: number; height: number }[]> {
  const root = await new FBXLoader().loadAsync(job.url);
  root.updateMatrixWorld(true);
  const byName = new Map<string, THREE.Mesh>();
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) byName.set(o.name, o as THREE.Mesh);
  });
  const images = new Map<string, HTMLImageElement>();
  const img = async (u: string) => images.get(u) ?? (images.set(u, await loadImage(u)), images.get(u)!);
  const heightOf = (it: TexturedJob['items'][number]) => {
    const bb = new THREE.Box3();
    for (const n of it.parts) bb.expandByObject(byName.get(n)!);
    return bb.max.y - bb.min.y;
  };
  const tallestTree = Math.max(...job.items.filter((i) => i.kind === 'tree').map(heightOf));
  const tallestShrub = Math.max(1e-6, ...job.items.filter((i) => i.kind === 'shrub').map(heightOf));
  const out: { kind: 'tree' | 'shrub'; name: string; b64: string; tris: number; height: number }[] = [];

  for (const it of job.items) {
    // world-space parts
    const parts = it.parts.map((n) => {
      const m = byName.get(n);
      if (!m) throw new Error(`no object ${n}`);
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
      return { g, mat: (Array.isArray(m.material) ? m.material[0] : m.material).name };
    });
    const bb = new THREE.Box3();
    for (const p of parts) bb.union((p.g.computeBoundingBox(), p.g.boundingBox!));
    // trunk base: the centre of the lowest tenth
    let sx = 0, sz = 0, n = 0;
    const low = bb.min.y + (bb.max.y - bb.min.y) * 0.1;
    for (const p of parts) {
      const a = p.g.attributes.position.array as Float32Array;
      for (let i = 0; i < a.length; i += 3) if (a[i + 1] <= low) (sx += a[i]), (sz += a[i + 2]), n++;
    }
    const h = bb.max.y - bb.min.y;
    const target = it.kind === 'shrub' ? 1 + 0.6 * (h / tallestShrub) : 6 + 3.5 * Math.max(0, (h / tallestTree - 0.55) / 0.45);
    const s = target / h;
    const group = new THREE.Group();
    let tris = 0;
    for (const p of parts) {
      p.g.translate(-(n ? sx / n : 0), -bb.min.y, -(n ? sz / n : 0));
      p.g.scale(s, s, s);
      p.g.deleteAttribute('normal');
      p.g.computeVertexNormals();
      tris += p.g.attributes.position.count / 3;
      const spec = job.mats[p.mat];
      if (!spec) throw new Error(`no textures for material ${p.mat}`);
      const uv = p.g.attributes.uv as THREE.BufferAttribute;
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (let i = 0; i < uv.count; i++) (u0 = Math.min(u0, uv.getX(i))), (u1 = Math.max(u1, uv.getX(i))), (v0 = Math.min(v0, uv.getY(i))), (v1 = Math.max(v1, uv.getY(i)));
      const dif = await img(spec.diffuse);
      const crop = u0 >= -0.001 && u1 <= 1.001 && v0 >= -0.001 && v1 <= 1.001; // inside the atlas: take just this part
      if (crop) {
        const m = 0.01;
        (u0 = Math.max(0, u0 - m)), (u1 = Math.min(1, u1 + m)), (v0 = Math.max(0, v0 - m)), (v1 = Math.min(1, v1 + m));
      } else (u0 = 0), (u1 = 1), (v0 = 0), (v1 = 1);
      const sw = (u1 - u0) * dif.width, sh = (v1 - v0) * dif.height;
      const k = Math.min(1, 256 / Math.max(sw, sh));
      const cw = Math.max(4, Math.round(sw * k)), ch = Math.max(4, Math.round(sh * k));
      const draw = (im: HTMLImageElement) => {
        const cv = document.createElement('canvas');
        cv.width = cw;
        cv.height = ch;
        const ctx = cv.getContext('2d')!;
        ctx.drawImage(im, u0 * im.width, (1 - v1) * im.height, (u1 - u0) * im.width, (v1 - v0) * im.height, 0, 0, cw, ch);
        return { cv, ctx };
      };
      const { cv, ctx } = draw(dif);
      if (spec.opacity) {
        const op = draw(await img(spec.opacity)).ctx.getImageData(0, 0, cw, ch).data;
        const d = ctx.getImageData(0, 0, cw, ch);
        for (let i = 0; i < d.data.length; i += 4) d.data[i + 3] = op[i];
        ctx.putImageData(d, 0, 0);
      }
      if (crop) for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) - u0) / (u1 - u0), (uv.getY(i) - v0) / (v1 - v0));
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = crop ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0, side: THREE.DoubleSide, alphaTest: spec.opacity ? 0.5 : 0 });
      group.add(new THREE.Mesh(p.g, mat));
    }
    const glb = (await new GLTFExporter().parseAsync(group, { binary: true })) as ArrayBuffer;
    const bytes = new Uint8Array(glb);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    out.push({ kind: it.kind, name: it.name, b64: btoa(bin), tris, height: +target.toFixed(2) });
  }
  return out;
}

(window as unknown as Record<string, unknown>).exportTexturedTrees = exportTexturedTrees;
(window as unknown as Record<string, unknown>).exportTrees = exportTrees;
document.title = 'ready';
