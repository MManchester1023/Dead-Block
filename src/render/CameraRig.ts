import * as THREE from 'three';
import { clamp, type Vec2 } from '../core/math';

/**
 * Isometric orthographic camera that can rotate around its target (doc §14 v4.1).
 * One camera covers both the strategic overview and street level (doc §2 "seamless zoom"):
 * zooming out past STRATEGIC_ZOOM switches the HUD into operations-map mode, same live sim.
 * All distances in metres.
 */
export const STRATEGIC_ZOOM = 0.95;

const PITCH_RISE = 1.25; // camera height per unit of horizontal offset (≈ 41.5° elevation)
const DISTANCE = 400;

export class CameraRig {
  readonly camera: THREE.OrthographicCamera;
  target = new THREE.Vector3(100, 0, 108);
  zoom = 1.6;
  minZoom = 0.55;
  maxZoom = 6;
  /** Current and goal yaw (radians). 45° = looking from the south-east, the original view. */
  yaw = Math.PI / 4;
  private goalYaw = Math.PI / 4;
  private readonly viewHeight = 138; // metres visible vertically at zoom 1

  constructor(private bounds: { w: number; h: number }) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1500);
    this.resize(window.innerWidth, window.innerHeight);
    this.apply(0);
  }

  get strategic(): boolean {
    return this.zoom < STRATEGIC_ZOOM;
  }

  /** Compass heading the camera faces, degrees, 0 = north (−y), clockwise. */
  get headingDeg(): number {
    // the camera looks along −(cos yaw, sin yaw) on the ground
    const dx = -Math.cos(this.yaw);
    const dy = -Math.sin(this.yaw);
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    return (deg + 360) % 360;
  }

  get headingLabel(): string {
    const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return names[Math.round(this.headingDeg / 45) % 8];
  }

  resize(w: number, h: number): void {
    const aspect = w / h;
    const vh = this.viewHeight / 2;
    this.camera.left = -vh * aspect;
    this.camera.right = vh * aspect;
    this.camera.top = vh;
    this.camera.bottom = -vh;
    this.camera.updateProjectionMatrix();
  }

  /** Ground-plane unit vectors for screen-right and screen-up at the current yaw. */
  private basis() {
    const right = new THREE.Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const up = new THREE.Vector3(-Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    return { right, up };
  }

  /** Pan in screen space (pixels → metres). */
  panScreen(dxPx: number, dyPx: number, viewportH: number): void {
    const worldPerPx = this.viewHeight / this.zoom / viewportH;
    const { right, up } = this.basis();
    // screen-up projected onto the ground is stretched by the camera pitch
    const pitchStretch = 1 / Math.sin(Math.atan2(PITCH_RISE, Math.SQRT2));
    this.target.addScaledVector(right, dxPx * worldPerPx);
    this.target.addScaledVector(up, -dyPx * worldPerPx * pitchStretch);
    this.clampTarget();
  }

  zoomBy(factor: number): void {
    this.zoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);
  }

  /** Rotate by quarter turns (Q / E). Smoothly animated in apply(). */
  rotate(quarterTurns: number): void {
    this.goalYaw += (quarterTurns * Math.PI) / 2;
  }

  focus(p: Vec2): void {
    this.target.set(p.x, 0, p.y);
    this.clampTarget();
  }

  toggleStrategic(): void {
    if (this.strategic) this.zoom = 1.8;
    else {
      this.zoom = 0.6;
      this.target.set(this.bounds.w / 2, 0, this.bounds.h / 2);
    }
  }

  private clampTarget(): void {
    this.target.x = clamp(this.target.x, 0, this.bounds.w);
    this.target.z = clamp(this.target.z, 0, this.bounds.h);
  }

  apply(dt: number): void {
    // ease toward the goal yaw
    const k = dt > 0 ? 1 - Math.exp(-10 * dt) : 1;
    this.yaw += (this.goalYaw - this.yaw) * k;
    if (Math.abs(this.goalYaw - this.yaw) < 1e-4) this.yaw = this.goalYaw;

    const h = Math.SQRT2;
    const off = new THREE.Vector3(h * Math.cos(this.yaw), PITCH_RISE, h * Math.sin(this.yaw)).normalize().multiplyScalar(DISTANCE);
    this.camera.zoom = this.zoom;
    this.camera.position.copy(this.target).add(off);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
  }
}
