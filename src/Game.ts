import { BALANCE } from './config/balance';
import { STRUCTURES } from './config/units';
import { dist, type Vec2 } from './core/math';
import { World } from './sim/World';
import { loadWorld, saveWorld, type SaveData } from './sim/save';
import { Squad } from './sim/entities';
import { Renderer } from './render/Renderer';
import type { Flipbook } from './render/characters';
import { callSupport } from './sim/systems/support';
import type { Targetable } from './sim/types';

export type Mode =
  | { kind: 'normal' }
  | { kind: 'attackMove' }
  | { kind: 'build'; defId: string; rotated: boolean; aim: number }
  | { kind: 'charge' }
  | { kind: 'deconstruct' }
  | { kind: 'support'; id: string }
  | { kind: 'rally' };

/**
 * Owns the fixed-step loop, pause/speed (doc §2), the current selection and the
 * input mode. Input and HUD talk to the world only through here.
 */
const SELECTABLE = new Set(['commandPost', 'barracks']);

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
  const st = w.structures.find((s) => s.built && s.def.cover && s.def.id !== 'mgNest' && !s.def.garrison && dist(s.pos, p) < s.radius + 1.5);
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

  get selectedEngineers(): Squad[] {
    return this.selectedSquads.filter((s) => s.def.canBuild?.length);
  }

  select(ids: number[], add = false): void {
    if (!add) this.selected.clear();
    if (ids.length || !add) this.selectedStructure = null;
    for (const id of ids) this.selected.add(id);
    if (this.mode.kind !== 'normal' && !this.selectedEngineers.length && this.mode.kind !== 'attackMove' && this.mode.kind !== 'rally' && this.mode.kind !== 'support') this.mode = { kind: 'normal' };
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
    const own = w.structures.find((s) => s.alive && (s.def.cost.money + s.def.cost.supplies > 0 || !!s.def.restore) && dist(s.pos, p) < s.radius + 1);
    if (eng.length && own && (!own.built || own.hp < own.def.hp)) {
      const err = own.built ? w.orderRepair(eng, own, queue) : w.orderResume(eng, own, queue);
      if (err) this.toast(err);
      this.renderer.marker(own.pos, 0xd0c070);
      const rest = sq.filter((s) => !eng.includes(s));
      if (!rest.length) return;
      sq = rest; // everyone else falls through to the normal command (e.g. take cover)
    }

    // right-click a guard tower: the first infantry squad climbs up (v4.13)
    const tower = w.structures.find((s) => s.alive && s.def.garrison && dist(s.pos, p) < s.radius + 1);
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
      // a car shelters two squads (one at each end), a sandbag wall three
      const spots = [clicked, ...others].flatMap((c) => c.slots.map((along) => ({ ...c, along })));
      // closest squad to the clicked cover takes it, and so on
      const order = [...sq].sort((a, b) => dist(a.pos, clicked.pos) - dist(b.pos, clicked.pos));
      order.forEach((s, i) => {
        const c = spots[i];
        if (c) w.issueOrder([s], { type: 'cover', pos: w.grid.nearestFree(coverSpot(c, center, c.along)), targetId: c.id }, queue);
        else w.issueOrder([s], { type: 'move', pos: w.grid.nearestFree({ x: clicked.pos.x + (i - n / 2) * 3, y: clicked.pos.y + Math.sign(center.y - clicked.pos.y || 1) * 6 }) }, queue);
      });
      if (sq.length > spots.length) this.toast(`Only enough cover here for ${spots.length} of ${sq.length} squads`);
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

    w.issueOrder(sq, { type: 'move', pos: w.grid.nearestFree(p) }, queue);
    this.renderer.marker(p, 0x9fe07a);
  }

  /** Click on the map without hitting a squad: select a building if there is one. */
  selectStructureAt(p: Vec2): boolean {
    const st = this.world.structures.find((s) => s.alive && SELECTABLE.has(s.def.id) && dist(s.pos, p) < s.radius + 2);
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
    const st = this.world.structures.find((s) => s.alive && dist(s.pos, p) < s.radius + 1);
    if (!st) {
      this.toast('Click a structure to deconstruct');
      return;
    }
    const err = this.world.orderDeconstruct(this.selectedEngineers, st, queue);
    if (err) this.toast(err);
    else this.renderer.marker(st.pos, 0xd0c070);
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

  start(frame: () => void): void {
    const tick = () => {
      const now = performance.now();
      const realDt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      const step = 1 / BALANCE.tickRate;
      let simDt = 0;
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
      }
      this.renderer.selectedStructure = this.selectedStructure;
      this.renderer.render(realDt, simDt, this.selected);
      frame();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}
