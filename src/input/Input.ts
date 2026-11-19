import type { Vec2 } from '../core/math';
import { STRUCTURES } from '../config/units';
import type { Game } from '../Game';

/** Mouse + keyboard → Game commands. Controls follow doc §4. */
export class Input {
  private dragStart: { x: number; y: number } | null = null;
  private dragging = false;
  private panning: { x: number; y: number; rotate: boolean } | null = null;
  private mouse = { x: 0, y: 0, inside: false };
  private keys = new Set<string>();
  private box: HTMLDivElement;

  constructor(private game: Game, private el: HTMLElement) {
    this.box = document.createElement('div');
    this.box.className = 'dragbox';
    document.body.appendChild(this.box);

    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('mousedown', (e) => this.down(e));
    window.addEventListener('mousemove', (e) => this.move(e));
    window.addEventListener('mouseup', (e) => this.up(e));
    el.addEventListener('mouseenter', () => (this.mouse.inside = true));
    el.addEventListener('mouseleave', () => (this.mouse.inside = false));
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.game.renderer.rig.zoomBy(e.deltaY > 0 ? 0.88 : 1.14);
      this.game.changed();
    }, { passive: false });
    window.addEventListener('keydown', (e) => this.key(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear()); // no runaway panning after alt-tab
    window.addEventListener('blur', () => this.keys.clear());
  }

  private ground(e: { clientX: number; clientY: number }) {
    return this.game.renderer.screenToGround(e.clientX, e.clientY);
  }

  private down(e: MouseEvent): void {
    if (e.button === 1) {
      // middle-drag rotates the camera; Shift + middle-drag pans
      this.panning = { x: e.clientX, y: e.clientY, rotate: !e.shiftKey };
      e.preventDefault();
      return;
    }
    const g = this.game;
    const p = this.ground(e);
    if (e.button === 2) {
      if (g.mode.kind !== 'normal') {
        g.setMode({ kind: 'normal' });
        return;
      }
      // round 14 #177: act on release, so a right-drag can lay out a formation instead
      this.rightDrag = { p, x: e.clientX, y: e.clientY, dragging: false };
      return;
    }
    if (e.button !== 0) return;
    if (g.mode.kind === 'build') {
      g.placeBuild(p, e.shiftKey);
      return;
    }
    if (g.mode.kind === 'patrol') {
      // round 14 #174: Shift+click keeps adding points; a plain click places the last one
      g.patrolAt(p);
      if (!e.shiftKey) g.setMode({ kind: 'normal' });
      return;
    }
    if (g.mode.kind === 'attackMove') {
      g.attackMoveAt(p, e.shiftKey);
      if (!e.shiftKey) g.setMode({ kind: 'normal' });
      return;
    }
    if (g.mode.kind === 'support') {
      g.callSupportAt(p);
      return;
    }
    if (g.mode.kind === 'rally') {
      g.setRallyAt(p);
      return;
    }
    if (g.mode.kind === 'deconstruct') {
      g.deconstructAt(p, e.shiftKey);
      if (!e.shiftKey) g.setMode({ kind: 'normal' });
      return;
    }
    if (g.mode.kind === 'charge') {
      g.commandAt(p, e.shiftKey);
      g.setMode({ kind: 'normal' });
      return;
    }
    if (g.mode.kind === 'dev') {
      // STATUS #59: drop zombies / a hive (Shift keeps placing)
      g.devPlace(p);
      if (!e.shiftKey) g.setMode({ kind: 'normal' });
      return;
    }
    if (g.mode.kind === 'heal') {
      // STATUS #20: click the squad to treat
      const t = this.squadAt(e.clientX, e.clientY);
      if (t == null) g.toast('Click a squad to heal');
      else g.healSquad(t, e.shiftKey);
      g.setMode({ kind: 'normal' });
      return;
    }
    this.dragStart = { x: e.clientX, y: e.clientY };
    this.dragging = false;
  }

  private move(e: MouseEvent): void {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    // don't trust mouseenter/leave (they don't fire when a dialog closes under a still cursor)
    this.mouse.inside = this.el.contains(e.target as Node);
    if (this.panning) {
      const rig = this.game.renderer.rig;
      if (this.panning.rotate) rig.rotateBy((e.clientX - this.panning.x) * 0.006);
      else rig.panScreen(this.panning.x - e.clientX, this.panning.y - e.clientY, window.innerHeight);
      this.panning = { ...this.panning, x: e.clientX, y: e.clientY };
      this.game.changed();
      return;
    }
    if (this.rightDrag) {
      const d = this.rightDrag;
      if (!d.dragging && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 18 && this.game.selectedSquads.length) d.dragging = true;
      if (d.dragging) this.game.renderer.formationPreview = this.game.formationPreview(d.p, this.ground(e));
    }
    if (this.mouse.inside) {
      this.game.renderer.hovered = this.pick(e.clientX, e.clientY);
      this.game.renderer.hoveredSquads = this.squadsUnder(e.clientX, e.clientY);
    }
    if (this.dragStart) {
      const dx = e.clientX - this.dragStart.x;
      const dy = e.clientY - this.dragStart.y;
      if (!this.dragging && Math.hypot(dx, dy) > 6) this.dragging = true;
      if (this.dragging) {
        const x = Math.min(e.clientX, this.dragStart.x);
        const y = Math.min(e.clientY, this.dragStart.y);
        Object.assign(this.box.style, { display: 'block', left: `${x}px`, top: `${y}px`, width: `${Math.abs(dx)}px`, height: `${Math.abs(dy)}px` });
      }
    }
  }

  private lastClick: { id: number | null; t: number } = { id: null, t: 0 };

  /** Squad under a screen point: its name label first (#39), else the nearest body within 28 px. */
  /** Every squad under the cursor, nearest first (round 14 #178). */
  /** A right-button press in progress (round 14 #177): a click commands, a drag places a formation. */
  private rightDrag: { p: Vec2; x: number; y: number; dragging: boolean } | null = null;

  private squadsUnder(x: number, y: number): number[] {
    const r = this.game.renderer;
    const out: { id: number; d: number }[] = [];
    for (const s of this.game.world.squads) {
      if (!s.alive || s.inVehicle != null) continue;
      const p = r.worldToScreen(s.pos);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < 28) out.push({ id: s.id, d });
    }
    const byName = r.squadAtLabel(x, y);
    if (byName != null && !out.some((o) => o.id === byName)) out.push({ id: byName, d: -1 });
    return out.sort((a, b) => a.d - b.d).map((o) => o.id);
  }

  /** STATUS #20: right-click a hurt squad (not one of the selection) with medics selected → they treat it. */
  private rightHeal(e: MouseEvent): boolean {
    const g = this.game;
    if (!g.selectedMedics.length) return false;
    const id = this.squadAt(e.clientX, e.clientY);
    if (id == null || g.selected.has(id)) return false;
    const t = g.world.squads.find((s) => s.id === id && s.alive);
    if (!t || t.def.category === 'civilian') return false;
    if (t.pool >= t.poolMax && t.aliveCount >= t.members.length) return false;
    return g.healSquad(id, e.shiftKey) || true;
  }

  private squadAt(x: number, y: number): number | null {
    const r = this.game.renderer;
    const byName = r.squadAtLabel(x, y);
    if (byName != null) return byName;
    let best: number | null = null;
    let bestD = 28;
    for (const s of this.game.world.squads) {
      if (!s.alive) continue;
      const p = r.worldToScreen(s.pos);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = s.id;
      }
    }
    return best;
  }

  /** What the mouse is over, for hover health bars (#35): a squad, else a structure or hive. */
  private pick(x: number, y: number): number | null {
    const sq = this.squadAt(x, y);
    if (sq != null) return sq;
    const w = this.game.world;
    const p = this.game.renderer.screenToGround(x, y);
    for (const h of w.hives) if (h.alive && Math.hypot(h.pos.x - p.x, h.pos.y - p.y) < h.radius + 2) return h.id;
    const st = w.structureAt(p);
    if (st) return st.id;
    return null;
  }

  /** Placement preview — refreshed every frame so rotating (R), panning or zooming updates it immediately. */
  private updateGhost(): void {
    const g = this.game;
    if (g.mode.kind !== 'build' || !this.mouse.inside) return;
    const p = this.ground(this.mouse.x === 0 && this.mouse.y === 0 ? { clientX: innerWidth / 2, clientY: innerHeight / 2 } : { clientX: this.mouse.x, clientY: this.mouse.y });
    const tile = g.buildTile(p, g.mode.defId, g.mode.rotated);
    const ok = !g.world.canPlace(g.mode.defId, tile, g.mode.rotated);
    const def = STRUCTURES[g.mode.defId];
    g.renderer.setGhost(tile, g.world.footprint(g.mode.defId, g.mode.rotated), ok, def.weapon?.range ?? 0, def.arc ? { aim: g.mode.aim, deg: def.arc } : undefined);
  }

  private up(e: MouseEvent): void {
    if (e.button === 1) {
      this.panning = null;
      return;
    }
    if (e.button === 2 && this.rightDrag) {
      const d = this.rightDrag;
      this.rightDrag = null;
      this.game.renderer.formationPreview = [];
      if (d.dragging) this.game.formationMoveAt(d.p, this.ground(e), e.shiftKey);
      else if (!this.rightHeal(e)) this.game.commandAt(d.p, e.shiftKey);
      return;
    }
    if (e.button !== 0 || !this.dragStart) return;
    const g = this.game;
    const r = g.renderer;
    if (this.dragging) {
      const x0 = Math.min(e.clientX, this.dragStart.x);
      const x1 = Math.max(e.clientX, this.dragStart.x);
      const y0 = Math.min(e.clientY, this.dragStart.y);
      const y1 = Math.max(e.clientY, this.dragStart.y);
      const ids = g.world.squads
        .filter((s) => {
          const p = r.worldToScreen(s.pos);
          return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
        })
        .map((s) => s.id);
      g.select(ids, e.shiftKey);
    } else {
      const best = this.squadAt(e.clientX, e.clientY);
      // double-click a squad (or its name) to centre the camera on it
      if (best != null && best === this.lastClick.id && e.timeStamp - this.lastClick.t < 350) {
        const s = g.world.squads.find((x) => x.id === best);
        if (s) r.rig.focus(s.pos);
      }
      this.lastClick = { id: best, t: e.timeStamp };
      if (best != null && e.shiftKey && g.selected.has(best)) {
        g.selected.delete(best);
        g.changed();
      } else if (best == null && !e.shiftKey && g.selectStructureAt(g.renderer.screenToGround(e.clientX, e.clientY))) {
        // selected a building
      } else g.select(best != null ? [best] : [], e.shiftKey);
    }
    this.dragStart = null;
    this.dragging = false;
    this.box.style.display = 'none';
  }

  private key(e: KeyboardEvent): void {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    if (!ctrl) this.keys.add(k); // Ctrl+S must not also start panning down
    const g = this.game;
    const digit = /^[0-9]$/.test(k) ? Number(k) : null;
    if (digit != null) {
      if (e.ctrlKey || e.metaKey) {
        g.groups.set(digit, [...g.selected]);
        g.toast(`Group ${digit} set`);
      } else if (g.groups.has(digit)) {
        g.select(g.groups.get(digit)!.filter((id) => g.world.squads.some((s) => s.id === id)));
        const sq = g.selectedSquads;
        if (sq.length && e.timeStamp - (this.lastDigit[digit] ?? 0) < 350) g.renderer.rig.focus(sq[0].pos);
        this.lastDigit[digit] = e.timeStamp;
      }
      e.preventDefault();
      return;
    }
    switch (k) {
      case ' ':
        g.togglePause();
        e.preventDefault();
        break;
      case 'escape':
        // round 10 #105: Esc backs out one step at a time — close the menu, cancel a mode, clear the
        // selection — and with nothing left to cancel, opens the pause menu
        if (g.menuOpen) g.openMenu?.();
        else if (g.mode.kind !== 'normal') g.setMode({ kind: 'normal' });
        else if (g.selected.size || g.selectedStructure != null) g.select([]);
        else g.openMenu?.();
        break;
      // v4.9 (#44): WASD pans the camera, so attack-move and stop moved to Ctrl+A / Ctrl+S.
      // (Never bind Ctrl+W: browsers close the tab and a page can't stop it.)
      case 'a':
        if (!ctrl) break;
        e.preventDefault(); // not "select all"
        if (g.selectedSquads.length) g.setMode({ kind: 'attackMove' });
        break;
      case 'h':
        g.hold();
        break;
      case '`':
        // STATUS #59: the dev menu
        g.toggleDev?.();
        break;
      case 'u':
        // STATUS #51: unload the selected Humvee
        g.unload();
        break;
      case 'k':
        // STATUS #20: medics heal
        g.startHeal();
        break;
      case 's':
        if (!ctrl) break;
        e.preventDefault(); // not "save page"
        g.stop();
        break;
      case 'm':
        g.renderer.rig.toggleStrategic();
        break;
      case 'p':
        // round 14 #174: patrol
        if (g.selectedSquads.some((s) => s.def.category !== 'civilian')) {
          g.setMode({ kind: 'patrol', started: false });
          g.toast('Patrol: click the points of the loop (Shift+click to keep adding; it starts from where they stand)');
        }
        break;
      case 'q':
        g.renderer.rig.rotate(-1);
        g.changed();
        break;
      case 'e':
        g.renderer.rig.rotate(1);
        g.changed();
        break;
      case 'o':
        g.startBuild('outpost');
        break;
      case 'f':
        g.startBuild('sandbags');
        break;
      case 'g':
        // round 11 #125: G = crouch (barbed wire moved to Z, next to X deconstruct and C charge)
        g.crouch();
        break;
      case 'z':
        if (!ctrl) g.startBuild('wire');
        break;
      case 't':
        g.startBuild('mgNest');
        break;
      case 'c':
        if (g.selectedEngineers.length) g.setMode({ kind: 'charge' });
        else g.toast('Select an Engineer Team to plant a charge');
        break;
      case 'r':
        // R: walls flip 90°; armed emplacements turn their field of fire a quarter turn (v4.13 #71)
        if (g.mode.kind === 'build') {
          if (STRUCTURES[g.mode.defId].arc) g.setMode({ ...g.mode, aim: (g.mode.aim + Math.PI / 2) % (Math.PI * 2) });
          else g.setMode({ ...g.mode, rotated: !g.mode.rotated });
        }
        break;
      case 'b': {
        // jump to the Barracks (recruiting + rally point)
        const b = g.world.structures.find((s) => s.alive && s.def.id === 'barracks');
        if (b) g.selectStructure(b.id);
        break;
      }
      case 'y':
        // STATUS #50: the Vehicle Bay (the Med Bay isn't built any more: it's in the base, run down)
        g.startBuild('vehicleBay');
        break;
      case 'v':
        g.startBuild('guardTower');
        break;
      case 'x':
        if (g.selectedEngineers.length) g.setMode({ kind: 'deconstruct' });
        else g.toast('Select an Engineer Team to deconstruct');
        break;
      case '+':
      case '=':
        g.setSpeed(g.speed * 2);
        break;
      case '-':
        g.setSpeed(g.speed / 2);
        break;
      case 'tab':
        e.preventDefault();
        g.toast('Direct control (TAB) arrives after the MVP — see roadmap');
        break;
    }
  }
  private lastDigit: Record<number, number> = {};

  /** Called every frame: keyboard and edge-of-screen panning. */
  update(dt: number): void {
    this.updateGhost();
    const rig = this.game.renderer.rig;
    const sp = 900 * dt;
    let dx = 0;
    let dy = 0;
    const k = this.keys;
    if (k.has('arrowleft') || k.has('a')) dx -= sp;
    if (k.has('arrowright') || k.has('d')) dx += sp;
    if (k.has('arrowup') || k.has('w')) dy -= sp;
    if (k.has('arrowdown') || k.has('s')) dy += sp;
    const edge = 6;
    if (this.mouse.inside && !this.dragStart && !this.panning) {
      if (this.mouse.x <= edge) dx -= sp;
      if (this.mouse.x >= window.innerWidth - edge) dx += sp;
      if (this.mouse.y <= edge) dy -= sp;
      if (this.mouse.y >= window.innerHeight - edge) dy += sp;
    }
    if (dx || dy) rig.panScreen(dx, dy, window.innerHeight);
  }
}
