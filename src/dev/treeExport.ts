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

(window as unknown as Record<string, unknown>).exportTrees = exportTrees;
document.title = 'ready';
