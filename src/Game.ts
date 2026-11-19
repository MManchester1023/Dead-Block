import { BALANCE } from './config/balance';
import { STRUCTURES } from './config/units';
import { dist, type Vec2 } from './core/math';
import { World } from './sim/World';
import { loadWorld, saveWorld, type SaveData } from './sim/save';
import { Squad } from './sim/entities';
import { Renderer } from './render/Renderer';
import type { Flipbook } from './render/characters';
import { callSupport } from './sim/systems/support';
import { formationSlots } from './sim/rules/commands';
import type { Formation, FormationShape } from './sim/types';
import type { Targetable } from './sim/types';

export type Mode =
  | { kind: 'normal' }
  | { kind: 'attackMove' }
  | { kind: 'build'; defId: string; rotated: boolean; aim: number }
  | { kind: 'charge' }
  | { kind: 'deconstruct' }
  | { kind: 'support'; id: string }
  | { kind: 'rally' }
  /** Round 14 #174: clicking patrol points; `started` once the first point is down (later clicks add to the loop). */
  | { kind: 'patrol'; started: boolean }
  /** STATUS #20: medics pick a squad to treat. */
  | { kind: 'heal' };

/**
 * Owns the fixed-step loop, pause/speed (doc §2), the current selection and the
 * input mode. Input and HUD talk to the world only through here.
 */
const SELECTABLE = new Set(['commandPost', 'barracks', 'outpost', 'vehicleBay']);

/** Something squads can hide behind: an abandoned car, a pump island, or built sandbags/walls. */
interface CoverSpot {
  id: number;
  pos: Vec2;
  /** Long axis runs east-west. */
  horiz: boolean;
  /** Positions along the long axis (metres from the centre) where a squad can shelter. */
  slots: number[];
}

const CAR_SLOTS = [-1.4, 1.4];
const WALL_SLOTS = [0, -3, 3];

function allCover(w: World): CoverSpot[] {
  const out: CoverSpot[] = w.map.props.map((c) => ({ id: c.id, pos: c.pos, horiz: c.w > c.h, slots: CAR_SLOTS }));
  for (const st of w.structures)
    if (st.alive && st.built && st.def.cover && st.def.id !== 'mgNest' && !st.def.garrison) out.push({ id: st.id, pos: st.pos, horiz: st.size.w > st.size.h, slots: WALL_SLOTS });
  return out;
}

function coverAt(w: World, p: Vec2): CoverSpot | undefined {
  const prop = w.map.props.find((c) => dist(c.pos, p) < 3);
  if (prop) return { id: prop.id, pos: prop.pos, horiz: prop.w > prop.h, slots: CAR_SLOTS };
  const st = w.structureAt(p, (s) => s.built && !!s.def.cover && s.def.id !== 'mgNest' && !s.def.garrison, 1.5);
  return st ? { id: st.id, pos: st.pos, horiz: st.size.w > st.size.h, slots: WALL_SLOTS } : undefined;
}

/** Just behind the cover, on the side facing `from` (where the squads are coming from). */
function coverSpot(c: CoverSpot, from: Vec2, along = 0): Vec2 {
  return c.horiz
    ? { x: c.pos.x + along, y: c.pos.y + Math.sign(from.y - c.pos.y || 1) * 3 }
    : { x: c.pos.x + Math.sign(from.x - c.pos.x || 1) * 3, y: c.pos.y + along };
}

export class Game {
  readonly world: World;
  readonly renderer: Renderer;
  selected = new Set<number>();
  /** A selected building (e.g. the Command Post for support powers). */
  selectedStructure: number | null = null;
  groups = new Map<number, number[]>();
  /** Pause menu (round 10 #105): set by the HUD; Esc with nothing else to cancel calls it. */
  openMenu: (() => void) | null = null;
  menuOpen = false;
  mode: Mode = { kind: 'normal' };
  /** The shape several squads move in (round 14 #177); set from the squad panel, remembered. */
  formation: FormationShape = 'line';
  paused = true;
  speed = 1;
  private acc = 0;
  private last = performance.now();
  private listeners: (() => void)[] = [];
  toast: (msg: string) => void = () => {};

  /** Set when this session started from a save (STATUS #16): the HUD skips the intro. */
  loadedFrom: SaveData | null = null;

  constructor(container: HTMLElement, overlay: HTMLElement, cast: Record<string, Flipbook> | null = null, save: SaveData | null = null) {
    this.world = save ? loadWorld(save, 1337) : new World({ seed: 1337 });
    this.loadedFrom = save;
    this.renderer = new Renderer(container, overlay, this.world, cast);
    this.renderer.rig.focus({ x: 102, y: 108 });
    if (save?.view) {
      const r = this.renderer.rig;
      r.target.set(save.view.x, 0, save.view.z);
      r.zoom = save.view.zoom;
      r.yaw = save.view.yaw;
      this.speed = save.view.speed;
    }
    this.world.events.on('squadWiped', (e) => this.selected.delete(e.squadId));
  }

  /** Everything needed to pick this game up again (STATUS #16). */
  snapshot(): SaveData {
    const r = this.renderer.rig;
    return saveWorld(this.world, { x: r.target.x, z: r.target.z, zoom: r.zoom, yaw: r.yaw, speed: this.speed });
  }

  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }
  changed(): void {
    for (const fn of this.listeners) fn();
  }

  get selectedSquads(): Squad[] {
    return this.world.squads.filter((s) => this.selected.has(s.id) && s.alive);
  }

  /** True when the selection is engineers and nothing else (only they can build; v4.9 #61). */
  get engineersOnly(): boolean {
    const sq = this.selectedSquads;
    return sq.length > 0 && sq.every((s) => s.def.id === 'engineer');
  }

  /** STATUS #20: selected squads that can Heal. */
  get selectedMedics(): Squad[] {
    return this.selectedSquads.filter((s) => s.def.abilities?.includes('heal'));
  }

  /** STATUS #20: the selected medics treat this squad (Heal mode click, or a right-click on a hurt squad). */
  healSquad(id: number, queue = false): boolean {
    const t = this.world.squads.find((s) => s.id === id && s.alive);
    const medics = this.selectedMedics;
    if (!t || !medics.length || t.def.category === 'civilian') return false;
    const err = this.world.orderHeal(medics, t, queue);
    if (err) this.toast(err);
    else this.renderer.marker(t.pos, 0x6fd08a);
    this.changed();
    return !err;
  }

  /** STATUS #51: U / the Unload button: the selected vehicles' passengers climb out. */
  unload(): void {
    const vehicles = this.selectedSquads.filter((s) => s.def.seats);
    if (!vehicles.length) return;
    const err = this.world.orderUnload(vehicles);
    if (err) this.toast(err);
    this.changed();
  }

  /** STATUS #20: K / the Heal button. */
  startHeal(): void {
    if (!this.selectedMedics.length) {
      this.toast('Select a Medic Team to heal');
      return;
    }
    this.setMode({ kind: 'heal' });
    this.toast('Heal: click a hurt squad');
  }

  get selectedEngineers(): Squad[] {
    return this.selectedSquads.filter((s) => s.def.canBuild?.length);
  }

  select(ids: number[], add = false): void {
    if (!add) this.selected.clear();
    // STATUS #51: squads riding in a vehicle aren't selectable (select the vehicle)
    ids = ids.filter((id) => this.world.squads.find((s) => s.id === id)?.inVehicle == null);
    if (ids.length || !add) this.selectedStructure = null;
    for (const id of ids) this.selected.add(id);
    if (this.mode.kind !== 'normal' && !this.selectedEngineers.length && this.mode.kind !== 'attackMove' && this.mode.kind !== 'patrol' && this.mode.kind !== 'rally' && this.mode.kind !== 'support' && !(this.mode.kind === 'heal' && this.selectedMedics.length)) this.mode = { kind: 'normal' };
    this.changed();
  }

  setMode(m: Mode): void {
    this.mode = m;
    if (m.kind !== 'build') this.renderer.setGhost(null);
    this.changed();
  }

  setSpeed(s: number): void {
    this.speed = Math.max(1, Math.min(BALANCE.maxSpeed, s));
    this.changed();
  }

  togglePause(): void {
    this.paused = !this.paused;
    this.changed();
  }

  // ---- commands ----

  commandAt(p: Vec2, queue: boolean): void {
    let sq = this.selectedSquads;
    if (!sq.length) return;
    const w = this.world;
    // civilians (STATUS #10) only ever walk; at the Command Post they're evacuated
    const civ = sq.filter((s) => s.def.category === 'civilian');
    if (civ.length) {
      w.issueOrder(civ, { type: 'move', pos: w.grid.nearestFree(p) }, queue);
      sq = sq.filter((s) => !civ.includes(s));
      if (!sq.length) {
        this.renderer.marker(p, 0x9fd0ff);
        return;
      }
    }

    // STATUS #51: infantry right-clicking a Humvee climb in
    const veh = w.squads.find((v) => v.alive && v.def.seats && !sq.includes(v) && dist(v.pos, p) < 3.5);
    if (veh) {
      const riders = sq.filter((s) => s.def.category === 'infantry');
      if (riders.length) {
        const err = w.orderBoard(riders, veh, queue);
        if (err) this.toast(err);
        else this.renderer.marker(veh.pos, 0x7ab0e0);
        sq = sq.filter((s) => !riders.includes(s));
        if (!sq.length) return;
      }
    }
    // STATUS #51: vehicles just drive there (or go for the zombie you clicked): no cover, towers or searching
    const vehicles = sq.filter((s) => s.def.category === 'vehicle');
    if (vehicles.length) {
      const z = w.zombieHash.query(p, 2.2).filter((x) => x.alive).sort((a, b) => dist(a.pos, p) - dist(b.pos, p))[0];
      if (z) w.orderAttack(vehicles, z, queue);
      else w.issueOrder(vehicles, { type: 'move', pos: w.grid.nearestFree(p) }, queue, { shape: this.formation });
      sq = sq.filter((s) => !vehicles.includes(s));
      if (!sq.length) {
        this.renderer.marker(p, 0x9fe07a);
        return;
      }
    }

    const hive = w.hives.find((h) => h.alive && dist(h.pos, p) < h.radius + 2);
    if (hive) {
      const eng = sq.filter((s) => s.def.abilities?.includes('demoCharge'));
      const others = sq.filter((s) => !eng.includes(s));
      if (eng.length) {
        const err = w.orderCharge(eng, hive, queue);
        if (err) this.toast(err);
      }
      if (others.length) w.issueOrder(others, { type: 'attackMove', pos: w.grid.nearestFree(hive.pos) }, queue);
      if (!eng.length) this.toast('Bullets bounce off hives — bring engineers with demo charges');
      this.renderer.marker(hive.pos, 0xd2443a);
      return;
    }

    // engineers + right-click own structure: resume an unfinished site, or repair damage (v4.4)
    const eng = sq.filter((s) => s.def.canBuild?.length);
    // (a power station counts too: engineers restore it, v4.17)
    const own = w.structureAt(p, (s) => s.def.cost.money + s.def.cost.supplies > 0 || !!s.def.restore || !!s.def.derelict); // (STATUS #50: the run-down Med Bay)
    // round 12 #138: an outpost without its Garrison: the engineers install it
    if (eng.length && own && own.built && own.hp >= own.def.hp && own.def.upgrade && !own.upgraded) {
      const err = w.orderUpgrade(eng, own, queue);
      if (err) this.toast(err);
      else this.renderer.marker(own.pos, 0xd0c070);
      const rest = sq.filter((s) => !eng.includes(s));
      if (!rest.length) return;
      sq = rest;
    }
    if (eng.length && own && (!own.built || own.hp < own.def.hp)) {
      const err = own.built ? w.orderRepair(eng, own, queue) : w.orderResume(eng, own, queue);
      if (err) this.toast(err);
      this.renderer.marker(own.pos, 0xd0c070);
      const rest = sq.filter((s) => !eng.includes(s));
      if (!rest.length) return;
      sq = rest; // everyone else falls through to the normal command (e.g. take cover)
    }

    // right-click a guard tower: the first infantry squad climbs up (v4.13)
    const tower = w.structureAt(p, (s) => !!s.def.garrison);
    if (tower) {
      const err = w.orderGarrison(sq, tower, queue);
      if (err) this.toast(err);
      else this.renderer.marker(tower.pos, 0x7ab0e0);
      return;
    }

    // right-click a zombie: everyone selected focuses it (v4.2)
    let zed: Targetable | null = null;
    let zd = 2.2;
    for (const z of w.zombieHash.query(p, 2.2)) {
      const d = dist(z.pos, p);
      if (z.alive && d < zd) {
        zed = z;
        zd = d;
      }
    }
    if (zed) {
      w.orderAttack(sq, zed, queue);
      this.renderer.marker(zed.pos, 0xd2443a);
      return;
    }

    // take cover (round 7 #81): every selected squad gets its own car / pump / sandbags. The clicked
    // one goes to the first squad, the rest take the nearest other cover, all on the same side.
    const clicked = coverAt(w, p);
    if (clicked) {
      const n = sq.length;
      const center = sq.reduce((a, s) => ({ x: a.x + s.pos.x / n, y: a.y + s.pos.y / n }), { x: 0, y: 0 });
      const others = allCover(w)
        .filter((c) => c.id !== clicked.id && dist(c.pos, clicked.pos) < 25)
        .sort((a, b) => dist(a.pos, clicked.pos) - dist(b.pos, clicked.pos));
      // a car shelters two squads (one at each end), a sandbag wall three; places other squads already
      // hold don't count (round 11 #126)
      const held = (c: CoverSpot) => w.squads.filter((q) => q.alive && !sq.includes(q) && q.coverPropId === c.id).length;
      const spots = [clicked, ...others].flatMap((c) => c.slots.slice(held(c)).map((along) => ({ ...c, along })));
      // closest squad to the clicked cover takes it, and so on
      const order = [...sq].sort((a, b) => dist(a.pos, clicked.pos) - dist(b.pos, clicked.pos));
      order.forEach((s, i) => {
        const c = spots[i];
        if (c) w.issueOrder([s], { type: 'cover', pos: w.grid.nearestFree(coverSpot(c, center, c.along)), targetId: c.id }, queue);
        // round 11 #126: no room left: crouch in the open just behind the cover (half the protection)
        else w.issueOrder([s], { type: 'cover', pos: w.grid.nearestFree({ x: clicked.pos.x + (i - n / 2) * 3, y: clicked.pos.y + Math.sign(center.y - clicked.pos.y || 1) * 6 }) }, queue);
      });
      if (sq.length > spots.length) this.toast(`Cover for ${spots.length} of ${sq.length} squads; the rest crouch in the open`);
      this.renderer.marker(clicked.pos, 0x7ab0e0);
      return;
    }

    // right-click a building outside the base: search it for supplies (v4.9 #46)
    const bld = w.buildingAt(p);
    if (bld && w.districtAt(p)?.def.id !== 'base') {
      const err = w.orderSearch(sq, bld, queue);
      if (err) this.toast(err);
      else this.renderer.marker({ x: bld.rect.x + bld.rect.w / 2, y: bld.rect.y + bld.rect.h / 2 }, 0xd0c070);
      return;
    }

    w.issueOrder(sq, { type: 'move', pos: w.grid.nearestFree(p) }, queue, { shape: this.formation });
    this.renderer.marker(p, 0x9fe07a);
  }

  /** Click on the map without hitting a squad: select a building if there is one. */
  selectStructureAt(p: Vec2): boolean {
    const st = this.world.structureAt(p, (s) => SELECTABLE.has(s.def.id), 2);
    if (!st) return false;
    this.selectStructure(st.id);
    return true;
  }

  /** Select a base building (Command Post → support powers, Barracks → recruiting; v4.9 #47). */
  selectStructure(id: number): void {
    const st = this.world.structures.find((s) => s.id === id && s.alive);
    if (!st) return;
    this.mode = { kind: 'normal' };
    this.selected.clear();
    this.selectedStructure = st.id;
    this.changed();
  }

  /** The selected base building's type, if a building is selected. */
  get selectedBuilding(): string | null {
    if (this.selectedStructure == null) return null;
    return this.world.structures.find((s) => s.id === this.selectedStructure && s.alive)?.def.id ?? null;
  }

  /** Move the Barracks rally point (round 4 #36). */
  setRallyAt(p: Vec2): void {
    if (this.mode.kind !== 'rally') return;
    const r = this.world.grid.nearestFree(p);
    this.world.map.rally.x = r.x;
    this.world.map.rally.y = r.y;
    this.renderer.marker(r, 0x7ab0e0);
    this.toast('Rally point set');
    this.setMode({ kind: 'normal' });
  }

  callSupportAt(p: Vec2): void {
    if (this.mode.kind !== 'support') return;
    const err = callSupport(this.world, this.mode.id, p);
    if (err) this.toast(err);
    else this.setMode({ kind: 'normal' });
    this.changed();
  }

  deconstructAt(p: Vec2, queue: boolean): void {
    const st = this.world.structureAt(p);
    if (!st) {
      this.toast('Click a structure to deconstruct');
      return;
    }
    const err = this.world.orderDeconstruct(this.selectedEngineers, st, queue);
    if (err) this.toast(err);
    else this.renderer.marker(st.pos, 0xd0c070);
  }

  /** Round 14 #174: a patrol point for the selected squads (the first starts a new loop, later ones extend it). */
  patrolAt(p: Vec2): void {
    if (this.mode.kind !== 'patrol') return;
    const sq = this.selectedSquads.filter((s) => s.def.category !== 'civilian');
    if (!sq.length) return;
    this.world.orderPatrol(sq, this.world.grid.nearestFree(p), this.mode.started);
    this.mode = { kind: 'patrol', started: true };
    this.renderer.marker(p, 0xe0b24a);
    this.changed();
  }

  /** The formation a right-drag from `a` to `b` would make (facing a → b; line/spread as wide as the drag). */
  private dragFormation(a: Vec2, b: Vec2): Formation {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const along = Math.atan2(b.y - a.y, b.x - a.x);
    const wide = this.formation === 'line' || this.formation === 'spread';
    if (!wide) return { shape: this.formation, facing: along };
    // line / spread: the drag is the front, and the group faces across it, away from where it's coming from
    const sq = this.selectedSquads;
    const c = sq.reduce((o, s) => ({ x: o.x + s.pos.x / sq.length, y: o.y + s.pos.y / sq.length }), { x: 0, y: 0 });
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const f1 = along - Math.PI / 2;
    const away = Math.cos(f1) * (mid.x - c.x) + Math.sin(f1) * (mid.y - c.y) >= 0;
    return { shape: this.formation, facing: away ? f1 : along + Math.PI / 2, width: len };
  }

  /** Where each selected squad would stand for a right-drag (the preview while dragging). */
  formationPreview(a: Vec2, b: Vec2): Vec2[] {
    const sq = this.selectedSquads.filter((s) => s.def.category !== 'civilian');
    if (!sq.length) return [];
    const f = this.dragFormation(a, b);
    const wide = f.width !== undefined;
    const centre = wide ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a;
    const slots = formationSlots(sq.length, f.shape, f.width).sort((x, y) => x.back - y.back);
    const dir = { x: Math.cos(f.facing!), y: Math.sin(f.facing!) };
    const perp = { x: -dir.y, y: dir.x };
    return slots.map((s) => ({ x: centre.x + perp.x * s.right - dir.x * s.back, y: centre.y + perp.y * s.right - dir.y * s.back }));
  }

  /** Round 14 #177: right-drag from `a` to `b`: move into the chosen formation there, facing as dragged. */
  formationMoveAt(a: Vec2, b: Vec2, queue: boolean): void {
    const sq = this.selectedSquads.filter((s) => s.def.category !== 'civilian');
    if (!sq.length) return;
    const f = this.dragFormation(a, b);
    const centre = f.width !== undefined ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : a;
    this.world.issueOrder(sq, { type: 'move', pos: this.world.grid.nearestFree(centre) }, queue, f);
    this.renderer.marker(centre, 0x9fe07a);
    this.changed();
  }

  setFormation(shape: FormationShape): void {
    this.formation = shape;
    this.toast(`Formation: ${shape} (right-drag to place it and set its facing)`);
    this.changed();
  }

  attackMoveAt(p: Vec2, queue: boolean): void {
    const sq = this.selectedSquads;
    if (!sq.length) return;
    this.world.issueOrder(sq, { type: 'attackMove', pos: this.world.grid.nearestFree(p) }, queue);
    this.renderer.marker(p, 0xe0a050);
  }

  hold(): void {
    const sq = this.selectedSquads;
    if (sq.length) this.world.issueOrder(sq, { type: 'hold', pos: sq[0].pos });
    this.changed();
  }

  /** Round 11 #125: G crouches the selected squads (or stands them up if they all are). */
  crouch(): void {
    const sq = this.selectedSquads.filter((s) => s.def.category !== 'civilian');
    if (!sq.length) return;
    const on = this.world.toggleCrouch(sq);
    this.toast(on ? 'Crouched: half cover anywhere, slower on the move (G to stand)' : 'Standing up');
    this.changed();
  }

  /** Send the nearest engineer team to install the selected structure's upgrade (round 12 #138). */
  upgradeSelected(): void {
    const st = this.world.structures.find((s) => s.id === this.selectedStructure && s.alive);
    if (!st) return;
    const err = this.world.orderUpgrade([], st);
    if (err) this.toast(err);
    else this.renderer.marker(st.pos, 0xd0c070);
    this.changed();
  }

  disband(): void {
    const sq = this.selectedSquads;
    if (!sq.length) return;
    const err = this.world.orderDisband(sq);
    if (err) this.toast(err);
    else this.toast(`${sq.length > 1 ? `${sq.length} squads` : sq[0].name} heading back to stand down`);
    this.changed();
  }

  stop(): void {
    this.world.stop(this.selectedSquads);
    this.changed();
  }

  buildTile(p: Vec2, defId: string, rotated: boolean): { x: number; y: number } {
    const fp = this.world.footprint(defId, rotated);
    const cell = this.world.grid.cell;
    return { x: Math.round(p.x / cell - fp.w / 2), y: Math.round(p.y / cell - fp.h / 2) };
  }

  placeBuild(p: Vec2, queue: boolean): void {
    if (this.mode.kind !== 'build') return;
    const { defId, rotated, aim } = this.mode;
    const err = this.world.orderBuild(this.selectedEngineers, defId, this.buildTile(p, defId, rotated), queue, rotated, aim);
    if (err) this.toast(err);
    else {
      this.renderer.marker(p, 0xd0c070);
      if (!queue) this.setMode({ kind: 'normal' });
    }
    this.changed();
  }

  startBuild(defId: string): void {
    if (!this.engineersOnly) {
      this.toast(this.selectedEngineers.length ? 'Only engineers can build: select just your Engineer Teams' : 'Select an Engineer Team first');
      return;
    }
    const def = STRUCTURES[defId];
    if (def.unlock && !this.world.unlocked.has(def.unlock)) {
      this.toast(`${def.name}: not unlocked yet`);
      return;
    }
    if (!this.world.canAfford(def.cost)) {
      this.toast(`${def.name} needs $${def.cost.money} and ${def.cost.supplies} supplies`);
      return;
    }
    this.setMode({ kind: 'build', defId, rotated: false, aim: 0 });
  }

  produce(defId: string): void {
    const err = this.world.queueProduction(defId);
    if (err) this.toast(err);
    this.changed();
  }

  // ---- loop ----

  /**
   * STATUS #47: where each frame's time goes (ms, smoothed), and the slowest frame lately. Shown by the HUD's
   * performance readout (Settings). `sim` = simulation steps, `scene` = updating the 3D scene, `draw` = handing
   * it to the GPU (the GPU's own time isn't measurable from here), `hud` = HUD, input and sound.
   */
  readonly perf = { fps: 0, frame: 0, sim: 0, scene: 0, draw: 0, hud: 0, steps: 0, worst: 0, worstAt: 0, worstWhat: '' };

  start(frame: () => void): void {
    const ease = (a: number, b: number) => a + (b - a) * 0.1;
    const tick = () => {
      const now = performance.now();
      const P = this.perf;
      const realDt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      const step = 1 / BALANCE.tickRate;
      let simDt = 0;
      const t0 = performance.now();
      let steps = 0;
      if (!this.paused && !this.world.over) {
        this.acc += realDt * this.speed;
        let n = 0;
        while (this.acc >= step && n < 16) {
          this.world.step(step);
          this.acc -= step;
          simDt += step;
          n++;
        }
        if (n >= 16) this.acc = 0;
        steps = n;
      }
      const t1 = performance.now();
      this.renderer.selectedStructure = this.selectedStructure;
      this.renderer.render(realDt, simDt, this.selected);
      const t2 = performance.now();
      frame();
      const t3 = performance.now();
      const draw = this.renderer.drawMs;
      const parts = { sim: t1 - t0, scene: t2 - t1 - draw, draw, hud: t3 - t2 };
      P.sim = ease(P.sim, parts.sim);
      P.scene = ease(P.scene, parts.scene);
      P.draw = ease(P.draw, parts.draw);
      P.hud = ease(P.hud, parts.hud);
      P.steps = steps;
      P.frame = ease(P.frame, realDt * 1000);
      P.fps = P.frame > 0 ? 1000 / P.frame : 0;
      // the slowest frame in the last 2 s, and which part made it slow
      const gap = realDt * 1000;
      if (gap >= P.worst || now - P.worstAt > 2000) {
        P.worst = gap;
        P.worstAt = now;
        const top = (Object.entries(parts) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
        P.worstWhat = `${top[0]} ${top[1].toFixed(0)} ms`;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
