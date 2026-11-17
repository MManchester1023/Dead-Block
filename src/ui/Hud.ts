import { BALANCE } from '../config/balance';
import { FEATURES } from '../config/features';
import { ABILITIES, STRUCTURES, UNITS } from '../config/units';
import { isEnabled } from '../config/features';
import type { Game } from '../Game';
import { Radio } from './Radio';

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** DOM HUD. Rebuilt at ~8 Hz, or immediately on selection/mode changes. */
export class Hud {
  private top!: HTMLElement;
  private districts!: HTMLElement;
  private objectives!: HTMLElement;
  private selection!: HTMLElement;
  private production!: HTMLElement;
  private radioEl!: HTMLElement;
  private toastEl!: HTMLElement;
  private modal!: HTMLElement;
  private radio: Radio;
  private dirty = true;
  private last = 0;
  private toastTimer = 0;

  constructor(private game: Game, root: HTMLElement) {
    root.innerHTML = `
      <div class="hud-top"></div>
      <div class="hud-objectives panel"></div>
      <div class="hud-districts panel"></div>
      <div class="hud-bottom">
        <div class="hud-selection panel"></div>
        <div class="hud-production panel"></div>
        <div class="hud-radio panel"></div>
      </div>
      <div class="toast"></div>
      <div class="modal"></div>`;
    const q = (s: string) => root.querySelector(s) as HTMLElement;
    this.top = q('.hud-top');
    this.objectives = q('.hud-objectives');
    this.districts = q('.hud-districts');
    this.selection = q('.hud-selection');
    this.production = q('.hud-production');
    this.radioEl = q('.hud-radio');
    this.toastEl = q('.toast');
    this.modal = q('.modal');

    this.radio = new Radio(game.world, () => (this.dirty = true));
    game.onChange(() => (this.dirty = true));
    game.toast = (m) => this.toast(m);

    // act on pointerdown: the HUD re-renders several times a second, and a 'click' is lost if the
    // button is replaced between mousedown and mouseup (that was the "click twice" bug)
    root.addEventListener('pointerdown', (e) => {
      if (e.button === 0) this.click(e);
    });
    game.world.events.on('victory', (e) => this.showEnd(true, e.reason));
    game.world.events.on('defeat', (e) => this.showEnd(false, e.reason));
    this.showIntro();
  }

  private cache = new WeakMap<HTMLElement, string>();
  /** Only touch the DOM when a panel's content actually changed (keeps buttons, scroll and <details> stable). */
  private set(el: HTMLElement, html: string): void {
    if (this.cache.get(el) === html) return;
    this.cache.set(el, html);
    el.innerHTML = html;
  }

  toast(msg: string): void {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    this.toastTimer = 2.2;
  }

  private click(e: PointerEvent): void {
    const btn = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!btn || btn.classList.contains('disabled')) return;
    const g = this.game;
    const [act, arg] = btn.dataset.act!.split(':');
    switch (act) {
      case 'produce': g.produce(arg); break;
      case 'build': g.startBuild(arg); break;
      case 'charge': g.setMode({ kind: 'charge' }); break;
      case 'deconstruct': g.setMode({ kind: 'deconstruct' }); break;
      case 'attackMove': g.setMode({ kind: 'attackMove' }); break;
      case 'hold': g.hold(); break;
      case 'stop': g.stop(); break;
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
      case 'rot': g.renderer.rig.rotate(Number(arg)); break;
      case 'start':
        this.modal.classList.remove('open');
        g.paused = false;
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
    this.renderProduction();
    this.renderRadio();
  }

  private renderTop(): void {
    const w = this.game.world;
    const g = this.game;
    const dayPct = (w.dayTimer / BALANCE.economy.dayLengthSec) * 100;
    const upkeep = w.squads.reduce((n, s) => n + s.def.upkeep, 0);
    const speeds = [1, 2, 4].map((s) => `<button class="${g.speed === s ? 'on' : ''}" data-act="speed:${s}">${s}×</button>`).join('');
    this.set(this.top, `
      <div class="brand">DEAD BLOCK <span>COMMAND</span></div>
      <div class="res" title="Money — the hard resource"><b>$</b>${Math.floor(w.money)}</div>
      <div class="res" title="Supplies (cap)"><b>▣</b>${Math.floor(w.supplies)}<small>/${w.supplyCap}</small></div>
      <div class="res" title="Command used / cap"><b>★</b>${w.commandUsed}<small>/${w.commandCap}</small></div>
      <div class="res day" title="Upkeep is charged at the end of each day">
        Day ${w.day}<div class="bar"><i style="width:${dayPct}%"></i></div><small>upkeep −${upkeep}</small>
      </div>
      <div class="speed">
        <button class="${g.paused ? 'on warn' : ''}" data-act="pause">${g.paused ? '▶ PAUSED' : '❚❚'}</button>${speeds}
        <button data-act="rot:-1" title="Rotate camera (Q)">⟲</button><span class="compass" title="Camera heading">VIEW ${Math.round(g.renderer.rig.headingDeg)}° ${g.renderer.rig.headingLabel}</span><button data-act="rot:1" title="Rotate camera (E)">⟳</button>
        <button data-act="ops" title="Operations map (M)">${g.renderer.rig.strategic ? 'STREET' : 'OPS MAP'}</button>
      </div>`);
  }

  private renderDistricts(): void {
    const w = this.game.world;
    let html = '<h3>Districts</h3>';
    for (const d of w.districts.values()) {
      if (d.def.id === 'base') continue;
      const hive = w.hives.filter((h) => h.alive && h.districtId === d.def.id);
      const status = d.secured ? '<span class="good">SECURED</span>' : d.cleared ? '<span class="warn">CLEAR — build outpost</span>' : '<span class="bad">INFESTED</span>';
      html += `<div class="district">
        <div class="row"><b>${d.def.name}</b>${status}</div>
        <label>Infestation ${Math.ceil(d.infestation)}%</label><div class="bar red"><i style="width:${d.infestation}%"></i></div>
        <label>Noise</label><div class="bar amber"><i style="width:${d.noise}%"></i></div>
        ${hive.map((h) => `<div class="row small"><span>Hive stage ${h.stage}/4</span><span>next pulse ${fmtTime(Math.max(0, h.pulseTimer))}</span></div>`).join('')}
      </div>`;
    }
    this.set(this.districts, html);
  }

  private renderObjectives(): void {
    const w = this.game.world;
    const motel = w.districts.get('motel')!;
    const hiveDown = w.hives.filter((h) => h.districtId === 'motel').every((h) => !h.alive);
    const items = [
      [hiveDown, 'Destroy the hive <small>(engineer demo charge — bullets won\'t do it)</small>'],
      [motel.cleared || motel.secured, `Clear Roadside Motel to 0% <small>(${Math.ceil(motel.infestation)}%)</small>`],
      [motel.secured, 'Build an outpost there with engineers'],
    ] as const;
    this.set(this.objectives, `<h3>Objectives</h3>${items.map(([done, t]) => `<div class="obj ${done ? 'done' : ''}">${done ? '☑' : '☐'} ${t}</div>`).join('')}`);
  }

  private renderSelection(): void {
    const g = this.game;
    const sq = g.selectedSquads;
    if (!sq.length) {
      const all = g.world.squads.map((s) => `<button class="chip" data-act="focus:${s.id}">${esc(s.name)} <small>${s.aliveCount}/${s.members.length}</small></button>`).join('');
      this.set(this.selection, `<h3>Forces</h3><div class="chips">${all || '<i>No squads left.</i>'}</div><p class="hint">Click or drag to select · right-click to move · right-click a car for cover</p>`);
      return;
    }
    const cards = sq
      .slice(0, 6)
      .map((s) => {
        const pips = s.members.map((m) => `<span class="pip ${!m.alive ? 'dead' : m.hp / m.maxHp < 0.35 ? 'low' : m.hp / m.maxHp < 0.7 ? 'mid' : ''}"></span>`).join('');
        const order = s.holding ? 'Holding' : s.currentOrder ? { move: 'Moving', attackMove: 'Attack-moving', cover: 'To cover', build: 'Building', charge: 'Planting charge', hold: 'Holding', patrol: 'Patrol', attack: 'Attacking target', deconstruct: 'Deconstructing' }[s.currentOrder.type] : 'Idle';
        const lv = BALANCE.combat.levels;
        const next = lv[s.level + 1];
        const xp = next ? `${s.xp}/${next.xp} xp` : 'max';
        return `<div class="card"><div class="row"><b>${esc(s.name)}</b><small>${s.def.name}</small></div>
          <div class="pips">${pips}</div>
          <div class="row small"><span>${s.levelName} · ${xp}</span><span>${order}${s.inCover ? ' · cover' : ''}</span></div>
          <div class="row small"><span>Kills ${s.kills}</span><span>Upkeep ${s.def.upkeep}/day</span></div></div>`;
      })
      .join('');
    const eng = g.selectedEngineers.length > 0;
    const btn = (act: string, label: string, key: string, cost?: { money: number; supplies: number }, active = false) => {
      const afford = !cost || g.world.canAfford(cost);
      const c = cost ? `<small>$${cost.money} · ${cost.supplies}▣</small>` : '';
      return `<button class="cmd ${afford ? '' : 'disabled'} ${active ? 'on' : ''}" data-act="${act}"><kbd>${key}</kbd>${label}${c}</button>`;
    };
    const mode = g.mode;
    let cmds = btn('attackMove', 'Attack-move', 'A', undefined, mode.kind === 'attackMove') + btn('hold', 'Hold', 'H') + btn('stop', 'Stop', 'S');
    if (eng) {
      const b = (id: string, key: string) => btn(`build:${id}`, STRUCTURES[id].name, key, STRUCTURES[id].cost, mode.kind === 'build' && mode.defId === id);
      cmds += '<div class="sep"></div>' + b('sandbags', 'F') + b('wire', 'G') + b('mgNest', 'T') + b('outpost', 'O') + btn('charge', 'Demo Charge', 'C', ABILITIES.demoCharge.cost, mode.kind === 'charge') + btn('deconstruct', 'Deconstruct', 'X', undefined, mode.kind === 'deconstruct');
    }
    const modeHint =
      mode.kind === 'build' ? `Placing ${STRUCTURES[mode.defId].name} — click to place · R rotate · Shift to keep placing · right-click cancel`
      : mode.kind === 'attackMove' ? 'Attack-move: click a destination'
      : mode.kind === 'charge' ? 'Click a hive to plant a demo charge'
      : mode.kind === 'deconstruct' ? 'Click something your engineers built to take it down (unstarted: full refund, built: half)'
      : `${sq.length} selected · right-click a zombie to focus it · Shift+right-click queues · Ctrl+1–9 groups`;
    this.set(this.selection, `<div class="cards">${cards}</div><div class="cmds">${cmds}</div><p class="hint">${modeHint}</p>`);
  }

  private renderProduction(): void {
    const w = this.game.world;
    const barracks = w.structures.find((s) => s.def.id === 'barracks');
    const queue = barracks?.queue ?? [];
    const avail = Object.values(UNITS).filter((u) => !u.requires || isEnabled(u.requires as never));
    const locked = Object.values(UNITS).filter((u) => u.requires && !isEnabled(u.requires as never));
    const rows = avail
      .map((u) => {
        const ok = w.canAfford(u.cost) && w.commandUsed + u.command <= w.commandCap;
        return `<button class="prod ${ok ? '' : 'disabled'}" data-act="produce:${u.id}">
          <b>${u.name}</b><small>$${u.cost.money} · ${u.cost.supplies}▣ · ★${u.command} · ${u.buildTime}s</small></button>`;
      })
      .join('');
    const q = queue.map((j, i) => `<div class="qitem">${UNITS[j.defId].name}${i === 0 ? ` <small>${Math.ceil(j.remaining)}s</small>` : ''}</div>`).join('');
    const lockedHtml = locked.map((u) => `<div class="locked" title="${esc(u.unlock)}">🔒 ${u.name}<small>${esc(u.unlock)}</small></div>`).join('');
    this.set(this.production, `<h3>Barracks</h3>${rows}${q ? `<div class="queue">${q}</div>` : ''}
      <details><summary>Roster roadmap (${locked.length} locked)</summary>${lockedHtml}</details>`);
  }

  private renderRadio(): void {
    const lines = this.radio.lines.slice(-7);
    this.set(this.radioEl, `<h3>Radio</h3>${lines.map((l) => `<div class="line ${l.tone}"><b>${esc(l.speaker)}:</b> ${esc(l.text)}</div>`).join('')}`);
    this.radioEl.scrollTop = this.radioEl.scrollHeight;
  }

  private showIntro(): void {
    const tiers = [0, 1, 2, 3, 4].map((t) => {
      const fs = FEATURES.filter((f) => f.tier === t);
      return `<div class="tier"><b>Tier ${t}</b> ${fs.map((f) => `<span class="feat ${f.enabled ? 'on' : ''}" title="${f.docRef}">${f.name}</span>`).join('')}</div>`;
    }).join('');
    this.modal.innerHTML = `<div class="dialog">
      <h1>DEAD BLOCK <span>COMMAND</span></h1>
      <p class="tag">Reclaim it block by block.</p>
      <p>You hold a fortified base on the city's edge. East of the gate, <b>Roadside Motel</b> is 65% infested and a <b>hive</b> is growing in the southeast lot. Every four minutes it sends a horde at your lines, and every stage it gets worse. It never gets better on its own.</p>
      <div class="cols">
        <div><h3>Controls</h3>
          <ul>
            <li><kbd>LMB</kbd> select · drag to box-select · <kbd>Shift</kbd> add</li>
            <li><kbd>RMB</kbd> move · on a zombie = attack it · on a car/sandbags = take cover · on hive = charge it</li>
            <li><kbd>A</kbd> attack-move · <kbd>H</kbd> hold · <kbd>S</kbd> stop</li>
            <li><kbd>Shift</kbd>+<kbd>RMB</kbd> queue waypoints · <kbd>Ctrl</kbd>+<kbd>1-9</kbd> groups</li>
            <li>Engineers: <kbd>F</kbd> sandbags · <kbd>G</kbd> wire · <kbd>T</kbd> MG nest · <kbd>O</kbd> outpost · <kbd>C</kbd> demo charge · <kbd>X</kbd> deconstruct · <kbd>R</kbd> rotate</li>
            <li><kbd>Arrows</kbd>/edge/<kbd>Shift</kbd>+<kbd>MMB</kbd> pan · wheel zoom · <kbd>MMB</kbd> drag or <kbd>Q</kbd>/<kbd>E</kbd> rotate · <kbd>M</kbd> ops map</li>
            <li><kbd>Space</kbd> pause · <kbd>+</kbd>/<kbd>-</kbd> speed · <kbd>P</kbd> pixel filter</li>
          </ul></div>
        <div><h3>Field notes</h3>
          <ul>
            <li>Squads <b>lock onto one target</b> and finish it, unless something gets danger-close.</li>
            <li>Cover cuts incoming damage ~45–55%. Open ground gets people killed.</li>
            <li>Gunfire is <b>noise</b>. Fill the noise meter and the whole district comes for you.</li>
            <li>A wiped squad is gone for good, along with its experience.</li>
            <li>Upkeep comes out of supplies at the end of each day.</li>
          </ul></div>
      </div>
      <details class="roadmap"><summary>Build roadmap: what's in this MVP vs. coming next</summary>${tiers}</details>
      <button class="big" data-act="start">DEPLOY</button>
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
