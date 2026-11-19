import * as THREE from 'three';
import type { Vec2 } from '../core/math';
import { PAL } from './palette';

interface Fx {
  obj: THREE.Object3D;
  life: number;
  max: number;
  update: (t: number, fx: Fx) => void;
}

/**
 * Short-lived effects: tracers, explosions, blood, gas clouds, marker smoke, order markers. Each is a
 * scene object with a lifetime and an update; lifetimes run on sim time, so pausing freezes the battle.
 */
export class Effects {
  private fx: Fx[] = [];
  private tracers: { a: Vec2; b: Vec2; life: number; heavy: boolean }[] = [];
  private tracerGeo = new THREE.BufferGeometry();
  private tracerPos = new Float32Array(1024 * 6);
  private activeSprays = 0;
  /** Round 11 #127: muzzle flashes, two pooled point clouds (rifles/carbines, and big guns). Real time. */
  private flashes: { p: Vec2; life: number; big: boolean; shown: number }[] = [];
  private flashSets = [false, true].map((big) => {
    const pos = new Float32Array(512 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: flashTexture(), size: big ? 3.4 : 2.1, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd890 }));
    pts.frustumCulled = false;
    pts.renderOrder = 3;
    return { big, pos, geo, pts };
  });

  constructor(private scene: THREE.Scene) {
    this.tracerGeo.setAttribute('position', new THREE.BufferAttribute(this.tracerPos, 3));
    const tracerLines = new THREE.LineSegments(this.tracerGeo, new THREE.LineBasicMaterial({ color: PAL.tracer, transparent: true, opacity: 0.9 }));
    tracerLines.frustumCulled = false;
    this.scene.add(tracerLines);
    for (const f of this.flashSets) this.scene.add(f.pts);
  }

  /** A muzzle flash a little way out of the barrel, toward the target (round 11 #127). */
  muzzleFlash(from: Vec2, to: Vec2, big: boolean): void {
    if (this.flashes.length >= 1000) return;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const l = Math.hypot(dx, dy) || 1;
    // round 15 #188: bigger, a little longer, and always drawn for at least two frames (a 0.05 s flash timed in
    // real time could fall between frames entirely when the frame rate dips)
    this.flashes.push({ p: { x: from.x + (dx / l) * 0.75, y: from.y + (dy / l) * 0.75 }, life: big ? 0.1 : 0.08, big, shown: 0 });
  }

  tracer(from: Vec2, to: Vec2, heavy: boolean): void {
    if (this.tracers.length < 1000) this.tracers.push({ a: from, b: to, life: heavy ? 0.12 : 0.06, heavy });
  }

  private add(obj: THREE.Object3D, life: number, update: Fx['update']): void {
    this.scene.add(obj);
    this.fx.push({ obj, life, max: life, update });
  }

  explosion(p: Vec2, r: number, color: number, flash = true): void {
    // round 15 #188: a bright flash at the blast (a sprite, and a glow on the ground) for the first instant.
    // No real light: every extra light costs every lit pixel every frame, explosion or not.
    // Round 16 #192: not for a Bloater bursting (that's a gas puff, not a blast).
    if (flash) this.blastFlash(p, r);
    this.blastBall(p, r, color);
  }

  private blastFlash(p: Vec2, r: number): void {
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(), color: 0xfff2c8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    flash.position.set(p.x, 1.6, p.y);
    flash.renderOrder = 6;
    this.add(flash, 0.16, (_t, fx) => {
      const k = 1 - fx.life / fx.max;
      flash.scale.setScalar(r * (2.6 + k * 2.2));
      flash.material.opacity = 1 - k * k;
    });
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshBasicMaterial({ color: 0xffb860, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(p.x, 0.08, p.y);
    this.add(glow, 0.3, (_t, fx) => {
      const k = 1 - fx.life / fx.max;
      glow.scale.setScalar(r * (1.4 + k));
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k);
    });
  }

  private blastBall(p: Vec2, r: number, color: number): void {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.set(p.x, 1.2, p.y);
    this.add(m, 0.45, (t, fx) => {
      const k = 1 - fx.life / fx.max;
      m.scale.setScalar(0.3 + k * r);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      void t;
    });
    const scorch = new THREE.Mesh(new THREE.CircleGeometry(r * 0.6, 10), new THREE.MeshBasicMaterial({ color: 0x1a1814, transparent: true, opacity: 0.55, depthWrite: false }));
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.set(p.x, 0.05, p.y);
    this.add(scorch, 60, (_t, fx) => ((scorch.material as THREE.MeshBasicMaterial).opacity = 0.55 * Math.min(1, fx.life / 10)));
  }

  /** Death: a dark pool that spreads out under the body and slowly dries (v4.5). */
  splat(p: Vec2): void {
    if (this.fx.length > 700) return;
    const r = 0.7 + Math.random() * 0.6;
    const s = new THREE.Mesh(new THREE.CircleGeometry(1, 9), new THREE.MeshBasicMaterial({ color: 0x3e0c08, transparent: true, opacity: 0.8, depthWrite: false }));
    s.rotation.x = -Math.PI / 2;
    s.rotation.z = Math.random() * 6;
    s.position.set(p.x + (Math.random() - 0.5) * 0.4, 0.04 + Math.random() * 0.01, p.y + (Math.random() - 0.5) * 0.4);
    s.scale.set(0.2, 0.2 * (0.7 + Math.random() * 0.5), 1);
    this.add(s, 45, (_t, fx) => {
      const k = Math.min(1, (fx.max - fx.life) / 1.6); // spreads over ~1.6 s
      s.scale.x = r * (0.2 + 0.8 * k);
      s.scale.y = r * 0.85 * (0.2 + 0.8 * k);
      (s.material as THREE.MeshBasicMaterial).opacity = 0.8 * Math.min(1, fx.life / 10);
    });
  }

  /** Hit: a spurt of droplets thrown away from the shooter, plus a few spots on the ground (v4.5). */
  bleed(p: Vec2, from: Vec2 | undefined, heavy: boolean): void {
    if (this.activeSprays > 90 || this.fx.length > 700) return;
    this.activeSprays++;
    const away = from ? Math.atan2(p.y - from.y, p.x - from.x) : Math.random() * Math.PI * 2;
    const g = new THREE.Group();
    const n = heavy ? 9 : 5;
    const drops: { m: THREE.Mesh; vx: number; vy: number; vz: number }[] = [];
    const mat = new THREE.MeshBasicMaterial({ color: 0x7a1410 });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), mat);
      const a = away + (Math.random() - 0.5) * 1.1;
      const sp = 1.5 + Math.random() * (heavy ? 3.5 : 2.2);
      drops.push({ m, vx: Math.cos(a) * sp, vy: 1 + Math.random() * 2, vz: Math.sin(a) * sp });
      m.position.set(0, 1.2 + Math.random() * 0.3, 0);
      g.add(m);
    }
    g.position.set(p.x, 0, p.y);
    let last = 0;
    let done = false;
    this.add(g, 0.6, (t, fx) => {
      const dt = last ? Math.min(0.05, t - last) : 0.016;
      last = t;
      for (const d of drops) {
        d.vy -= 9.8 * dt;
        d.m.position.x += d.vx * dt;
        d.m.position.y = Math.max(0.03, d.m.position.y + d.vy * dt);
        d.m.position.z += d.vz * dt;
      }
      if (fx.life <= 0.02 && !done) {
        done = true;
        this.activeSprays--;
      }
    });
    if (Math.random() < 0.5) {
      // a couple of spots where it landed
      const spot = new THREE.Mesh(new THREE.CircleGeometry(0.18 + Math.random() * 0.15, 6), new THREE.MeshBasicMaterial({ color: 0x4a0e0a, transparent: true, opacity: 0.75, depthWrite: false }));
      spot.rotation.x = -Math.PI / 2;
      spot.position.set(p.x + Math.cos(away) * 1.2, 0.035, p.y + Math.sin(away) * 1.2);
      this.add(spot, 25, (_t, fx) => ((spot.material as THREE.MeshBasicMaterial).opacity = 0.75 * Math.min(1, fx.life / 6)));
    }
  }

  cloud(p: Vec2, r: number, dur: number): void {
    const c = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6), new THREE.MeshBasicMaterial({ color: 0x9fbf3a, transparent: true, opacity: 0.3, depthWrite: false }));
    c.scale.y = 0.4;
    c.position.set(p.x, 1, p.y);
    this.add(c, dur, (t, fx) => {
      (c.material as THREE.MeshBasicMaterial).opacity = 0.3 * Math.min(1, fx.life / 2);
      c.rotation.y = t * 0.3;
    });
  }

  /** Coloured marker smoke (doc §8: every call-in has its own colour). A billowing, drifting column. */
  smoke(p: Vec2, color: number, duration: number): void {
    const g = new THREE.Group();
    const puffs: { m: THREE.Mesh; phase: number; drift: number }[] = [];
    const geo = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, emissive: color, emissiveIntensity: 0.15 }));
      g.add(m);
      puffs.push({ m, phase: i / 14, drift: (i % 3) - 1 });
    }
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.35, 8), new THREE.MeshLambertMaterial({ color: 0x4a5a3a }));
    can.position.y = 0.18;
    g.add(can);
    g.position.set(p.x, 0, p.y);
    this.add(g, duration, (t, fx) => {
      const fade = Math.min(1, fx.life / 3);
      for (const pf of puffs) {
        const k = (t * 0.25 + pf.phase) % 1; // 0 at the can, 1 at the top of the column
        pf.m.position.set(k * 3 + pf.drift * k * 1.5, 0.6 + k * 11, pf.drift * 0.6 * k + k * 1.2);
        pf.m.scale.setScalar(0.6 + k * 2.4);
        (pf.m.material as THREE.MeshLambertMaterial).opacity = (1 - k) * 0.65 * fade;
      }
    });
  }

  /** A ring that pops where an order was given. */
  marker(p: Vec2, color: number): void {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.4, 20), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(p.x, 0.09, p.y);
    this.add(m, 0.6, (_t, fx) => {
      const k = 1 - fx.life / fx.max;
      m.scale.setScalar(1 + k * 1.5);
      (m.material as THREE.MeshBasicMaterial).opacity = 1 - k;
    });
  }

  /** Advance tracers (real time) and effects (sim time). */
  update(time: number, realDt: number, simDt: number): void {
    let n = 0;
    for (const t of this.tracers) {
      t.life -= realDt;
      if (t.life <= 0 || n >= 1024) continue;
      const o = n * 6;
      this.tracerPos.set([t.a.x, 1.3, t.a.y, t.b.x, 1.1, t.b.y], o);
      n++;
    }
    this.tracers = this.tracers.filter((t) => t.life > 0);
    this.tracerGeo.setDrawRange(0, n * 2);
    (this.tracerGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    for (const set of this.flashSets) {
      let k = 0;
      for (const fl of this.flashes) {
        if (fl.big !== set.big || (fl.life <= 0 && fl.shown >= 2) || k >= 512) continue;
        set.pos[k * 3] = fl.p.x;
        set.pos[k * 3 + 1] = 1.25;
        set.pos[k * 3 + 2] = fl.p.y;
        k++;
      }
      set.geo.setDrawRange(0, k);
      (set.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
    for (const fl of this.flashes) (fl.life -= realDt), fl.shown++;
    this.flashes = this.flashes.filter((fl) => fl.life > 0 || fl.shown < 2);

    for (const f of this.fx) {
      f.life -= simDt > 0 ? simDt : 0;
      f.update(time, f);
    }
    for (const f of this.fx)
      if (f.life <= 0) {
        this.scene.remove(f.obj);
        // round 15 (#47): free each finished effect's geometry and material (they're all made per effect;
        // textures such as the shared flash glow are left alone), so long fights don't pile up GPU memory
        f.obj.traverse((o) => {
          const m = o as THREE.Mesh;
          m.geometry?.dispose();
          for (const mat of ([] as THREE.Material[]).concat((m.material as THREE.Material | THREE.Material[] | undefined) ?? [])) mat.dispose();
        });
      }
    this.fx = this.fx.filter((f) => f.life > 0);
  }
}

/** Soft star-shaped glow for muzzle flashes (drawn once, shared). */
let flashTex: THREE.Texture | null = null;
function flashTexture(): THREE.Texture {
  if (flashTex) return flashTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,235,1)');
  grad.addColorStop(0.25, 'rgba(255,215,120,0.9)');
  grad.addColorStop(0.6, 'rgba(255,150,40,0.35)');
  grad.addColorStop(1, 'rgba(255,120,20,0)');
  g.fillStyle = grad;
  g.beginPath();
  // a four-pointed star over the round glow reads as a flash, not a light bulb
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 ? 9 : 31;
    g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(32, 32, 16, 0, Math.PI * 2);
  g.fill();
  flashTex = new THREE.CanvasTexture(c);
  return flashTex;
}
