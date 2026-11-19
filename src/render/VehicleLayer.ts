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
/** Round 18 #210: the Humvee gun's muzzle, from the turret's pivot (metres out along the barrel, height). */
const MUZZLE_OUT = 1.1;
const MUZZLE_HEIGHT = 1.62;

export class VehicleLayer {
  private views = new Map<number, THREE.Object3D>();
  private turrets = new Map<number, { obj: THREE.Object3D; angle: number }>();

  constructor(private ctx: RenderCtx) {}

  /** Round 18 #214: see-through vehicles with an arrow at the front, where a right-drag would park them. */
  private ghosts: THREE.Group[] = [];
  private updateGhosts(list: { x: number; y: number; face: number; defId: string }[]): void {
    while (this.ghosts.length < list.length) {
      const g = new THREE.Group();
      const body = this.make(list[this.ghosts.length].defId);
      body.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.material = (m.material as THREE.Material).clone();
        (m.material as THREE.Material).transparent = true;
        (m.material as THREE.Material).opacity = 0.4;
        (m.material as THREE.Material).depthWrite = false;
        m.castShadow = false;
      });
      body.userData.shared = false;
      g.add(body);
      const shape = new THREE.Shape();
      shape.moveTo(0, -0.35);
      for (const [x, y] of [[2.2, -0.35], [2.2, -0.9], [3.6, 0], [2.2, 0.9], [2.2, 0.35], [0, 0.35]] as [number, number][]) shape.lineTo(x, y);
      shape.closePath();
      const arrow = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
      arrow.rotation.x = -Math.PI / 2;
      arrow.position.y = 2.2;
      arrow.renderOrder = 10;
      arrow.name = 'arrow';
      g.add(arrow);
      this.ctx.scene.add(g);
      this.ghosts.push(g);
    }
    this.ghosts.forEach((g, i) => {
      const s = list[i];
      g.visible = !!s;
      if (!s) return;
      g.position.set(s.x, 0, s.y);
      // the body's front is at -X (half turn); the arrow points along +X in its own frame
      g.children[0].rotation.y = -s.face + Math.PI;
      g.getObjectByName('arrow')!.rotation.z = -s.face;
    });
  }

  /**
   * Round 18 #210: where a vehicle's gun fires from: its turret's muzzle (world x/y and height), or null for
   * vehicles without one.
   */
  muzzle(id: number): { x: number; y: number; h: number } | null {
    const t = this.turrets.get(id);
    if (!t) return null;
    t.obj.updateWorldMatrix(true, false);
    // the barrel points along the turret's local -X (the model's front), about 1.1 m out from the pivot
    const p = new THREE.Vector3(-MUZZLE_OUT, MUZZLE_HEIGHT, 0).applyMatrix4(t.obj.matrixWorld);
    return { x: p.x, y: p.z, h: p.y };
  }

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

  update(_f: FrameState, ghosts: { x: number; y: number; face: number; defId: string }[] = []): void {
    this.updateGhosts(ghosts);
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
      // round 19 #231: the gun turns in the game itself (it fires once it's on target); this just shows it
      const tur = this.turrets.get(s.id);
      if (tur) {
        tur.angle = -s.turretAngle;
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
