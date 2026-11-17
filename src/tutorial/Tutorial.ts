import type { Game } from '../Game';

/**
 * Guided tutorial (doc §17–18). Each step first shows a prompt with the game paused; on "Got it"
 * it becomes an objective banner and the game runs until the step's condition is met. Steps whose
 * condition is already true advance on their own, so players who are ahead aren't held back.
 */
export interface TutorialStep {
  id: string;
  title: string;
  /** Explanation shown in the paused prompt. */
  text: string;
  /** Short instruction kept on screen after dismissing. Omit for info-only steps. */
  objective?: string;
  /** Completion condition (checked every frame while the objective is showing). */
  done?: (g: Game, t: Tutorial) => boolean;
  /** HUD element(s) to pulse while this step is active. */
  highlight?: string;
}

export class Tutorial {
  index = 0;
  phase: 'prompt' | 'objective' | 'finished' = 'prompt';
  /** Scratch state steps can stash things in (e.g. the camera position when a step began). */
  memo: Record<string, number> = {};
  private el: HTMLElement;
  private lastHtml = '';
  private highlighted: Element[] = [];
  private confirmSkip = false;

  constructor(private game: Game, private steps: TutorialStep[], root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'tutorial';
    root.appendChild(this.el);
    this.el.addEventListener('pointerdown', (e) => {
      const act = (e.target as HTMLElement).closest('[data-tut]') as HTMLElement | null;
      if (!act) return;
      e.stopPropagation();
      if (act.dataset.tut === 'ok') this.dismiss();
      if (act.dataset.tut === 'step') this.skipStep();
      if (act.dataset.tut === 'skip') {
        // ending the whole tutorial takes a second click, so it can't happen by accident
        if (this.confirmSkip) this.finish();
        else {
          this.confirmSkip = true;
          this.lastHtml = '';
          this.render();
        }
      }
    });
  }

  get step(): TutorialStep | undefined {
    return this.steps[this.index];
  }

  start(): void {
    this.index = 0;
    this.enter();
  }

  private enter(): void {
    const s = this.step;
    if (!s) return this.finish();
    this.phase = 'prompt';
    this.memo.enteredAt = this.game.world.time;
    const cam = this.game.renderer.rig;
    this.memo.camX = cam.target.x;
    this.memo.camZ = cam.target.z;
    this.memo.camZoom = cam.zoom;
    this.memo.camYaw = cam.yaw;
    this.game.paused = true;
    this.game.changed();
  }

  private dismiss(): void {
    const s = this.step;
    if (!s) return;
    if (s.objective && s.done) {
      this.phase = 'objective';
      this.game.paused = false;
    } else this.next();
    this.game.changed();
  }

  /** v4.9 (#45): skip just this step and move on. */
  private skipStep(): void {
    this.next();
    this.game.changed();
  }

  private next(): void {
    this.confirmSkip = false;
    this.index++;
    if (this.index >= this.steps.length) return this.finish();
    this.enter();
  }

  finish(): void {
    this.phase = 'finished';
    this.game.paused = false;
    this.setHighlight(undefined);
    this.el.innerHTML = '';
    this.el.style.display = 'none';
    this.game.changed();
  }

  update(): void {
    if (this.phase === 'finished') return;
    const s = this.step;
    if (!s) return this.finish();
    if (this.phase === 'objective' && s.done?.(this.game, this)) {
      this.game.world.events.emit('radio', { speaker: 'Instructor', text: `Good. ${s.title} — done.`, tone: 'good' });
      this.next();
    }
    this.setHighlight(this.step?.highlight);
    this.render();
  }

  private setHighlight(sel?: string): void {
    const els = sel ? Array.from(document.querySelectorAll(sel)) : [];
    if (els.length === this.highlighted.length && els.every((e, i) => e === this.highlighted[i])) return;
    for (const e of this.highlighted) e.classList.remove('tut-highlight');
    for (const e of els) e.classList.add('tut-highlight');
    this.highlighted = els;
  }

  private render(): void {
    const s = this.step;
    if (!s) return;
    const n = `${this.index + 1}/${this.steps.length}`;
    const skipAll = `<button class="tut-skip ${this.confirmSkip ? 'confirm' : ''}" data-tut="skip">${this.confirmSkip ? 'Click again to end training' : 'Skip tutorial'}</button>`;
    const skipStep = s.objective ? '<button data-tut="step">Skip step</button>' : '';
    const html =
      this.phase === 'prompt'
        ? `<div class="tut-card"><div class="tut-head"><span>TRAINING · ${n}</span><span class="tut-btns">${skipStep}${skipAll}</span></div>
           <h2>${s.title}</h2><p>${s.text}</p>
           ${s.objective ? `<p class="tut-obj">▶ ${s.objective}</p>` : ''}
           <button class="big" data-tut="ok">${s.objective ? 'Got it' : 'Continue'}</button>
           <div class="tut-paused">Game paused while you read</div></div>`
        : `<div class="tut-banner"><span class="tut-n">TRAINING ${n}</span><b>${s.title}</b><span>${s.objective ?? ''}</span><span class="tut-btns"><button data-tut="step">Skip step</button>${skipAll}</span></div>`;
    if (html !== this.lastHtml) {
      this.el.innerHTML = html;
      this.lastHtml = html;
      this.el.style.display = 'block';
      this.el.classList.toggle('blocking', this.phase === 'prompt');
    }
  }
}

// ---------------------------------------------------------------- mission 1: Roadside Motel

export const ROADSIDE_MOTEL_TUTORIAL: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Dead Block Command',
    text: "This is your base on the edge of the city. East of the gate is <b>Roadside Motel</b>, overrun. Your job: take it back.<br><br>Each <b>squad</b> is a handful of soldiers. They die one at a time, and a squad that loses everyone is <b>gone for good</b>, experience and all.",
  },
  {
    id: 'camera',
    title: 'Look around',
    text: 'Move the camera: <b>WASD</b>, the <b>arrow keys</b> or push the mouse to the <b>screen edge</b> to pan, <b>mouse wheel</b> to zoom, <b>hold the middle mouse button and drag</b> (or press <b>Q / E</b>) to rotate.',
    objective: 'Pan, zoom or rotate the camera.',
    done: (g, t) => {
      const c = g.renderer.rig;
      return Math.hypot(c.target.x - t.memo.camX, c.target.z - t.memo.camZ) > 15 || Math.abs(c.zoom - t.memo.camZoom) > 0.3 || Math.abs(c.yaw - t.memo.camYaw) > 0.3;
    },
  },
  {
    id: 'select',
    title: 'Select your squads',
    text: '<b>Left-click</b> a squad to select it, or <b>drag a box</b> around several. You can also click their names in the Forces panel. <b>Ctrl+1–9</b> saves a group.',
    objective: 'Select a squad.',
    done: (g) => g.selectedSquads.length > 0,
    highlight: '.hud-selection',
  },
  {
    id: 'move',
    title: 'Move out',
    text: '<b>Right-click</b> the ground to move there. Hold <b>Shift</b> to queue waypoints. <b>Ctrl+A</b> then click is an attack-move (stop and fight anything on the way).',
    objective: 'Move a squad out through the gate onto the road.',
    done: (g) => g.world.squads.some((s) => s.pos.x > g.world.map.baseRect.x + g.world.map.baseRect.w + 6),
  },
  {
    id: 'cover',
    title: 'Get into cover',
    text: 'Abandoned cars, sandbags and walls are <b>cover</b>: they cut incoming damage roughly in half. <b>Right-click a car</b> to have a squad take cover behind it. Open ground gets people killed.',
    objective: 'Put a squad in cover behind a car.',
    done: (g) => g.world.squads.some((s) => s.inCover > 0),
  },
  {
    id: 'noise',
    title: 'Noise and targets',
    text: 'Gunfire is <b>loud</b>: every zombie within ~100 m hears a rifle and comes looking. The district <b>Noise</b> meter (top right) fills as you fight; fill it and the whole district comes at once.<br><br>Squads lock onto one zombie and finish it, unless something gets right on top of them. <b>Right-click a zombie</b> to make them shoot that one.',
    highlight: '.hud-districts',
  },
  {
    id: 'fortify',
    title: 'Dig in',
    text: 'Engineers build anywhere. Select <b>Sapper Charlie</b>, press <b>F</b> (or the Sandbag Wall button), click to place, <b>R</b> to rotate. Also: <b>G</b> barbed wire, <b>T</b> MG nest. Right-click your own structure with engineers to <b>resume</b> or <b>repair</b> it; <b>X</b> takes it down for a refund.',
    objective: 'Build something with your engineers.',
    done: (g) => g.world.structures.some((s) => s.built && ['sandbags', 'wire', 'mgNest'].includes(s.def.id)),
    highlight: '.hud-selection',
  },
  {
    id: 'recruit',
    title: 'Reinforce',
    text: '<b>Click the Barracks</b> in your base (or press <b>B</b>) to recruit new squads and set where they gather (<b>Set rally point</b>). Money (<b>$</b>) is scarce; supplies (<b>▣</b>) trickle in and also come from kills. Each squad costs <b>upkeep</b> once per in-game day, and the <b>★ command cap</b> limits your force size; securing districts raises it.',
    objective: 'Open the Barracks and recruit a Rifle Squad.',
    done: (g) => g.world.structures.some((s) => s.def.id === 'barracks' && s.queue.length > 0) || g.world.squads.length > 3,
    highlight: '.hud-top .top-res',
  },
  {
    id: 'support',
    title: 'Call for support',
    text: 'Click the <b>Command Post</b> (the big building in your base) for support powers: an <b>Artillery Barrage</b> marked with white smoke (it hits your own people too) and a <b>Supply Drop</b> on green smoke that a squad has to go and collect.',
    objective: 'Select the Command Post.',
    done: (g) => g.selectedBuilding === 'commandPost',
  },
  {
    id: 'hive',
    title: 'Kill the hive',
    text: 'The <b>hive</b> in the south-east keeps making zombies and gets worse through <b>4 stages</b>; it never gets better on its own. <b>Bullets can’t hurt it.</b><br><br>Fight your way there, clear the area, then <b>right-click the hive with engineers</b> to plant a demo charge. Planting takes 3 seconds and <b>getting hit restarts it</b>, so cover them. Getting close also wakes up every zombie around it.',
    objective: 'Destroy the hive.',
    done: (g) => g.world.hives.every((h) => !h.alive),
    highlight: '.hud-objectives',
  },
  {
    id: 'secure',
    title: 'Secure the district',
    text: 'With the hive gone, infestation drains as you kill. At <b>0%</b>, have engineers build an <b>Outpost</b> (<b>O</b>) inside the district. A secured district pays money and supplies, but if the dead retake it, the outpost becomes a hive.',
    objective: 'Bring Roadside Motel to 0% and build an Outpost there.',
    done: (g) => [...g.world.districts.values()].some((d) => d.def.id !== 'base' && d.secured),
    highlight: '.hud-districts, .hud-objectives',
  },
  {
    id: 'done',
    title: 'Block secured',
    text: 'That’s the core loop: <b>move, clear, secure, reinforce</b>. In the full game the seven starter zones each add something new before the city opens up. Good work, Commander.',
  },
];
