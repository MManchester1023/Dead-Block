import * as THREE from 'three';
import type { Vec2 } from '../core/math';
import type { FrameState, RenderCtx } from './context';

const MAX_SEG = 1024;
const WAY = new THREE.Color(0x9fe07a);
const PATROL = new THREE.Color(0xe0b24a);
const PREVIEW = new THREE.Color(0x7ab0e0);
/** Orders that lead somewhere (their `pos` is drawn as a waypoint). */
const GOES = new Set(['move', 'attackMove', 'cover', 'search', 'garrison', 'build', 'repair', 'deconstruct', 'charge', 'upgrade', 'disband']);

/**
 * Routes of the selected squads (round 14 #176): queued waypoints as a green line through numbered
 * markers, patrols as an amber closed loop. Rebuilt every frame from the squads' own orders.
 */
export class RouteLayer {
  private pos = new Float32Array(MAX_SEG * 6);
  private col = new Float32Array(MAX_SEG * 6);
  private geo = new THREE.BufferGeometry();
  private markers: THREE.Mesh[] = [];
  private nums: HTMLDivElement[] = [];
  private markerGeo = new THREE.RingGeometry(0.55, 0.85, 20);

  constructor(private ctx: RenderCtx) {
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const lines = new THREE.LineSegments(this.geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false }));
    lines.frustumCulled = false;
    lines.renderOrder = 4;
    ctx.scene.add(lines);
  }

  update(f: FrameState, preview: Vec2[] = []): void {
    const { world: w, scene, labels, overlay } = this.ctx;
    let n = 0;
    let m = 0;
    const seg = (a: Vec2, b: Vec2, c: THREE.Color) => {
      if (n >= MAX_SEG) return;
      this.pos.set([a.x, 0.18, a.y, b.x, 0.18, b.y], n * 6);
      this.col.set([c.r, c.g, c.b, c.r, c.g, c.b], n * 6);
      n++;
    };
    const mark = (p: Vec2, c: THREE.Color, label: string) => {
      let mesh = this.markers[m];
      if (!mesh) {
        mesh = new THREE.Mesh(this.markerGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = 4;
        scene.add(mesh);
        this.markers.push(mesh);
        this.nums.push(labels.make(overlay, 'wp-num'));
      }
      mesh.visible = true;
      (mesh.material as THREE.MeshBasicMaterial).color.copy(c);
      mesh.position.set(p.x, 0.2, p.y);
      const el = this.nums[m];
      if (label) labels.place(el, p, 0.4, () => label);
      else el.style.display = 'none';
      m++;
    };
    for (const s of w.squads) {
      if (!s.alive || !f.selected.has(s.id)) continue;
      let from: Vec2 = s.pos;
      let k = 0;
      for (const o of s.orders) {
        if (o.type === 'patrol' && o.route) {
          const r = o.route;
          for (let i = 0; i < r.length; i++) {
            seg(r[i], r[(i + 1) % r.length], PATROL);
            mark(r[i], PATROL, '');
          }
          seg(from, r[(o.leg ?? 0) % r.length], PATROL);
          break;
        }
        if (!GOES.has(o.type)) continue;
        seg(from, o.pos, WAY);
        k++;
        // a lone order needs no number; a chain of waypoints is numbered
        mark(o.pos, WAY, s.orders.length > 1 ? String(k) : '');
        from = o.pos;
      }
    }
    // a right-drag formation being laid out (round 14 #177): a ring where each squad will stand
    for (const p of preview) mark(p, PREVIEW, '');
    for (let i = m; i < this.markers.length; i++) {
      this.markers[i].visible = false;
      this.nums[i].style.display = 'none';
    }
    this.geo.setDrawRange(0, n * 2);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}
