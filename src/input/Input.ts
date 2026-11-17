import type { Game } from '../Game';

/** Mouse + keyboard → Game commands. Controls follow doc §4. */
export class Input {
  private dragStart: { x: number; y: number } | null = null;
  private dragging = false;
  private panning: { x: number; y: number } | null = null;
  private mouse = { x: 0, y: 0, inside: false };
  private keys = new Set<string>();
  private box: HTMLDivElement;

  constructor(private game: Game, el: HTMLElement) {
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
    window.addEventListener('blur', () => this.keys.clear());
  }

  private ground(e: { clientX: number; clientY: number }) {
    return this.game.renderer.screenToGround(e.clientX, e.clientY);
  }

  private down(e: MouseEvent): void {
    if (e.button === 1) {
      this.panning = { x: e.clientX, y: e.clientY };
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
      g.commandAt(p, e.shiftKey);
      return;
    }
    if (e.button !== 0) return;
    if (g.mode.kind === 'build') {
      g.placeBuild(p, e.shiftKey);
      return;
    }
    if (g.mode.kind === 'attackMove') {
      g.attackMoveAt(p, e.shiftKey);
      if (!e.shiftKey) g.setMode({ kind: 'normal' });
      return;
    }
    if (g.mode.kind === 'charge') {
      g.commandAt(p, e.shiftKey);
      g.setMode({ kind: 'normal' });
      return;
    }
    this.dragStart = { x: e.clientX, y: e.clientY };
    this.dragging = false;
  }

  private move(e: MouseEvent): void {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    if (this.panning) {
      this.game.renderer.rig.panScreen(this.panning.x - e.clientX, this.panning.y - e.clientY, window.innerHeight);
      this.panning = { x: e.clientX, y: e.clientY };
      return;
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
    const g = this.game;
    if (g.mode.kind === 'build') {
      const p = this.ground(e);
      const tile = g.buildTile(p, g.mode.defId, g.mode.rotated);
      const ok = !g.world.canPlace(g.mode.defId, tile, g.mode.rotated);
      g.renderer.setGhost(tile, g.world.footprint(g.mode.defId, g.mode.rotated), ok);
    }
  }

  private up(e: MouseEvent): void {
    if (e.button === 1) {
      this.panning = null;
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
      let best: number | null = null;
      let bestD = 28;
      for (const s of g.world.squads) {
        const p = r.worldToScreen(s.pos);
        const d = Math.hypot(p.x - e.clientX, p.y - e.clientY);
        if (d < bestD) {
          bestD = d;
          best = s.id;
        }
      }
      if (best != null && e.shiftKey && g.selected.has(best)) {
        g.selected.delete(best);
        g.changed();
      } else g.select(best != null ? [best] : [], e.shiftKey);
    }
    this.dragStart = null;
    this.dragging = false;
    this.box.style.display = 'none';
  }

  private key(e: KeyboardEvent): void {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    this.keys.add(k);
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
        if (g.mode.kind !== 'normal') g.setMode({ kind: 'normal' });
        else g.select([]);
        break;
      case 'a':
        if (g.selectedSquads.length) g.setMode({ kind: 'attackMove' });
        break;
      case 'h':
        g.hold();
        break;
      case 's':
        g.stop();
        break;
      case 'm':
        g.renderer.rig.toggleStrategic();
        break;
      case 'p':
        g.renderer.togglePixelation();
        break;
      case 'o':
        g.startBuild('outpost');
        break;
      case 'f':
        g.startBuild('sandbags');
        break;
      case 'g':
        g.startBuild('wire');
        break;
      case 't':
        g.startBuild('mgNest');
        break;
      case 'c':
        if (g.selectedEngineers.length) g.setMode({ kind: 'charge' });
        else g.toast('Select an Engineer Team to plant a charge');
        break;
      case 'r':
        if (g.mode.kind === 'build') g.setMode({ ...g.mode, rotated: !g.mode.rotated });
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
    const rig = this.game.renderer.rig;
    const sp = 900 * dt;
    let dx = 0;
    let dy = 0;
    if (this.keys.has('arrowleft')) dx -= sp;
    if (this.keys.has('arrowright')) dx += sp;
    if (this.keys.has('arrowup')) dy -= sp;
    if (this.keys.has('arrowdown')) dy += sp;
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
