import * as THREE from 'three';
import { CELL } from '../config/world';
import { PAL } from './palette';

/**
 * The see-through block under the cursor while placing a structure (green = OK, red = blocked), with a
 * double-headed arrow along a wall's run (round 4 #42), its firing-range ring or field-of-fire sector,
 * and an arrow for the way an emplacement faces (v4.13 #71).
 */
export class PlacementGhost {
  private box: THREE.Mesh;
  private arrow: THREE.Mesh;
  private range: THREE.Mesh;
  private rangeKey = '';
  private aim: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    this.box = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 1), new THREE.MeshBasicMaterial({ color: 0x77dd77, transparent: true, opacity: 0.45, depthWrite: false }));
    this.box.visible = false;
    scene.add(this.box);

    const arrow = new THREE.Shape();
    const hl = 0.5, hw = 0.32, sw = 0.09; // unit-length arrow along +x, centred
    arrow.moveTo(-0.5, 0);
    arrow.lineTo(-0.5 + hl * 0.5, hw);
    arrow.lineTo(-0.5 + hl * 0.5, sw);
    arrow.lineTo(0.5 - hl * 0.5, sw);
    arrow.lineTo(0.5 - hl * 0.5, hw);
    arrow.lineTo(0.5, 0);
    arrow.lineTo(0.5 - hl * 0.5, -hw);
    arrow.lineTo(0.5 - hl * 0.5, -sw);
    arrow.lineTo(-0.5 + hl * 0.5, -sw);
    arrow.lineTo(-0.5 + hl * 0.5, -hw);
    arrow.closePath();
    this.arrow = new THREE.Mesh(new THREE.ShapeGeometry(arrow), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide }));
    this.arrow.rotation.x = -Math.PI / 2;
    this.arrow.renderOrder = 10;
    this.arrow.visible = false;
    this.range = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    this.range.rotation.x = -Math.PI / 2;
    this.range.visible = false;
    const aimShape = new THREE.Shape();
    aimShape.moveTo(-1.2, -0.25);
    for (const [x, y] of [[1.2, -0.25], [1.2, -0.75], [3.2, 0], [1.2, 0.75], [1.2, 0.25], [-1.2, 0.25]] as [number, number][]) aimShape.lineTo(x, y);
    aimShape.closePath();
    this.aim = new THREE.Mesh(new THREE.ShapeGeometry(aimShape), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
    this.aim.rotation.x = -Math.PI / 2;
    this.aim.renderOrder = 10;
    this.aim.visible = false;
    scene.add(this.arrow, this.range, this.aim);
  }

  set(tile: { x: number; y: number } | null, size = { w: 1, h: 1 }, ok = true, range = 0, arc?: { aim: number; deg: number }, exit?: { x: number; y: number; face: number } | null): void {
    this.box.visible = !!tile;
    this.arrow.visible = !!tile && size.w !== size.h && !arc && !exit;
    this.range.visible = !!tile && range > 0;
    this.aim.visible = !!tile && (!!arc || !!exit);
    if (!tile) return;
    const cx = (tile.x + size.w / 2) * CELL;
    const cz = (tile.y + size.h / 2) * CELL;
    this.box.scale.set(size.w * CELL, 1, size.h * CELL);
    this.box.position.set(cx, 0.75, cz);
    (this.box.material as THREE.MeshBasicMaterial).color.set(ok ? 0x77dd77 : PAL.danger);
    if (this.arrow.visible) {
      const len = Math.max(size.w, size.h) * CELL + 1.5;
      this.arrow.position.set(cx, 1.6, cz);
      this.arrow.scale.set(len, 2.2, 1);
      this.arrow.rotation.z = size.w > size.h ? 0 : Math.PI / 2;
    }
    if (this.range.visible) {
      this.range.position.set(cx, 0.12, cz);
      this.range.scale.setScalar(range);
      // field of fire (v4.13 #71): a filled sector instead of a full ring
      const key = arc ? `${arc.aim.toFixed(3)}:${arc.deg}` : 'ring';
      if (this.rangeKey !== key) {
        this.rangeKey = key;
        this.range.geometry.dispose();
        if (arc) {
          const half = (arc.deg * Math.PI) / 360;
          // ring geometry lies in XY; after the -90° X tilt, angle θ points along (cos θ, -sin θ) on the ground
          this.range.geometry = new THREE.RingGeometry(0.06, 1, 48, 1, -arc.aim - half, half * 2);
        } else this.range.geometry = new THREE.RingGeometry(0.97, 1, 64);
        (this.range.material as THREE.MeshBasicMaterial).opacity = arc ? 0.22 : 0.5;
      }
    }
    if (arc) {
      this.aim.position.set(cx, 1.9, cz);
      this.aim.rotation.z = -arc.aim;
    } else if (exit) {
      // round 18: where vehicles come out (the Vehicle Bay's door), pointing the way they leave
      this.aim.position.set(exit.x, 1.2, exit.y);
      this.aim.rotation.z = -exit.face;
    }
  }
}
