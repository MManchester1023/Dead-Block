import * as THREE from 'three';
import type { Vec2 } from '../core/math';
import type { World } from '../sim/World';
import type { CameraRig } from './CameraRig';

/**
 * What every render layer shares (STATUS #12: the renderer split into layers). The renderer only reads
 * the simulation; it never mutates it.
 */
export interface RenderCtx {
  scene: THREE.Scene;
  /** HTML overlay for name labels and bars. */
  overlay: HTMLElement;
  world: World;
  rig: CameraRig;
  labels: Labels;
}

/** Per-frame view state the layers read: what's hovered and selected, and the frame clocks. */
export interface FrameState {
  /** Real seconds since start (UI pulses, flag sway). */
  time: number;
  realDt: number;
  /** Sim seconds this frame (0 while paused): fx and animation follow the battle's pace. */
  simDt: number;
  selected: Set<number>;
  hovered: number | null;
  selectedStructure: number | null;
}

/** HTML labels pinned to points in the world (squad names, bars, district names). */
export class Labels {
  private cache = new WeakMap<HTMLElement, string>();

  constructor(private rig: CameraRig) {}

  /** Put `el` above world point `p` at height `h`; `html` is only called (and the DOM touched) when on screen. */
  place(el: HTMLElement, p: Vec2, h: number, html: () => string): void {
    const v = new THREE.Vector3(p.x, h, p.y).project(this.rig.camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    const off = x < -50 || y < -50 || x > window.innerWidth + 50 || y > window.innerHeight + 50;
    el.style.display = off ? 'none' : 'block';
    if (off) return;
    el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px) translate(-50%, -100%)`;
    const s = html();
    if (this.cache.get(el) !== s) {
      el.innerHTML = s;
      this.cache.set(el, s);
    }
  }

  /** A new label element in the overlay. */
  make(overlay: HTMLElement, className: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = className;
    overlay.appendChild(el);
    return el;
  }
}
