import * as THREE from 'three';
import type { FrameState, RenderCtx } from './context';
import { models } from './ModelLibrary';

/**
 * Vehicles (STATUS #51): one model per vehicle squad (the owner's Humvee: "Low poly Humvee" by SIpriv,
 * CC BY 4.0), placed at the squad and turned to its heading. The model's front is at -X, hence the half turn.
 * Falls back to a simple box if the model isn't loaded. Names, health and selection come from the squad layer.
 */
/**
 * Round 17 #202: turrets, as separate models that turn on the hull (exported from the same file with
 * `export-prop.cjs --only=… --pivot=…`): where the turret sits on the hull (x, z metres, hull frame).
 */
const TURRETS: Record<string, { key: string; pivot: [number, number] }> = {
  humvee: { key: 'humveeTurret', pivot: [0.03, 0] },
};
/** Radians per second a turret turns. */
const TURRET_SPEED = 3;

export class VehicleLayer {
  private views = new Map<number, THREE.Object3D>();
  private turrets = new Map<number, { obj: THREE.Object3D; angle: number }>();

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

  update(f: FrameState): void {
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
        const T = TURRETS[s.def.id];
        const t = T && models.instance(T.key);
        if (T && t) {
          t.traverse((m) => {
            if ((m as THREE.Mesh).isMesh) m.castShadow = true;
          });
          t.position.set(T.pivot[0], 0, T.pivot[1]);
          t.userData.shared = true;
          o.add(t);
          this.turrets.set(s.id, { obj: t, angle: 0 });
        }
      }
      o.position.set(s.pos.x, 0, s.pos.y);
      o.rotation.y = -s.facing + Math.PI;
      // the gun turns toward what it's shooting at, and back to the front when there's nothing
      const tur = this.turrets.get(s.id);
      if (tur) {
        const t = w.get(s.targetId);
        const rel = t && t.alive ? Math.atan2(t.pos.y - s.pos.y, t.pos.x - s.pos.x) - s.facing : 0;
        const want = -Math.atan2(Math.sin(rel), Math.cos(rel));
        const diff = Math.atan2(Math.sin(want - tur.angle), Math.cos(want - tur.angle));
        const stepMax = TURRET_SPEED * Math.max(0.001, f.realDt);
        tur.angle += Math.max(-stepMax, Math.min(stepMax, diff));
        tur.obj.rotation.y = tur.angle;
      }
    }
    for (const [id, o] of this.views)
      if (!seen.has(id)) {
        scene.remove(o);
        this.views.delete(id);
        this.turrets.delete(id);
      }
  }
}
