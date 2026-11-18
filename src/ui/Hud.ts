import { BALANCE } from '../config/balance';
import { SAVE_VERSION, SLOTS, deleteSlot, latestSlot, requestLoad, slotMeta, writeSlot, type SlotId } from '../sim/save';
import { ABILITIES, STRUCTURES, UNITS } from '../config/units';
import { isEnabled } from '../config/features';
import type { Game } from '../Game';
import { Radio } from './Radio';
import { ROADSIDE_MOTEL_TUTORIAL, Tutorial } from '../tutorial/Tutorial';
import { squadStatus } from './status';
import { incomeRates } from '../sim/systems/economy';
import { SUPPORT } from '../config/support';
import { supportBlocked } from '../sim/systems/support';

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
const UI_SCALES = [0.75, 0.85, 1, 1.15, 1.3];
/** Per-viewer conveniences (UI scale, collapsed panels). Storage can be unavailable; never required. */
const pref = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(`dbc.${k}`);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(`dbc.${k}`, v);
    } catch {
      /* private mode etc. */
    }
  },
};

const ALERT_SPEAKERS = new Set(['Command', 'Overwatch', 'Intel', 'Quartermaster', 'Engineers']);
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** DOM HUD. Rebuilt at ~8 Hz, or immediately on selection/mode changes. */
/** Engineer build menu entries, in display order (round 9 #104). */
const BUILD_MENU: { kind: 'structure' | 'tool'; id: string; name: string; key: string; icon: string; tip: string; unlock?: string }[] = [
  { kind: 'structure', id: 'sandbags', name: 'Sandbags', key: 'F', icon: 'sandbags', tip: 'Cover for squads behind it (R rotates)' },
  { kind: 'structure', id: 'wire', name: 'Barbed Wire', key: 'Z', icon: 'wire', tip: 'Slows everything that crosses it, yours included' },
  { kind: 'structure', id: 'mgNest', name: 'MG Nest', key: 'T', icon: 'mg', tip: '35 m, 120° field of fire aimed with R' },
  { kind: 'structure', id: 'guardTower', name: 'Guard Tower', key: 'V', icon: 'tower', tip: 'One squad mans it: +40% range, sees over cover', unlock: 'opens with Gas Station Strip' },
  { kind: 'structure', id: 'medBay', name: 'Med Bay', key: 'N', icon: 'med', tip: 'In the base; resting squads heal (needs power)', unlock: 'restore the Rail Siding power station' },
  { kind: 'structure', id: 'outpost', name: 'Outpost', key: 'O', icon: 'outpost', tip: 'Secures a district once its hives are dead and infestation is 2% or less' },
  { kind: 'tool', id: 'charge', name: 'Demo Charge', key: 'C', icon: 'charge', tip: 'Click a hive: 3 s to plant, getting hit restarts it' },
  { kind: 'tool', id: 'deconstruct', name: 'Deconstruct', key: 'X', icon: 'decon', tip: 'Take down something you built (full refund if unstarted, half if built)' },
];

/** Small line icons for the build bar (inline SVG: no font or emoji dependence). */
const svg = (body: string) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const ICON: Record<string, string> = {
  sandbags: svg('<rect x="3" y="14" width="8" height="5" rx="2.5"/><rect x="13" y="14" width="8" height="5" rx="2.5"/><rect x="8" y="8.5" width="8" height="5" rx="2.5"/>'),
  wire: svg('<path d="M2 12h20"/><path d="M5 9l3 6M8 9l-3 6M13 9l3 6M16 9l-3 6"/>'),
  mg: svg('<path d="M4 18h8l1-4H5z"/><path d="M12 13l9-5"/><path d="M8 18v3M6 21h4"/>'),
  tower: svg('<path d="M6 21l2-11M18 21l-2-11M7 16h10"/><rect x="6" y="6" width="12" height="4"/><path d="M8 6V4h8v2"/>'),
  med: svg('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/>'),
  outpost: svg('<path d="M6 21V3"/><path d="M6 4h11l-3 4 3 4H6"/>'),
  charge: svg('<circle cx="10" cy="14" r="6"/><path d="M14 10l3-3M17 4v2M20 7h-2M19.5 4.5l-1.5 1.5"/>'),
  decon: svg('<path d="M14 6l4 4M4 20l9-9M15 4l5 5-3 1-3-3z"/>'),
  lock: svg('<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
};

/** Autosave interval, seconds of game time (STATUS #16). */
const AUTOSAVE_SEC = 180;

type MenuPage = 'main' | 'controls' | 'settings' | 'restart' | 'saves';

/** Every keybind, grouped, for the pause menu's Controls page (round 10 #105). */
const K = (...keys: string[]) => keys.map((k) => `<kbd>${k}</kbd>`).join('+');
const CONTROLS: [string, [string, string][]][] = [
  ['Camera', [
    [`${K('W')}${K('A')}${K('S')}${K('D')} / arrows / screen edge`, 'Pan'],
    [`${K('Shift')} + middle-drag`, 'Pan'],
    ['Mouse wheel', 'Zoom'],
    [`Middle-drag / ${K('Q')} ${K('E')}`, 'Rotate'],
    [K('M'), 'Ops map (zoomed-out overview)'],
  ]],
  ['Selecting and orders', [
    ['Left-click / drag a box', 'Select squads (click a name or status too)'],
    [`${K('Shift')} + click`, 'Add to / remove from selection'],
    ['Double-click a squad', 'Centre the camera on it'],
    ['Right-click ground', 'Move'],
    ['Right-click a zombie', 'Attack that one'],
    ['Right-click a car / sandbags', 'Take cover (two squads per car, three per sandbag wall; the rest crouch beside it)'],
    ['Right-click a building', 'Search it (supplies, sometimes zombies)'],
    ['Right-click a guard tower', 'Man it'],
    [`${K('Shift')} + right-click`, 'Queue orders'],
    [`${K('Ctrl')}+${K('A')}`, 'Attack-move'],
    [K('H'), 'Hold position'],
    [K('G'), 'Crouch / stand (half cover anywhere, slower on the move)'],
    [`${K('Ctrl')}+${K('S')}`, 'Stop'],
    [`${K('Ctrl')}+${K('1')}–${K('9')} / ${K('1')}–${K('9')}`, 'Save / recall a group (press twice to centre)'],
  ]],
  ['Engineers', [
    [K('F'), 'Sandbags'], [K('Z'), 'Barbed wire'], [K('T'), 'MG nest'], [K('V'), 'Guard tower (region 2)'],
    [K('N'), 'Med Bay (after power)'], [K('O'), 'Outpost'], [K('C'), 'Demo charge (click a hive)'], [K('X'), 'Deconstruct'],
    [K('R'), 'Rotate while placing (MG: turn its field of fire)'],
    ['Right-click own structure', 'Resume building / repair (or restore the power station)'],
  ]],
  ['Base', [
    [`Click the Barracks / ${K('B')}`, 'Recruit, set the rally point'],
    ['Click the Command Post', 'Support (supply drop)'],
  ]],
  ['Game', [
    [K('Space'), 'Pause / unpause'],
    [`${K('+')} ${K('-')}`, 'Game speed'],
    [K('Esc'), 'Cancel / deselect / this menu'],
  ]],
];

export class Hud {
  private top!: HTMLElement;
  private topCtl!: HTMLElement;
  private selCmds!: HTMLElement;
  private selCards!: HTMLElement;
  private districts!: HTMLElement;
  private objectives!: HTMLElement;
  private selection!: HTMLElement;
  private toastEl!: HTMLElement;
  private modal!: HTMLElement;
  private radio: Radio;
  tutorial: Tutorial | null = null;
  /** Set by main.ts; drives the volume button. */
  sound: { volume: number; cycleVolume(): void; uiClick(): void } | null = null;
  private root: HTMLElement;
  private dirty = true;
  private last = 0;
  private toastTimer = 0;
  private uiScale = 1;
  private buildBar!: HTMLElement;
  private collapsed = new Set<string>();

  private applyScale(): void {
    (this.root.style as CSSStyleDeclaration & { zoom: string }).zoom = String(this.uiScale);
  }

  constructor(private game: Game, root: HTMLElement) {
    root.innerHTML = `
      <div class="hud-top"><div class="top-res"></div><div class="speed"></div></div>
      <div class="hud-objectives panel"></div>
      <div class="hud-districts panel"></div>
      <div class="hud-bottom">
        <div class="hud-selection panel"></div>
      </div>
      <div class="hud-build panel"></div>
      <div class="toast"></div>
      <div class="modal"></div>`;
    const q = (s: string) => root.querySelector(s) as HTMLElement;
    this.top = q('.hud-top .top-res');
    this.topCtl = q('.hud-top .speed');
    this.objectives = q('.hud-objectives');
    this.districts = q('.hud-districts');
    this.selection = q('.hud-selection');
    this.buildBar = q('.hud-build');
    this.toastEl = q('.toast');
    this.modal = q('.modal');

    this.root = root;
    // v4.9 (round 4 #38): UI scale setting, remembered per browser
    this.uiScale = Number(pref.get('uiScale')) || 1;
    this.applyScale();
    for (const k of ['objectives', 'districts']) if (pref.get(`collapsed.${k}`) === '1') this.collapsed.add(k);
    // v4.9 (#62): the radio log is hidden until voice audio lands. Every line is still generated
    // (Radio keeps them), and the important ones surface as a brief alert.
    this.radio = new Radio(game.world, (line) => {
      if ((line.tone === 'warn' || line.tone === 'bad') && ALERT_SPEAKERS.has(line.speaker)) this.alert(line.text, line.tone);
    });
    game.onChange(() => (this.dirty = true));
    game.toast = (m) => this.toast(m);
    game.openMenu = () => this.toggleMenu();

    // act on pointerdown: the HUD re-renders several times a second, and a 'click' is lost if the
    // button is replaced between mousedown and mouseup (that was the "click twice" bug)
    root.addEventListener('pointerdown', (e) => {
      if (e.button === 0) this.click(e);
    });
    game.world.events.on('districtUnlocked', (e) => this.showBriefing(e.districtId, e.name, e.unlocks));
    game.world.events.on('powerRestored', (e) => e.first && this.showPowerBriefing());
    game.world.events.on('civiliansFound', (e) => this.toast(`${e.count} survivors found! Select them and walk them to the Command Post.`));
    game.world.events.on('civiliansEvacuated', (e) => this.toast(`${e.count} survivor${e.count === 1 ? '' : 's'} evacuated: +$${e.money}, +${e.supplies} supplies`));
    game.world.events.on('victory', (e) => this.showEnd(true, e.reason));
    game.world.events.on('defeat', (e) => this.showEnd(false, e.reason));
    // autosave when a district is secured (and every few minutes, see update)
    game.world.events.on('districtSecured', () => void this.autosave());
    this.lastAutosave = game.world.time;
    if (game.loadedFrom) {
      const s = game.loadedFrom.summary;
      game.paused = true;
      this.toast(`Loaded: day ${s.day}, ${s.region}. Paused: press Space to carry on.`);
    } else this.showIntro();
  }

  // ---------------------------------------------------------------- save / load (STATUS #16)
  private lastAutosave = 0;
  private saving = false;

  /** Save into the autosave slot (quietly; only a failure is reported). */
  private async autosave(): Promise<void> {
    if (this.saving || this.game.world.over) return;
    this.saving = true;
    this.lastAutosave = this.game.world.time;
    const err = await writeSlot('auto', this.game.snapshot());
    this.saving = false;
    if (err) this.toast(`Autosave failed: ${err}`);
  }

  private async saveTo(slot: SlotId): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    const err = await writeSlot(slot, this.game.snapshot());
    this.saving = false;
    this.toast(err ?? `Saved to slot ${slot}.`);
    if (this.game.menuOpen) this.showMenu('saves');
  }

  /** One slot's line in the Save / Load page. */
  private slotRow(slot: SlotId, confirm: string | null): string {
    const m = slotMeta(slot);
    const name = slot === 'auto' ? 'Autosave' : `Slot ${slot}`;
    const old = m && m.v !== SAVE_VERSION;
    const when = m ? new Date(m.savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    const desc = !m ? '<i>empty</i>' : old ? '<i>from an older version (can\'t be loaded)</i>' : `Day ${m.summary.day} · ${esc(m.summary.region)} · $${m.summary.money} <small>${when}</small>`;
    const load = m && !old ? (confirm === `load:${slot}` ? `<button class="warn" data-act="load-go:${slot}">Confirm load</button>` : `<button data-act="load-ask:${slot}">Load</button>`) : '';
    const save = slot === 'auto' ? '' : `<button data-act="save-to:${slot}">${m ? 'Overwrite' : 'Save'}</button>`;
    const del = m ? (confirm === `del:${slot}` ? `<button class="warn" data-act="del-go:${slot}">Confirm delete</button>` : `<button class="ghost" data-act="del-ask:${slot}">Delete</button>`) : '';
    return `<tr><td><b>${name}</b><br>${desc}</td><td class="slot-btns">${save}${load}${del}</td></tr>`;
  }
  private slotConfirm: string | null = null;

  private cache = new WeakMap<HTMLElement, string>();
  /** Only touch the DOM when a panel's content actually changed (keeps buttons, scroll and <details> stable). */
  private set(el: HTMLElement, html: string): void {
    if (this.cache.get(el) === html) return;
    this.cache.set(el, html);
    el.innerHTML = html;
  }

  toast(msg: string): void {
    this.toastEl.textContent = msg;
    this.toastEl.className = 'toast show';
    this.toastTimer = 2.2;
  }

  /** Important radio traffic, shown briefly instead of a chat log. */
  private alert(msg: string, tone: string): void {
    this.toastEl.textContent = msg;
    this.toastEl.className = `toast show alert ${tone}`;
    this.toastTimer = 4;
  }

  private click(e: PointerEvent): void {
    const btn = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!btn || btn.classList.contains('disabled')) return;
    this.sound?.uiClick();
    const g = this.game;
    const [act, arg] = btn.dataset.act!.split(':');
    switch (act) {
      case 'produce': g.produce(arg); break;
      case 'rally': g.setMode({ kind: 'rally' }); break;
      case 'build': g.startBuild(arg); break;
      case 'charge': g.setMode({ kind: 'charge' }); break;
      case 'deconstruct': g.setMode({ kind: 'deconstruct' }); break;
      case 'support': g.setMode({ kind: 'support', id: arg }); break;
      case 'attackMove': g.setMode({ kind: 'attackMove' }); break;
      case 'hold': g.hold(); break;
      case 'crouch': g.crouch(); break;
      case 'stop': g.stop(); break;
      case 'disband': g.disband(); break;
      case 'upgrade': g.upgradeSelected(); break;
      case 'goto-district': {
        // round 12 #150: click a district's name to look at it (its outpost if it has one)
        const d = g.world.districts.get(arg);
        if (!d) break;
        const op = d.outpostId != null ? g.world.get(d.outpostId) : undefined;
        const r = d.def.rect;
        g.renderer.rig.focus(op && op.alive ? op.pos : { x: r.x + r.w / 2, y: r.y + r.h / 2 });
        break;
      }
      case 'pause': g.togglePause(); break;
      case 'speed': g.setSpeed(Number(arg)); break;
      case 'focus': {
        const s = g.world.squads.find((x) => x.id === Number(arg));
        if (s) {
          g.select([s.id]);
          g.renderer.rig.focus(s.pos);
        }
        break;
      }
      case 'ops': g.renderer.rig.toggleStrategic(); break;
      case 'volume':
        this.sound?.cycleVolume();
        if (g.menuOpen) this.showMenu('settings');
        break;
      case 'menu':
        this.toggleMenu();
        break;
      case 'menu-page':
        this.showMenu(arg as MenuPage);
        break;
      case 'resume':
        this.toggleMenu();
        break;
      case 'restart-confirm':
        this.showMenu('restart');
        break;
      case 'save-to':
        void this.saveTo(arg as SlotId);
        break;
      case 'load-ask':
      case 'del-ask':
        this.slotConfirm = `${act === 'load-ask' ? 'load' : 'del'}:${arg}`;
        this.showMenu('saves');
        break;
      case 'load-go':
        requestLoad(arg as SlotId);
        break;
      case 'continue-save':
        requestLoad(arg as SlotId);
        break;
      case 'del-go':
        deleteSlot(arg as SlotId);
        this.slotConfirm = null;
        this.showMenu('saves');
        break;
      case 'uiscale': {
        const i = UI_SCALES.indexOf(this.uiScale);
        this.uiScale = UI_SCALES[(i + 1) % UI_SCALES.length];
        pref.set('uiScale', String(this.uiScale));
        this.applyScale();
        if (g.menuOpen) this.showMenu('settings');
        break;
      }
      case 'collapse':
        if (this.collapsed.has(arg)) this.collapsed.delete(arg);
        else this.collapsed.add(arg);
        pref.set(`collapsed.${arg}`, this.collapsed.has(arg) ? '1' : '0');
        break;
      case 'rot': g.renderer.rig.rotate(Number(arg)); break;
      case 'start':
        this.modal.classList.remove('open');
        g.paused = false;
        if (arg === 'training') {
          this.tutorial = new Tutorial(g, ROADSIDE_MOTEL_TUTORIAL, this.root);
          this.tutorial.start();
        }
        this.radio.say('Command', 'All units, this is Command. Roadside Motel is crawling. Push out, find that hive, and bring me a clean block.', 'info');
        this.radio.say('Sapper Charlie', 'Give me thirty seconds and a lot of sandbags.', 'info');
        g.changed();
        break;
      case 'continue':
        this.modal.classList.remove('open');
        g.paused = false;
        break;
      case 'restart':
        location.reload();
        break;
    }
    this.dirty = true;
  }

  update(dt: number): void {
    this.tutorial?.update();
    if (!this.game.paused && this.game.world.time - this.lastAutosave >= AUTOSAVE_SEC) void this.autosave();
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('show');
    }
    this.last += dt;
    if (!this.dirty && this.last < 0.125) return;
    this.last = 0;
    this.dirty = false;
    this.renderTop();
    this.renderDistricts();
    this.renderObjectives();
    this.renderSelection();
    this.renderBuildBar();
  }

  private renderTop(): void {
    const w = this.game.world;
    const g = this.game;
    const dayPct = (w.dayTimer / BALANCE.economy.dayLengthSec) * 100;
    const upkeep = w.squads.reduce((n, s) => n + s.def.upkeep, 0);
    const inc = incomeRates(w);
    const speeds = [1, 2, 4].map((s) => `<button class="${g.speed === s ? 'on' : ''}" data-act="speed:${s}">${s}×</button>`).join('');
    this.set(this.top, `
      <div class="brand">DEAD BLOCK <span>COMMAND</span></div>
      <div class="res" title="Money: the hard resource. Income from secured districts, kills, clears and hives."><b>$</b>${Math.floor(w.money)}<small class="rate">${inc.money ? `+${inc.money}/min` : ''}</small></div>
      <div class="res" title="Supplies. Income from the base depot, secured districts and kills."><b>▣</b>${Math.floor(w.supplies)}<small class="rate">+${inc.supplies}/min</small></div>
      <div class="res" title="${w.hasCommandCap ? 'Command used / cap' : 'Command used (no cap from Rail Siding on)'}"><b>★</b>${w.commandUsed}${w.hasCommandCap ? `<small>/${w.commandCap}</small>` : ''}</div>
      <div class="res day" title="Upkeep is charged at the end of each day">
        Day ${w.day}<div class="bar"><i style="width:${dayPct.toFixed(1)}%"></i></div><small>upkeep −${upkeep}</small>
      </div>`);
    // controls live in their own element so they're only rebuilt when their state changes
    this.set(this.topCtl, `
        <button class="${g.paused ? 'on warn' : ''}" data-act="pause">${g.paused ? '▶ PAUSED' : '❚❚'}</button>${speeds}
        <button data-act="rot:-1" title="Rotate camera (Q)">⟲</button><span class="compass" title="Camera heading">VIEW ${Math.round(g.renderer.rig.headingDeg)}° ${g.renderer.rig.headingLabel}</span><button data-act="rot:1" title="Rotate camera (E)">⟳</button>
        <button data-act="ops" title="Operations map (M)">${g.renderer.rig.strategic ? 'STREET' : 'OPS MAP'}</button>
        <button data-act="volume" title="Sound volume (click to cycle)">SOUND ${this.sound ? (this.sound.volume ? `${Math.round(this.sound.volume * 100)}%` : 'OFF') : ''}</button>
        <button data-act="uiscale" title="Interface size (click to cycle)">UI ${Math.round(this.uiScale * 100)}%</button>
        <button data-act="menu" title="Pause menu: controls, settings, restart (Esc)">MENU</button>`);
  }

  private renderDistricts(): void {
    const w = this.game.world;
    let html = `<h3 class="collapsible" data-act="collapse:districts">${this.collapsed.has('districts') ? '▸' : '▾'} Districts</h3>`;
    if (this.collapsed.has('districts')) return this.set(this.districts, html);
    for (const d of w.districts.values()) {
      if (d.def.id === 'base') continue;
      if (d.locked) {
        const after = d.def.unlockAfter ? w.districts.get(d.def.unlockAfter)?.def.name : null;
        html += `<div class="district locked"><div class="row"><b>${d.def.name}</b><span class="muted">LOCKED</span></div><label>${after ? `Opens when ${after} is secured` : 'Not open yet'}</label></div>`;
        continue;
      }
      const hive = w.hives.filter((h) => h.alive && h.districtId === d.def.id);
      const status = d.secured && d.contested ? '<span class="warn">CONTESTED</span>' : d.secured ? '<span class="good">SECURED</span>' : d.cleared ? '<span class="warn">CLEAR — build outpost</span>' : '<span class="bad">INFESTED</span>';
      html += `<div class="district">
        <div class="row"><b class="dname" data-act="goto-district:${d.def.id}" title="Show on the map">${d.def.name}</b>${status}</div>
        <label>Infestation ${Math.ceil(d.infestation)}%${!d.secured && !hive.length ? ` · ${w.deadIn(d.def.id)} dead left` : ''}</label><div class="bar red"><i style="width:${d.infestation}%"></i></div>
        <label>Noise</label><div class="bar amber"><i style="width:${d.noise}%"></i></div>
        ${hive.map((h) => `<div class="row small"><span>Hive stage ${h.stage}/4</span></div>`).join('')}
        ${(() => {
          const st = w.structures.find((x) => x.alive && x.def.restore && x.districtId === d.def.id);
          return st ? `<div class="row small"><span>Power station</span>${st.built ? '<span class="good">ONLINE</span>' : '<span class="bad">OFFLINE</span>'}</div>` : '';
        })()}
      </div>`;
    }
    this.set(this.districts, html);
  }

  private renderObjectives(): void {
    const w = this.game.world;
    // the current tutorial region: the first open district that isn't secured yet (doc §17)
    const regions = [...w.districts.values()].filter((d) => d.def.id !== 'base');
    const cur = regions.find((d) => !d.locked && !d.secured) ?? regions[regions.length - 1];
    const id = cur.def.id;
    const hiveDown = w.hives.filter((h) => h.districtId === id).every((h) => !h.alive);
    const step = regions.indexOf(cur) + 1;
    const hiveCount = cur.def.hiveSites.length;
    const station = w.structures.find((s) => s.alive && s.def.restore && s.districtId === id);
    const items: [boolean, string][] = [
      [hiveDown, `Destroy the ${hiveCount > 1 ? `${hiveCount} hives` : 'hive'} <small>(engineer demo charge — bullets won't do it)</small>`],
      ...(cur.def.powerStations?.length
        ? [[!!station?.built || w.unlocked.has('medBay'), `Restore the power station <small>(clear the yard, then right-click it with engineers${station && !station.built ? `: ${Math.floor((station.buildProgress / station.def.buildTime) * 100)}%` : ''})</small>`] as [boolean, string]]
        : []),
      [cur.cleared || cur.secured, `Clear ${cur.def.name} to ${BALANCE.infestation.outpostMax}% or less <small>(${Math.ceil(cur.infestation)}%${hiveDown && !cur.secured ? `, ${w.deadIn(id)} dead left` : ''})</small>`],
      [cur.secured, 'Build an outpost there with engineers'],
    ];
    // survivors out in the field (STATUS #10): a standing reminder until they're evacuated
    const civ = w.squads.filter((s) => s.alive && s.def.category === 'civilian');
    const waiting = civ.reduce((n, s) => n + s.aliveCount, 0);
    if (waiting) items.push([false, `Escort ${waiting} survivor${waiting === 1 ? '' : 's'} to the Command Post <small>($${BALANCE.civilians.perPerson.money} + ${BALANCE.civilians.perPerson.supplies}▣ each)</small>`]);
    const region = `<div class="row small"><span>Region ${step} of ${regions.length}: <b>${cur.def.name}</b></span></div>`;
    const head = `<h3 class="collapsible" data-act="collapse:objectives">${this.collapsed.has('objectives') ? '▸' : '▾'} Objectives</h3>`;
    if (this.collapsed.has('objectives')) return this.set(this.objectives, head);
    this.set(this.objectives, `${head}${region}${items.map(([done, t]) => `<div class="obj ${done ? 'done' : ''}">${done ? '☑' : '☐'} ${t}</div>`).join('')}`);
  }

  private renderSelection(): void {
    const g = this.game;
    const sq = g.selectedSquads;
    const st = g.selectedStructure != null ? g.world.structures.find((s) => s.id === g.selectedStructure && s.alive) : undefined;
    if (!sq.length && st?.def.id === 'barracks') {
      this.set(this.selection, this.barracksPanel());
      return;
    }
    if (!sq.length && st?.def.id === 'commandPost') {
      const w = g.world;
      const rows = SUPPORT.map((d) => {
        const err = supportBlocked(w, d.id);
        const locked = !!d.requires && !!err && err.startsWith('Locked');
        const on = g.mode.kind === 'support' && g.mode.id === d.id;
        const cost = `$${d.cost.money}${d.cost.supplies ? ` · ${d.cost.supplies}▣` : ''} · ${d.cooldown}s cooldown`;
        const dot = `#${d.smoke.toString(16).padStart(6, '0')}`;
        return `<button class="cmd support ${err ? 'disabled' : ''} ${on ? 'on' : ''}" data-act="support:${d.id}" title="${esc(err ?? d.desc)}">
          <span class="smoke" style="background:${dot};color:${dot}"></span>
          <span><b>${locked ? '🔒 ' : ''}${d.name}</b><small>${locked ? esc(d.unlock) : err ? esc(err) : cost}</small></span></button>`;
      }).join('');
      const hint = g.mode.kind === 'support' ? 'Click the map to drop the marker smoke · right-click to cancel' : 'Pick a support power, then click the map. Each call-in is marked with its own smoke colour.';
      this.set(this.selection, `<h3>Command Post · Support</h3><div class="support-list">${rows}</div><p class="hint">${hint}</p>`);
      return;
    }
    if (!sq.length && st?.def.upgrade) {
      // round 11 #129: an outpost starts unarmed; its garrison is bought here
      const up = st.def.upgrade;
      const w = g.world;
      const busy = w.squads.find((s) => s.alive && s.currentOrder?.type === 'upgrade' && s.currentOrder.targetId === st.id);
      const noEng = !w.squads.some((s) => s.alive && s.def.canBuild?.length);
      const err = st.upgraded ? null : busy ? `${busy.name} ${busy.moving ? 'on the way' : `installing: ${Math.floor((busy.buildProgress / up.workSec) * 100)}%`}` : w.upgradeBlocked(st) ?? (noEng ? 'Needs an engineer team' : null);
      const hp = `<div class="row small"><span>Health</span><span>${Math.ceil(st.hp)} / ${st.def.hp}</span></div>`;
      const btn = st.upgraded
        ? `<div class="row small"><span class="good">✔ ${esc(up.name)}</span><span>${up.weapon.range} m all round</span></div>`
        : `<button class="cmd ${err ? 'disabled' : ''}" data-act="upgrade" title="${esc(up.desc)}"><span><b>Install ${esc(up.name)}</b><small>${err ? esc(err) : `$${up.cost.money} · ${up.cost.supplies}▣ · the nearest engineers, ${up.workSec} s`}</small></span></button>`;
      this.set(this.selection, `<h3>${esc(st.def.name)}</h3>${hp}${btn}<p class="hint">${esc(up.desc)}. Engineers install it (or right-click the outpost with engineers selected).</p>`);
      return;
    }
    if (!sq.length) {
      const all = g.world.squads.map((s) => `<button class="chip" data-act="focus:${s.id}">${esc(s.name)} <small>${s.aliveCount}/${s.members.length}</small></button>`).join('');
      this.set(this.selection, `<h3>Forces</h3><div class="chips">${all || '<i>No squads left.</i>'}</div><p class="hint">Click or drag to select · click the <b>Barracks</b> (B) to recruit · click the <b>Command Post</b> for support · right-click a car for cover</p>`);
      return;
    }
    const cards = sq
      .slice(0, 6)
      .map((s) => {
        const k = s.hp / s.maxHp;
        const bar = `<span class="hpbar"><i class="${k < 0.35 ? 'low' : k < 0.7 ? 'mid' : ''}" style="width:${(k * 100).toFixed(0)}%"></i></span>`;
        const pips = bar + s.members.map((m) => `<span class="pip ${m.alive ? '' : 'dead'}"></span>`).join('');
        const st = squadStatus(s, g.world);
        const lv = BALANCE.combat.levels;
        const next = lv[s.level + 1];
        const xp = next ? `${s.xp}/${next.xp} xp` : 'max';
        if (s.def.category === 'civilian')
          return `<div class="card"><div class="row"><b>${esc(s.name)}</b><span class="status ${st.tone}">${st.text}</span></div><div class="row small"><span>Civilians · unarmed</span></div>
          <div class="pips">${pips}</div>
          <div class="row small"><span>Evacuate at the Command Post: +$${BALANCE.civilians.perPerson.money * s.aliveCount}, +${BALANCE.civilians.perPerson.supplies * s.aliveCount}▣</span></div></div>`;
        return `<div class="card"><div class="row"><b>${esc(s.name)}</b><span class="status ${st.tone}">${st.text}</span></div><div class="row small"><span>${s.def.name}</span></div>
          <div class="pips">${pips}</div>
          <div class="row small"><span>${s.levelName} · ${xp}</span></div>
          <div class="row small"><span>Kills ${s.kills}</span><span>Upkeep ${s.def.upkeep}/day</span></div></div>`;
      })
      .join('');
    const eng = g.engineersOnly; // v4.9 #61: build tools only for an engineers-only selection
    const btn = (act: string, label: string, key: string, cost?: { money: number; supplies: number }, active = false) => {
      const afford = !cost || g.world.canAfford(cost);
      const c = cost ? `<small>$${cost.money} · ${cost.supplies}▣</small>` : '';
      return `<button class="cmd ${afford ? '' : 'disabled'} ${active ? 'on' : ''}" data-act="${act}"><kbd>${key}</kbd>${label}${c}</button>`;
    };
    const mode = g.mode;
    const civOnly = sq.every((s) => s.def.category === 'civilian');
    let cmds = civOnly ? btn('hold', 'Hold', 'H') + btn('stop', 'Stop', 'Ctrl+S') : btn('attackMove', 'Attack-move', 'Ctrl+A', undefined, mode.kind === 'attackMove') + btn('hold', 'Hold', 'H') + btn('crouch', sq.every((s) => s.crouched) ? 'Stand' : 'Crouch', 'G', undefined, sq.every((s) => s.crouched)) + btn('stop', 'Stop', 'Ctrl+S') + `<button class="cmd" data-act="disband" title="Walk back to the Barracks and stand down: frees command and upkeep, refunds ${BALANCE.economy.disbandRefund * 100}% of the cost">Disband</button>`;
    // engineers' build tools live in the bottom-centre build bar (round 9 #104; see renderBuildBar)
    void eng;
    const modeHint =
      mode.kind === 'build' ? `Placing ${STRUCTURES[mode.defId].name} — click to place · R ${STRUCTURES[mode.defId].arc ? `turns its ${STRUCTURES[mode.defId].arc}° field of fire` : 'rotate'} · Shift to keep placing · right-click cancel`
      : mode.kind === 'attackMove' ? 'Attack-move: click a destination'
      : mode.kind === 'charge' ? 'Click a hive to plant a demo charge'
      : mode.kind === 'deconstruct' ? 'Click something your engineers built to take it down (unstarted: full refund, built: half)'
      : civOnly ? 'Right-click to walk them · get them to the Command Post to evacuate them'
      : `${sq.length} selected · right-click a zombie to focus it · right-click a building to search it · Shift+right-click queues`;
    if (!this.selection.querySelector('.cards')) {
      this.cache.delete(this.selection);
      this.selection.innerHTML = '<div class="cards"></div><div class="cmds"></div><p class="hint"></p>';
      this.selCards = this.selection.querySelector('.cards')!;
      this.selCmds = this.selection.querySelector('.cmds')!;
    }
    this.set(this.selCards, cards);
    this.set(this.selCmds, cmds);
    this.set(this.selection.querySelector('.hint') as HTMLElement, modeHint);
  }

  /**
   * Engineer build menu (round 9 #104): pops up bottom-centre whenever the selection is engineers only.
   * One button per structure with an icon, hotkey and cost; locked or unaffordable items stay visible,
   * greyed out, with the reason.
   */
  private renderBuildBar(): void {
    const g = this.game;
    const show = g.engineersOnly;
    this.root.classList.toggle('with-build', show);
    this.buildBar.style.display = show ? 'flex' : 'none';
    if (!show) return this.set(this.buildBar, '');
    const w = g.world;
    const mode = g.mode;
    const items = BUILD_MENU.map((it) => {
      let active = false;
      let reason = '';
      let cost = '';
      if (it.kind === 'structure') {
        const def = STRUCTURES[it.id];
        cost = `$${def.cost.money} · ${def.cost.supplies}▣`;
        active = mode.kind === 'build' && mode.defId === it.id;
        if (def.unlock && !w.unlocked.has(def.unlock)) reason = `Locked: ${it.unlock ?? 'not unlocked yet'}`;
        else if (!w.canAfford(def.cost)) reason = 'Not enough $ / supplies';
      } else if (it.id === 'charge') {
        const c = ABILITIES.demoCharge.cost;
        cost = `$${c.money} · ${c.supplies}▣`;
        active = mode.kind === 'charge';
        if (!w.canAfford(c)) reason = 'Not enough $ / supplies';
      } else {
        cost = 'refund';
        active = mode.kind === 'deconstruct';
      }
      const act = it.kind === 'structure' ? `build:${it.id}` : it.id;
      const locked = reason.startsWith('Locked');
      return `<button class="bb ${reason ? 'disabled' : ''} ${locked ? 'locked' : ''} ${active ? 'on' : ''}" data-act="${act}" title="${esc(reason || it.tip)}">
        <span class="bb-icon">${locked ? ICON.lock : ICON[it.icon]}</span>
        <span class="bb-name">${esc(it.name)}</span>
        <span class="bb-meta"><kbd>${it.key}</kbd>${esc(cost)}</span>
        ${reason ? `<span class="bb-why">${esc(locked ? it.unlock ?? 'Locked' : reason)}</span>` : ''}
      </button>`;
    }).join('');
    this.set(this.buildBar, `<div class="bb-title">ENGINEERS · BUILD</div><div class="bb-row">${items}</div>`);
  }

  private barracksPanel(): string {
    const g = this.game;
    const w = g.world;
    const barracks = w.structures.find((s) => s.def.id === 'barracks');
    const queue = barracks?.queue ?? [];
    const recruitable = Object.values(UNITS).filter((u) => u.category !== 'civilian');
    const avail = recruitable.filter((u) => !u.requires || isEnabled(u.requires as never));
    const locked = recruitable.filter((u) => u.requires && !isEnabled(u.requires as never));
    const rows = avail
      .map((u) => {
        const ok = w.canAfford(u.cost) && (!w.hasCommandCap || w.commandUsed + u.command <= w.commandCap);
        return `<button class="prod ${ok ? '' : 'disabled'}" data-act="produce:${u.id}">
          <b>${u.name}</b><small>$${u.cost.money} · ${u.cost.supplies}▣ · ★${u.command} · ${u.buildTime}s</small></button>`;
      })
      .join('');
    // round 14 #173: runs of the same unit as one line, "Rifle Squad ×5" (the first one's time to go)
    const runs: { defId: string; n: number; first: boolean; remaining: number }[] = [];
    queue.forEach((j, i) => {
      const last = runs[runs.length - 1];
      if (last && last.defId === j.defId) last.n++;
      else runs.push({ defId: j.defId, n: 1, first: i === 0, remaining: j.remaining });
    });
    const q = runs.map((r) => `<div class="qitem">${UNITS[r.defId].name}${r.n > 1 ? ` ×${r.n}` : ''}${r.first ? ` <small>${Math.ceil(r.remaining)}s</small>` : ''}</div>`).join('');
    const lockedHtml = locked.map((u) => `<div class="locked" title="${esc(u.unlock)}">🔒 ${u.name}<small>${esc(u.unlock)}</small></div>`).join('');
    const rallyOn = g.mode.kind === 'rally';
    return `<h3>Barracks · Recruit</h3><div class="prod-list">${rows}</div>${q ? `<div class="queue">${q}</div>` : ''}
      <div class="cmds"><button class="cmd ${rallyOn ? 'on' : ''}" data-act="rally">⚑ Set rally point</button></div>
      <p class="hint">${rallyOn ? 'Click the map where new squads should gather · right-click to cancel' : `★ ${w.commandUsed}${w.hasCommandCap ? `/${w.commandCap}` : ''} command used. New squads walk to the rally flag.`}</p>
      <details><summary>Roster roadmap (${locked.length} locked)</summary>${lockedHtml}</details>`;
  }

  private showIntro(): void {
    this.modal.innerHTML = `<div class="dialog">
      <h1>DEAD BLOCK <span>COMMAND</span></h1>
      <p class="tag">Reclaim it block by block.</p>
      <p>You hold a fortified base on the city's edge. East of the gate, <b>Roadside Motel</b> is 65% infested and a <b>hive</b> is growing in the southeast lot. Every few minutes it sends a horde at your lines, and every stage it gets worse. It never gets better on its own.</p>
      <div class="cols one">
        <div><h3>Field notes</h3>
          <ul>
            <li>Squads <b>lock onto one target</b> and finish it, unless something gets danger-close.</li>
            <li>Cover cuts incoming damage ~45–55%. Open ground gets people killed.</li>
            <li>Gunfire is <b>noise</b>. Fill the noise meter and the whole district comes for you.</li>
            <li>A wiped squad is gone for good, along with its experience.</li>
            <li>Upkeep comes out of supplies at the end of each day.</li>
          </ul></div>
      </div>
      <p class="hint">Press <kbd>Esc</kbd> (or <b>MENU</b>, top right) any time for the controls, settings and restart.</p>
      ${(() => {
        const s = latestSlot();
        const m = s ? slotMeta(s) : null;
        return s && m ? `<button class="big" data-act="continue-save:${s}">CONTINUE <small>day ${m.summary.day} · ${esc(m.summary.region)}</small></button>` : '';
      })()}
      <button class="big" data-act="start:training">DEPLOY WITH TRAINING</button>
      <button class="big ghost" data-act="start">DEPLOY (skip training)</button>
    </div>`;
    this.modal.classList.add('open');
  }

  private menuWasPaused = false;

  /** Pause menu (round 10 #105): open/close; the game pauses while it's open. */
  toggleMenu(): void {
    const g = this.game;
    if (g.menuOpen) {
      g.menuOpen = false;
      this.modal.classList.remove('open');
      g.paused = this.menuWasPaused;
    } else {
      if (this.modal.classList.contains('open')) return; // a briefing / intro / end screen is up
      this.menuWasPaused = g.paused;
      g.menuOpen = true;
      g.paused = true;
      this.showMenu('main');
    }
    g.changed();
  }

  private showMenu(page: MenuPage): void {
    const tab = (p: MenuPage, label: string) => `<button class="${page === p ? 'on' : ''}" data-act="menu-page:${p}">${label}</button>`;
    let body = '';
    if (page === 'main') {
      body = `<p class="tag">PAUSED</p>
        <button class="big" data-act="resume">RESUME</button>
        <div class="menu-row">${tab('saves', 'Save / Load')}${tab('controls', 'Controls')}${tab('settings', 'Settings')}<button data-act="restart-confirm">Restart</button></div>`;
    } else if (page === 'saves') {
      body = `<table class="settings saves">${SLOTS.map((s) => this.slotRow(s, this.slotConfirm)).join('')}</table>
        <p class="hint">Saves live in this browser. The game also autosaves every ${AUTOSAVE_SEC / 60} minutes and whenever a district is secured. Loading reloads the page.</p>`;
    } else if (page === 'controls') {
      body = `<div class="keys">${CONTROLS.map(([group, rows]) => `<h3>${group}</h3><table>${rows.map(([k, what]) => `<tr><td>${k}</td><td>${what}</td></tr>`).join('')}</table>`).join('')}</div>`;
    } else if (page === 'settings') {
      const vol = this.sound ? (this.sound.volume ? `${Math.round(this.sound.volume * 100)}%` : 'Off') : 'n/a';
      body = `<table class="settings">
        <tr><td>Sound volume</td><td><button data-act="volume">${vol}</button></td></tr>
        <tr><td>Interface size</td><td><button data-act="uiscale">${Math.round(this.uiScale * 100)}%</button></td></tr>
      </table><p class="hint">Both are remembered in this browser.</p>`;
    } else {
      body = `<p>Restart the campaign from the beginning? Anything since your last save is lost.</p>
        <button class="big" data-act="restart">YES, RESTART</button> <button class="big ghost" data-act="menu-page:main">CANCEL</button>`;
    }
    if (page !== 'saves') this.slotConfirm = null;
    const nav = page === 'main' ? '' : `<div class="menu-row">${tab('main', '‹ Back')}${tab('saves', 'Save / Load')}${tab('controls', 'Controls')}${tab('settings', 'Settings')}<button data-act="resume">Resume</button></div>`;
    this.modal.innerHTML = `<div class="dialog small menu"><h1>DEAD BLOCK <span>COMMAND</span></h1>${nav}${body}</div>`;
    this.modal.classList.add('open');
  }

  /** A tutorial region just opened (doc §17): what's new there, game paused while you read. */
  private showBriefing(id: string, name: string, unlocks: string[]): void {
    const tower = unlocks.includes('guardTower');
    const T = STRUCTURES.guardTower;
    const intro: Record<string, string> = {
      gasStrip: `<p>The wire on the east road is cut. Expect a step up: a bigger crowd, <b>Runner packs</b> that hunt together, and a hive that's already at <b>stage 2</b>. Its hordes will go for your newest outpost, so leave it defended.</p>`,
      railSiding: `<p>The fence south of the strip is down. <b>Rail Siding</b> is the last training region and the biggest: a goods yard cut in two by a line of boxcars, <b>two hives</b>, and the dead at full strength.</p>
      <h3>New: the power system</h3>
      <p>In the east yard stands a <b>power station</b>, dead. Clear the yard, then <b>right-click the station with engineers</b> to restore it. They can only work while no zombie is within 30 m, so hold the ground around them. Power brings the base back to life and unlocks the <b>Med Bay</b>. If the dead wreck the station it goes dark again until your engineers restore it.</p>
      <h3>New: survivors</h3>
      <p>People are hiding in the houses here. <b>Searching a building</b> can turn up a group of <b>civilians</b>: select them like a squad and <b>walk them to the Command Post</b> to evacuate them for <b>$${BALANCE.civilians.perPerson.money} and ${BALANCE.civilians.perPerson.supplies} supplies each</b>. They're unarmed and slow, and the dead go for them first, so escort them.</p>`,
    };
    this.game.paused = true;
    this.modal.innerHTML = `<div class="dialog small">
      <p class="tag">NEW REGION OPEN</p>
      <h1>${esc(name)}</h1>
      ${intro[id] ?? `<p>The fence is down. Same drill: find the hive, kill it, plant an outpost.</p>`}
      ${tower ? `<h3>New: Guard Tower</h3>
      <p>Engineers can now build a <b>Guard Tower</b> (<kbd>V</kbd>, $${T.cost.money} · ${T.cost.supplies}▣). <b>Right-click it</b> with a squad to man it: they shoot <b>${Math.round(((T.garrison?.rangeMult ?? 1) - 1) * 100)}% further</b>, see over cars and walls, and the dead can't claw at them. They have to tear the tower down first. Any other order brings the squad back down.</p>` : ''}
      <button class="big" data-act="continue">GOT IT</button>
    </div>`;
    this.modal.classList.add('open');
  }

  /** The first time the power comes on (v4.17): the Med Bay is unlocked. */
  private showPowerBriefing(): void {
    const M = STRUCTURES.medBay;
    const H = M.heal!;
    this.game.paused = true;
    this.modal.innerHTML = `<div class="dialog small">
      <p class="tag">POWER RESTORED</p>
      <h1>Med Bay unlocked</h1>
      <p>Engineers can now build a <b>Med Bay</b> inside the main base (<kbd>N</kbd>, $${M.cost.money} · ${M.cost.supplies}▣).</p>
      <p>A squad that <b>rests next to it</b> (not moving, not hit for ${H.restAfterHitSec} s) heals about ${Math.round(H.perSec * 100 * 60)}% of its health a minute, paid for in supplies. As its health climbs back, <b>lost soldiers rejoin</b> the squad. A squad that's wiped out is still gone for good.</p>
      <p>The Med Bay runs on the station's power: if the dead wreck the station, the Med Bay goes dark until your engineers restore it.</p>
      <button class="big" data-act="continue">GOT IT</button>
    </div>`;
    this.modal.classList.add('open');
  }

  private showEnd(win: boolean, reason: string): void {
    this.game.paused = true;
    this.modal.innerHTML = `<div class="dialog small">
      <h1 class="${win ? 'good' : 'bad'}">${win ? 'BLOCK SECURED' : 'COMMAND LOST'}</h1>
      <p>${esc(reason)}</p>
      <p class="stats">Day ${this.game.world.day} · ${fmtTime(this.game.world.time)} on the clock</p>
      ${win ? '<button class="big" data-act="continue">KEEP HOLDING</button>' : ''}
      <button class="big ${win ? 'ghost' : ''}" data-act="restart">${win ? 'NEW CAMPAIGN' : 'TRY AGAIN'}</button>
    </div>`;
    this.modal.classList.add('open');
  }
}
