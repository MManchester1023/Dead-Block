import * as THREE from 'three';
import type { Vec2 } from '../core/math';
import { isEnabled } from '../config/features';
import { BALANCE } from '../config/balance';
import type { World } from '../sim/World';
import { CameraRig } from './CameraRig';
import type { Flipbook } from './characters';
import { CityLayer } from './CityLayer';
import { Labels, type FrameState, type RenderCtx } from './context';
import { CrowdLayer } from './CrowdLayer';
import { Effects } from './Effects';
import { MAX_ZOMBIES, makeZombieMeshes } from './meshes';
import { PlacementGhost } from './PlacementGhost';
import { SupplyDrops } from './SupplyDrops';
import { Popups } from './Popups';
import { RouteLayer } from './RouteLayer';
import { VehicleLayer } from './VehicleLayer';
import { HiveLayer, SquadLayer, StructureLayer } from './UnitLayers';

export type Quality = 'high' | 'medium' | 'low';
/** STATUS #47: what each graphics quality setting draws. */
export const QUALITY: Record<Quality, { label: string; pixelCap: number; shadowMap: number; zombieShadows: number }> = {
  high: { label: 'High', pixelCap: 2, shadowMap: 4096, zombieShadows: 300 },
  medium: { label: 'Medium', pixelCap: 1.25, shadowMap: 2048, zombieShadows: 100 },
  low: { label: 'Low', pixelCap: 1, shadowMap: 1024, zombieShadows: 0 },
};
const SHADOW_HALF = 200; // metres either side of the camera target that get sun shadows

/**
 * The 3D view (STATUS #12: split into layers). This class owns the WebGL renderer, camera, lights and
 * the frame loop, and hands the work to one layer per kind of thing:
 *
 *   CityLayer       ground, buildings, props, fences, district tints; fades buildings that hide units
 *   CrowdLayer      animated soldiers, zombies and corpses (flipbook crowds)
 *   SquadLayer      selection rings and squad labels (plus box figures without models)
 *   StructureLayer  structures with their labels, lamps and turrets
 *   HiveLayer       hives
 *   SupplyDrops     crates, parachutes and the cargo plane's shadow
 *   Effects         tracers, explosions, blood, gas, smoke, order markers
 *   PlacementGhost  the build preview
 *
 * World (x, y) → scene (x, h, y). The renderer only reads the simulation; it never mutates it.
 */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig: CameraRig;

  /** Entity under the mouse (squad, structure or hive id): health bars only show on hover or selection (#35). */
  hovered: number | null = null;
  hoveredSquads: number[] = [];
  /** Where a right-drag formation would put the selected squads (round 14 #177). */
  formationPreview: { x: number; y: number }[] = [];
  /** Round 18 #214: ghosts of vehicles being right-dragged into place (where, which way they'll face). */
  vehicleGhosts: { x: number; y: number; face: number; defId: string }[] = [];
  /** Selected base building, so its bar shows too. */
  selectedStructure: number | null = null;

  private ctx: RenderCtx;
  private city: CityLayer;
  /** Animated character crowds (null → box placeholders, e.g. if the models failed to load). */
  private vehicles: VehicleLayer;
  private crowds: CrowdLayer | null = null;
  /** Box zombies, only without the character models. */
  private zombieMeshes = new Map<string, THREE.InstancedMesh>();
  private fx: Effects;
  private ghost: PlacementGhost;
  private squads: SquadLayer;
  private structures: StructureLayer;
  private hives: HiveLayer;
  private drops: SupplyDrops;
  private popups: Popups;
  private routes: RouteLayer;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private rallyFlag: THREE.Group;
  private tmpObj = new THREE.Object3D();
  private time = 0;

  constructor(container: HTMLElement, overlay: HTMLElement, private world: World, cast: Record<string, Flipbook> | null = null) {
    // full-resolution, anti-aliased isometric 3D (v4.3: the pixel-art filter was dropped)
    this.gl = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(Math.min(this.pixelCap, window.devicePixelRatio));
    this.gl.setSize(window.innerWidth, window.innerHeight);
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.gl.domElement);

    this.rig = new CameraRig({ w: world.map.width, h: world.map.height });
    this.scene.background = new THREE.Color(0x24262a);
    this.ctx = { scene: this.scene, overlay, world, rig: this.rig, labels: new Labels(this.rig) };

    this.hemi = new THREE.HemisphereLight(0xc8ccd0, 0x3a3428, 1.2);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
    this.sun.position.set(world.map.width / 2 - 66, 210, world.map.height / 2 + 114);
    this.sun.target.position.set(world.map.width / 2, 0, world.map.height / 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    const sc = this.sun.shadow.camera;
    // v4.10: the map is ~510 m wide now, so the shadow box follows the camera instead of covering it all
    sc.left = -SHADOW_HALF;
    sc.right = SHADOW_HALF;
    sc.top = SHADOW_HALF;
    sc.bottom = -SHADOW_HALF;
    sc.far = 600;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.2;
    this.scene.add(this.sun, this.sun.target);

    this.city = new CityLayer(this.ctx);
    if (cast) this.crowds = new CrowdLayer(this.scene, world, cast);
    else {
      this.zombieMeshes = makeZombieMeshes();
      for (const m of this.zombieMeshes.values()) this.scene.add(m);
    }
    this.fx = new Effects(this.scene);
    this.ghost = new PlacementGhost(this.scene);

    // Barracks rally flag (round 4 #36): pole + blue pennant, follows world.map.rally
    this.rallyFlag = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 6), new THREE.MeshLambertMaterial({ color: 0x3a3a3a }));
    pole.position.y = 1.5;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshLambertMaterial({ color: 0x4a7ab8, side: THREE.DoubleSide }));
    cloth.position.set(0.6, 2.6, 0);
    this.rallyFlag.add(pole, cloth);
    this.scene.add(this.rallyFlag);

    this.squads = new SquadLayer(this.ctx, !this.crowds);
    this.structures = new StructureLayer(this.ctx, (p) => this.fx.explosion(p, 1.5, 0x9a8a6a));
    this.hives = new HiveLayer(this.ctx);
    this.vehicles = new VehicleLayer(this.ctx);
    this.drops = new SupplyDrops(this.scene, world);
    this.popups = new Popups(this.ctx);
    this.routes = new RouteLayer(this.ctx);

    this.hookEvents();
    window.addEventListener('resize', () => this.resize());
  }

  // ---------------------------------------------------------------- events → fx

  private hookEvents(): void {
    const ev = this.world.events;
    ev.on('shot', (e) => {
      // round 18 #210: a vehicle's shots come out of its turret's muzzle, not the middle of the vehicle
      const m = e.shooter != null ? this.vehicles.muzzle(e.shooter) : null;
      const from = m ?? e.from;
      this.fx.tracer(from, e.to, !!e.heavy, m?.h);
      this.fx.muzzleFlash(from, e.to, !!e.heavy || e.weapon === 'Mounted HMG', m?.h, !!m);
    });
    ev.on('explosion', (e) => this.fx.explosion(e.pos, e.radius, e.type === 'toxic' ? 0x8fbf3a : 0xffa040, e.type !== 'toxic'));
    // a tutorial region opens: the fence comes down in a cloud of dust
    ev.on('districtUnlocked', (e) => {
      for (const b of this.city.removeFence(e.districtId)) {
        const vertical = b.h > b.w;
        for (let s = 6; s < (vertical ? b.h : b.w); s += 24) this.fx.smoke(vertical ? { x: b.x + b.w / 2, y: b.y + s } : { x: b.x + s, y: b.y + b.h / 2 }, 0x9a8a6a, 3);
      }
    });
    // round 20 #236 (owner): no spray-painted X after a search any more (it was v4.9 #46)
    ev.on('zombieKilled', (e) => {
      this.fx.splat(e.pos);
      this.crowds?.zombieDied(e);
    });
    ev.on('memberKilled', (e) => this.crowds?.memberDied(e));
    ev.on('toxicCloud', (e) => this.fx.cloud(e.pos, e.radius, e.duration));
    ev.on('smoke', (e) => this.fx.smoke(e.pos, e.color, e.duration));
    ev.on('bleed', (e) => this.fx.bleed(e.pos, e.from, e.heavy));
  }

  // ---------------------------------------------------------------- called by the game / input

  /** A ring where an order was given. */
  marker(p: Vec2, color: number): void {
    this.fx.marker(p, color);
  }

  /** Build preview under the cursor (null hides it). */
  setGhost(tile: { x: number; y: number } | null, size = { w: 1, h: 1 }, ok = true, range = 0, arc?: { aim: number; deg: number }, exit?: { x: number; y: number; face: number } | null): void {
    this.ghost.set(tile, size, ok, range, arc, exit);
  }

  /** Squad whose name label is under this screen point (clicking a name selects it; #39). */
  squadAtLabel(x: number, y: number): number | null {
    return this.squads.atLabel(x, y);
  }

  // ---------------------------------------------------------------- frame

  render(realDt: number, simDt: number, selected: Set<number>): void {
    this.time += realDt;
    const w = this.world;
    const f: FrameState = { time: this.time, realDt, simDt, selected, hovered: this.hovered, hoveredSquads: this.hoveredSquads, selectedStructure: this.selectedStructure };
    this.rig.apply(realDt);
    {
      // keep the sun's shadow box centred on what the camera looks at (snapped to texels to avoid shimmer)
      const step = (SHADOW_HALF * 2) / this.sun.shadow.mapSize.x;
      const tx = Math.round(this.rig.target.x / step) * step;
      const tz = Math.round(this.rig.target.z / step) * step;
      this.sun.position.set(tx - 66, 210, tz + 114);
      this.sun.target.position.set(tx, 0, tz);
    }
    this.rallyFlag.position.set(w.map.rally.x, 0, w.map.rally.y);
    this.rallyFlag.rotation.y = Math.sin(this.time * 1.3) * 0.15;
    this.crowds?.update(simDt);
    this.city.update(); // stream city chunks in and out around the camera (STATUS #14)
    this.city.fadeOccluders(realDt);
    this.squads.update(f);
    if (!this.crowds) this.updateBoxZombies();
    this.structures.update(f);
    this.hives.update(f);
    this.vehicles.update(f, this.vehicleGhosts);
    this.drops.update();
    this.popups.update(realDt);
    this.routes.update(f, this.formationPreview);
    this.city.updateDistricts();
    this.fx.update(this.time, realDt, simDt);
    if (isEnabled('dayNight')) this.applyTimeOfDay(w.dayTimer / BALANCE.economy.dayLengthSec);
    const d0 = performance.now();
    this.gl.render(this.scene, this.rig.camera);
    this.drawMs = performance.now() - d0;
  }

  /** STATUS #47: the highest pixel ratio drawn (2 on High; lower settings draw fewer pixels on high-DPI screens). */
  private pixelCap = 2;
  quality: Quality = 'high';

  /**
   * STATUS #47: graphics quality (Settings). High is the look so far; Medium and Low draw fewer pixels on
   * high-DPI screens, use a smaller sun shadow map, and let fewer (or no) zombies cast shadows.
   */
  setQuality(q: Quality): void {
    const Q = QUALITY[q];
    this.quality = q;
    this.pixelCap = Q.pixelCap;
    this.gl.setPixelRatio(Math.min(this.pixelCap, window.devicePixelRatio));
    this.gl.setSize(window.innerWidth, window.innerHeight);
    if (this.sun.shadow.mapSize.x !== Q.shadowMap) {
      this.sun.shadow.mapSize.set(Q.shadowMap, Q.shadowMap);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null; // three makes a new one at the new size
    }
    this.crowds?.setZombieShadows(Q.zombieShadows);
  }

  /** STATUS #47: milliseconds the last gl.render call took on the CPU (the frame's draw submission). */
  drawMs = 0;

  /** STATUS #47: what the last frame drew. */
  get drawInfo(): { calls: number; triangles: number } {
    return { calls: this.gl.info.render.calls, triangles: this.gl.info.render.triangles };
  }

  /** Placeholder zombies (only when the character models aren't loaded). */
  private updateBoxZombies(): void {
    const counts: Record<string, number> = { walker: 0, runner: 0, bloater: 0 };
    for (const z of this.world.zombies) {
      if (!z.alive) continue;
      const type = this.zombieMeshes.has(z.def.id) ? z.def.id : 'walker';
      const mesh = this.zombieMeshes.get(type)!;
      const i = counts[type]++;
      if (i >= MAX_ZOMBIES) continue;
      const lurch = z.state === 'idle' ? 0 : Math.sin(this.time * (z.def.speed * 4) + z.id) * 0.12;
      this.tmpObj.position.set(z.pos.x, 0, z.pos.y);
      this.tmpObj.rotation.set(0, -z.facing, lurch);
      this.tmpObj.scale.setScalar(z.state === 'attack' ? 1.05 : 1);
      this.tmpObj.updateMatrix();
      mesh.setMatrixAt(i, this.tmpObj.matrix);
    }
    for (const [t, mesh] of this.zombieMeshes) {
      mesh.count = Math.min(MAX_ZOMBIES, counts[t]);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** Tier 2 hook (doc §14): day/night lighting from the in-game day fraction. */
  private applyTimeOfDay(f: number): void {
    const daylight = Math.max(0.12, Math.sin(f * Math.PI));
    this.sun.intensity = 2.2 * daylight;
    this.hemi.intensity = 0.4 + 0.8 * daylight;
  }

  // ---------------------------------------------------------------- picking

  worldToScreen(p: Vec2): { x: number; y: number } {
    const v = new THREE.Vector3(p.x, 1, p.y).project(this.rig.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }

  screenToGround(sx: number, sy: number): Vec2 {
    const ndc = new THREE.Vector2((sx / window.innerWidth) * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.rig.camera);
    const t = -ray.ray.origin.y / ray.ray.direction.y;
    const hit = ray.ray.origin.clone().addScaledVector(ray.ray.direction, t);
    return { x: hit.x, y: hit.z };
  }

  resize(): void {
    this.gl.setPixelRatio(Math.min(this.pixelCap, window.devicePixelRatio));
    this.gl.setSize(window.innerWidth, window.innerHeight);
    this.rig.resize(window.innerWidth, window.innerHeight);
  }
}
