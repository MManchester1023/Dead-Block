import * as THREE from 'three';
import { clamp, type Vec2 } from '../core/math';

/**
 * Isometric orthographic camera. One camera covers both the strategic overview and the
 * street-level view (doc §2 "seamless zoom"): zooming out past STRATEGIC_ZOOM switches
 * the HUD into operations-map mode, but it is the same live simulation.
 */
export const STRATEGIC_ZOOM = 0.95;

export class CameraRig {
  readonly camera: THREE.OrthographicCamera;
  target = new THREE.Vector3(30, 0, 36);
  zoom = 1.6;
  minZoom = 0.55;
  maxZoom = 4.5;
  private readonly offset = new THREE.Vector3(1, 1.25, 1).normalize().multiplyScalar(120);
  private readonly viewHeight = 46; // world units visible vertically at zoom 1

  constructor(private bounds: { w: number; h: number }) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    this.resize(window.innerWidth, window.innerHeight);
    this.apply();
  }

  get strategic(): boolean {
    return this.zoom < STRATEGIC_ZOOM;
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

  /** Pan in screen space (pixels → world). */
  panScreen(dxPx: number, dyPx: number, viewportH: number): void {
    const worldPerPx = this.viewHeight / this.zoom / viewportH;
    const right = new THREE.Vector3(1, 0, -1).normalize();
    // screen-up projected onto the ground plane is stretched by the camera pitch
    const up = new THREE.Vector3(-1, 0, -1).normalize();
    const pitchStretch = 1 / Math.sin(Math.atan2(1.25, Math.SQRT2));
    this.target.addScaledVector(right, dxPx * worldPerPx);
    this.target.addScaledVector(up, -dyPx * worldPerPx * pitchStretch);
    this.clampTarget();
  }

  zoomBy(factor: number): void {
    this.zoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);
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

  apply(): void {
    this.camera.zoom = this.zoom;
    this.camera.position.copy(this.target).add(this.offset);
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
  }
}
