import * as THREE from 'three';
import type { Rect } from '../core/math';
import { buildGroundTexture } from './procgen/ground';
import { buildCity } from './procgen/buildings';
import { drawDecor, makeCar, scatterDecor, makePumpIsland, drawCanopy, makeBorder } from './procgen/props';
import { Batch } from './procgen/batch';
import { models } from './ModelLibrary';
import { PAL } from './palette';
import type { RenderCtx } from './context';

/**
 * The city itself: ground, buildings, street props, cars, gas-station canopies, the fences around
 * regions that haven't opened, and the per-district tint overlays. Built once; per frame it only
 * fades buildings that hide units and retints the districts.
 */
export class CityLayer {
  /** Buildings and canopies that fade to a ghost when they hide a unit. */
  private occluders: { mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; box: THREE.Box3; opacity: number }[] = [];
  private fences = new Map<string, THREE.Object3D>();
  private districtOverlays = new Map<string, THREE.Mesh>();
  private districtLabels = new Map<string, HTMLDivElement>();

  constructor(private ctx: RenderCtx) {
    const { scene, world } = ctx;
    const m = world.map;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(m.width, m.height), new THREE.MeshLambertMaterial({ map: buildGroundTexture(m) }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(m.width / 2, 0, m.height / 2);
    ground.receiveShadow = true;
    scene.add(ground);

    // apron of wasteland so the map edge isn't a cliff into the void
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(m.width + 240, m.height + 240), new THREE.MeshLambertMaterial({ color: 0x4a4436 }));
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(m.width / 2, -0.02, m.height / 2);
    apron.receiveShadow = true;
    scene.add(apron);

    // procedural city (doc §14 v4.1): one mesh per building (so it can fade when it hides units),
    // all street props merged into a single mesh
    buildCity(m, (b, batch) => {
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
      const mesh = batch.build(mat);
      scene.add(mesh);
      const top = b.height + (b.kind === 'houses' ? 4 : b.kind === 'apartment' ? 4 : 2.5); // roofs, tanks, signs
      this.occluders.push({ mesh, mat, box: new THREE.Box3(new THREE.Vector3(b.rect.x, 0, b.rect.y), new THREE.Vector3(b.rect.x + b.rect.w, top, b.rect.y + b.rect.h)), opacity: 1 });
    });
    const city = new Batch();
    for (const d of scatterDecor(m, world.grid)) {
      const model = models.instance(d.kind);
      if (model) {
        model.position.set(d.x, 0, d.z);
        model.rotation.y += -d.ry;
        model.scale.multiplyScalar(d.scale);
        scene.add(model);
      } else drawDecor(city, d);
    }
    scene.add(city.build());

    // gas-station canopies: their own fading meshes, so units under them stay visible
    for (const r of m.canopies) {
      const cb = new Batch();
      drawCanopy(cb, r);
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
      const mesh = cb.build(mat);
      scene.add(mesh);
      this.occluders.push({ mesh, mat, box: new THREE.Box3(new THREE.Vector3(r.x, 0, r.y), new THREE.Vector3(r.x + r.w, 6, r.y + r.h)), opacity: 1 });
    }

    // fences closing off tutorial regions that haven't opened yet (doc §17)
    for (const d of m.districts) {
      if (!world.districts.get(d.id)?.locked || !d.borders) continue; // (a loaded game may have opened it)
      const fence = new THREE.Group();
      for (const b of d.borders) fence.add(makeBorder(m, b));
      scene.add(fence);
      this.fences.set(d.id, fence);
    }

    for (const p of m.props) {
      if (p.kind === 'pump') {
        scene.add(makePumpIsland(p));
        continue;
      }
      const model = models.instance('car');
      if (model) {
        model.position.set(p.pos.x, 0, p.pos.y);
        model.rotation.y += (p.h > p.w ? Math.PI / 2 : 0) + ((p.id % 7) - 3) * 0.05;
        scene.add(model);
      } else scene.add(makeCar(p));
    }

    for (const d of m.districts) {
      if (d.id === 'base') continue;
      const ov = new THREE.Mesh(
        new THREE.PlaneGeometry(d.rect.w, d.rect.h),
        new THREE.MeshBasicMaterial({ color: PAL.infest, transparent: true, opacity: 0.2, depthWrite: false }),
      );
      ov.rotation.x = -Math.PI / 2;
      ov.position.set(d.rect.x + d.rect.w / 2, 0.06, d.rect.y + d.rect.h / 2);
      scene.add(ov);
      this.districtOverlays.set(d.id, ov);
      this.districtLabels.set(d.id, ctx.labels.make(ctx.overlay, 'district-label'));
    }
  }

  /** A region opened: its fence comes down. Returns the fence lines (for the dust), or nothing if it had none. */
  removeFence(districtId: string): Rect[] {
    const fence = this.fences.get(districtId);
    if (!fence) return [];
    this.ctx.scene.remove(fence);
    this.fences.delete(districtId);
    return this.ctx.world.districts.get(districtId)?.def.borders ?? [];
  }

  /** District overlays (infestation → red tint) and their ops-map labels. */
  updateDistricts(): void {
    const { world: w, rig, labels } = this.ctx;
    for (const [id, ov] of this.districtOverlays) {
      const d = w.districts.get(id)!;
      const mat = ov.material as THREE.MeshBasicMaterial;
      // a faint tint at street level (keep the asphalt grey), a clear read on the ops map
      const k = rig.strategic ? 1 : 0.25;
      if (d.locked) {
        // not open yet: dimmed, so the playable area reads clearly
        mat.opacity = rig.strategic ? 0.55 : 0.5;
        mat.color.set(0x111316);
      } else {
        mat.opacity = (d.secured ? 0.07 : 0.04 + (d.infestation / 100) * 0.26) * k;
        mat.color.set(d.secured ? 0x5d8a4a : PAL.infest);
      }
      const lab = this.districtLabels.get(id)!;
      lab.style.display = rig.strategic ? 'block' : 'none';
      if (rig.strategic)
        labels.place(lab, { x: d.def.rect.x + d.def.rect.w / 2, y: d.def.rect.y + d.def.rect.h / 2 }, 0, () =>
          `<div class="dname">${d.def.name}</div><div>${d.locked ? 'RESTRICTED · opens when the previous region is secured' : d.secured ? 'SECURED' : `${Math.ceil(d.infestation)}% infested`}</div>`,
        );
    }
  }

  /**
   * See-through buildings (v4.5 next-step 1): any building between the camera and one of your
   * squads (or a hive / a structure under construction) fades to a ghost so you never lose units
   * behind a block. Analytic ray-vs-box per building, so it costs nothing.
   */
  fadeOccluders(dt: number): void {
    const { world: w, rig } = this.ctx;
    const toCam = new THREE.Vector3();
    rig.camera.getWorldDirection(toCam).negate();
    const points: THREE.Vector3[] = [];
    for (const s of w.squads) if (s.alive) points.push(new THREE.Vector3(s.pos.x, 1, s.pos.y));
    for (const st of w.structures) if (st.alive && !st.built) points.push(new THREE.Vector3(st.pos.x, 0.8, st.pos.y));
    for (const h of w.hives) if (h.alive) points.push(new THREE.Vector3(h.pos.x, 1.5, h.pos.y));
    const ray = new THREE.Ray();
    const k = 1 - Math.exp(-10 * dt);
    for (const b of this.occluders) {
      let hides = false;
      for (const p of points) {
        // skip units standing inside the footprint's margin (e.g. on the sidewalk right next to it)
        ray.set(p, toCam);
        if (ray.intersectsBox(b.box) && !b.box.containsPoint(p)) {
          hides = true;
          break;
        }
      }
      const target = hides ? 0.18 : 1;
      b.opacity += (target - b.opacity) * k;
      if (Math.abs(b.opacity - target) < 0.01) b.opacity = target;
      const see = b.opacity < 0.99;
      if (see !== b.mat.transparent) {
        b.mat.transparent = see;
        b.mat.depthWrite = !see;
        b.mat.needsUpdate = true;
      }
      b.mat.opacity = b.opacity;
    }
  }
}
