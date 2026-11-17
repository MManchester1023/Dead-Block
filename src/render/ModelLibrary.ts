import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Optional 3D model overrides (doc §14 v4.1 art pipeline).
 *
 * Everything in the city is procedural by default. To swap a procedural model for a real one
 * (e.g. a free CC0 model from Quaternius, Kenney or Poly Pizza), drop the .glb into
 * `public/models/` and list it in `public/models/manifest.json`:
 *
 *   { "palm": { "url": "palm.glb", "scale": 1, "rotY": 0 } }
 *
 * Models are expected in metres, +Y up, facing +Z. Missing files or a missing manifest are fine:
 * the procedural version is used.
 */
export interface ModelEntry {
  url: string;
  scale?: number;
  rotY?: number;
  y?: number;
}

class ModelLibrary {
  private loaded = new Map<string, THREE.Object3D>();
  readonly failures: string[] = [];

  async preload(base = 'models/'): Promise<void> {
    let manifest: Record<string, ModelEntry | string> = {};
    try {
      const res = await fetch(base + 'manifest.json');
      if (res.ok) manifest = await res.json();
    } catch {
      return; // no manifest → all procedural
    }
    const loader = new GLTFLoader();
    const jobs = Object.entries(manifest)
      .filter(([k, v]) => !k.startsWith('_') && typeof v === 'object')
      .map(async ([key, v]) => {
        const e = v as ModelEntry;
        try {
          const gltf = await loader.loadAsync(base + e.url);
          const root = new THREE.Group();
          const obj = gltf.scene;
          obj.scale.setScalar(e.scale ?? 1);
          obj.rotation.y = e.rotY ?? 0;
          obj.position.y = e.y ?? 0;
          obj.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
            }
          });
          root.add(obj);
          this.loaded.set(key, root);
        } catch (err) {
          this.failures.push(`${key}: ${(err as Error).message}`);
        }
      });
    await Promise.all(jobs);
    if (this.failures.length) console.warn('[models] falling back to procedural for', this.failures);
  }

  has(key: string): boolean {
    return this.loaded.has(key);
  }

  /** A fresh instance (shares geometry/materials with the loaded original). */
  instance(key: string): THREE.Object3D | null {
    const m = this.loaded.get(key);
    return m ? m.clone(true) : null;
  }
}

export const models = new ModelLibrary();
