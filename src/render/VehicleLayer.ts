import * as THREE from 'three';
import type { FrameState, RenderCtx } from './context';
import { models } from './ModelLibrary';

/**
 * Vehicles (STATUS #51): one model per vehicle squad (the owner's Humvee: "Low poly Humvee" by SIpriv,
 * CC BY 4.0), placed at the squad and turned to its heading. The model's front is at -X, hence the half turn.
 * Falls back to a simple box if the model isn't loaded. Names, health and selection come from the squad layer.
 */
export class VehicleLayer {
  private views = new Map<number, THREE.Object3D>();

  constructor(private ctx: RenderCtx) {}

  private make(defId: string): THREE.Object3D {
    const m = models.instance(defId);
    if (m) {
      m.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
      });
      m.userData.shared = true;
      return m;
    }
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.6, 2.1), new THREE.MeshLambertMaterial({ color: 0x5d6648 }));
    body.position.y = 1;
    body.castShadow = true;
    g.add(body);
    return g;
  }

  update(_f: FrameState): void {
    const { scene, world: w } = this.ctx;
    const seen = new Set<number>();
    for (const s of w.squads) {
      if (!s.alive || s.def.category !== 'vehicle') continue;
      seen.add(s.id);
      let o = this.views.get(s.id);
      if (!o) {
        o = this.make(s.def.id);
        scene.add(o);
        this.views.set(s.id, o);
      }
      o.position.set(s.pos.x, 0, s.pos.y);
      o.rotation.y = -s.facing + Math.PI;
    }
    for (const [id, o] of this.views)
      if (!seen.has(id)) {
        scene.remove(o);
        this.views.delete(id);
      }
  }
}
