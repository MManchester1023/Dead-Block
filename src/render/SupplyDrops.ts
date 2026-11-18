import * as THREE from 'three';
import type { Vec2 } from '../core/math';
import type { World } from '../sim/World';

const CRATE_FALL_SEC = 6;
const FLYOVER_SPEED = 55; // m/s across the ground: slower than a real C-130 so you can watch it pass

/** Flat top-down silhouette of a four-engine cargo plane (~40 m span), nose along +x. */
function cargoPlaneShadow(): THREE.ShapeGeometry {
  const s = new THREE.Shape();
  const pts: [number, number][] = [
    [15, 0], [13, 1.8], [4, 2.1], [2.5, 20], [-1.5, 20], [-2.5, 2.1], [-11, 1.8], [-13, 6.5], [-15.5, 6.5],
    [-15, 0], [-15.5, -6.5], [-13, -6.5], [-11, -1.8], [-2.5, -2.1], [-1.5, -20], [2.5, -20], [4, -2.1], [13, -1.8],
  ];
  s.moveTo(...pts[0]);
  for (const p of pts.slice(1)) s.lineTo(...p);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

/**
 * Supply drops (v4.4, round 4 #37): a cargo plane's shadow sweeps over, the crate leaves the ramp as it
 * passes and floats down under a parachute, with a soft blob shadow right under it.
 */
export class SupplyDrops {
  private crates = new Map<number, THREE.Group>();
  private blobs = new Map<number, THREE.Mesh>();
  /** Round 11 #123: each flyover keeps its own clock (`overheadAt`, sim time), so it flies on after the crate is picked up. */
  private flyovers = new Map<number, { mesh: THREE.Mesh; dir: Vec2; pos: Vec2; overheadAt: number }>();

  constructor(private scene: THREE.Scene, private world: World) {}

  update(): void {
    const w = this.world;
    const seen = new Set<number>();
    for (const c of w.crates) {
      seen.add(c.id);
      let v = this.crates.get(c.id);
      if (!v) {
        v = new THREE.Group();
        const crate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.4), new THREE.MeshLambertMaterial({ color: 0x6a6a3a }));
        crate.position.y = 0.55;
        crate.castShadow = true;
        const band = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.15, 1.45), new THREE.MeshLambertMaterial({ color: 0x2a2a1a }));
        band.position.y = 0.55;
        const chute = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xd8d0b8, side: THREE.DoubleSide }));
        chute.position.y = 6;
        chute.name = 'chute';
        chute.castShadow = true; // round 7 #82
        const lines = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 0.5, 5, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x8a8670, wireframe: true }));
        lines.position.y = 3.5;
        lines.name = 'lines';
        v.add(crate, band, chute, lines);
        this.scene.add(v);
        this.crates.set(c.id, v);
        // soft shadow right under the falling crate (the sun shadow lands far to the side when it's high)
        const blob = new THREE.Mesh(new THREE.CircleGeometry(3, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
        blob.rotation.x = -Math.PI / 2;
        blob.position.set(c.pos.x, 0.08, c.pos.y);
        blob.name = 'blob';
        this.scene.add(blob);
        this.blobs.set(c.id, blob);
      }
      // round 4 #37: a cargo plane's shadow sweeps over first; the crate leaves the ramp as it passes
      const untilLand = c.landsAt - w.time;
      const released = c.landed || untilLand <= CRATE_FALL_SEC;
      v.visible = released;
      if (!this.flyovers.has(c.id) && !c.landed) this.flyover(c.id, c.pos, c.landsAt - CRATE_FALL_SEC);
      const height = c.landed ? 0 : Math.max(0, untilLand) * 7;
      v.position.set(c.pos.x, height, c.pos.y);
      const blob = this.blobs.get(c.id);
      if (blob) {
        const k = released && !c.landed ? 1 - Math.min(1, height / 45) : 0; // 0 high up → 1 at the ground
        (blob.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.3 * k;
        blob.visible = released && !c.landed;
        blob.scale.setScalar(1.6 - 0.8 * k);
      }
      v.getObjectByName('chute')!.visible = !c.landed;
      v.getObjectByName('lines')!.visible = !c.landed;
    }
    for (const [id, v] of this.crates)
      if (!seen.has(id)) {
        this.scene.remove(v);
        this.crates.delete(id);
        const blob = this.blobs.get(id);
        if (blob) this.scene.remove(blob);
        this.blobs.delete(id);
      }
    for (const [id, f] of this.flyovers) {
      const along = (w.time - f.overheadAt) * FLYOVER_SPEED; // metres past the drop point
      if (along > 400) {
        this.scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        (f.mesh.material as THREE.Material).dispose();
        this.flyovers.delete(id);
        continue;
      }
      f.mesh.visible = along > -400;
      f.mesh.position.set(f.pos.x + f.dir.x * along, 0.15, f.pos.y + f.dir.y * along);
    }
  }

  /**
   * Aircraft shadow sweeping over `pos` (reused later for gun runs, bombing runs, AC-130 orbits).
   * `overheadAt` = sim time it's directly above. Approaches from the base side; `update` moves it.
   */
  private flyover(id: number, pos: Vec2, overheadAt: number): void {
    {
      const mesh = new THREE.Mesh(cargoPlaneShadow(), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 2;
      this.scene.add(mesh);
      const gate = this.world.map.baseGate;
      const dx = pos.x - (gate.x + gate.w);
      const dy = pos.y - (gate.y + gate.h / 2);
      const l = Math.hypot(dx, dy) || 1;
      const dir = { x: dx / l, y: dy / l };
      mesh.rotation.z = -Math.atan2(dir.y, dir.x);
      mesh.visible = false;
      this.flyovers.set(id, { mesh, dir, pos: { ...pos }, overheadAt });
    }
  }
}
