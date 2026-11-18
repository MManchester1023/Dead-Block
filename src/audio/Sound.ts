import type { Game } from '../Game';
import type { Vec2 } from '../core/math';

/**
 * Sound (v4.24, STATUS "Sound"). Web Audio, driven entirely by game events, so the simulation stays
 * silent and deterministic. Every sound is placed in the world: it gets quieter with distance from
 * where the camera is looking, and pans left/right with its position on screen.
 *
 * Clips (public/audio, cut from the owner's Pixabay downloads, see CREDITS.md):
 *   rifle_1–3     single shots (MG nest plays them lower and louder)
 *   zombie_death  a zombie going down
 *   groan_1–5     ambient groans from zombies near the camera
 *   scream_1–4    a horde wave starting / the noise meter filling
 *   carbine_1     engineers' (and later recon's) carbine (round 10 #114)
 *   pistol_1–2    the medics' pistols (v4.62, the owner's two pistol shots)
 *   explosion_1   demo charges, artillery (round 10 #109; the owner's satchel charge clip)
 *   bloater_death the Bloater bursting, from the owner's recording (v4.40; replaced round 10's layered pop + gore rip)
 *   human_death_1–3  a soldier or survivor going down (v4.38)
 *   ui_click      HUD buttons (v4.38)
 *   build_loop    engineers at work: three construction recordings layered into one loop (v4.38, round 10 #111)
 *   amb_horror    a horror drone under everything, very quiet (v4.38)
 *   amb_suburb    suburban ambience bed (v4.38)
 *   radio_1–8     military radio chatter, cut from one recording at its pauses (v4.38)
 *   hive_death    a wet mud explosion when a hive is destroyed (v4.39, round 10 #110)
 *   plane_flyby   a jet passing overhead, timed to peak as the supply plane's shadow crosses the drop (v4.39, #113)
 *   parachute     the crate's chute opening (v4.39, #113)
 *   crate_land    the supply crate hitting the ground (v4.41, #113)
 *   mg_loop       the MG emplacement firing: a seamless 1.3 s stretch of a 50-cal burst, looped while it shoots (v4.55)
 *   power_on      the power station starting up (v4.41, round 10 #112; from the owner's recording)
 */

type Bank = 'rifle' | 'carbine' | 'pistol' | 'death' | 'groan' | 'scream' | 'explosion' | 'bloater' | 'human' | 'click' | 'radio' | 'hive' | 'flyby' | 'chute' | 'power' | 'thud';
const FILES: Record<Bank, string[]> = {
  human: ['human_death_1', 'human_death_2', 'human_death_3'],
  click: ['ui_click'],
  hive: ['hive_death'],
  flyby: ['plane_flyby'],
  chute: ['parachute'],
  power: ['power_on'],
  thud: ['crate_land'],
  radio: ['radio_1', 'radio_2', 'radio_3', 'radio_4', 'radio_5', 'radio_6', 'radio_7', 'radio_8'],
  rifle: ['rifle_1', 'rifle_2', 'rifle_3'],
  carbine: ['carbine_1'],
  pistol: ['pistol_1', 'pistol_2'],
  explosion: ['explosion_1'],
  bloater: ['bloater_death'],
  death: ['zombie_death'],
  groan: ['groan_1', 'groan_2', 'groan_3', 'groan_4', 'groan_5'],
  scream: ['scream_1', 'scream_2', 'scream_3', 'scream_4'],
};
/** Per bank: how many may play at once, and the minimum gap between starts (seconds). */
const LIMITS: Record<Bank, { voices: number; gap: number; volume: number }> = {
  rifle: { voices: 10, gap: 0.035, volume: 0.42 },
  carbine: { voices: 8, gap: 0.035, volume: 0.36 },
  pistol: { voices: 8, gap: 0.035, volume: 0.36 },
  explosion: { voices: 3, gap: 0.08, volume: 0.8 },
  bloater: { voices: 3, gap: 0.1, volume: 0.7 },
  death: { voices: 4, gap: 0.12, volume: 0.5 },
  groan: { voices: 3, gap: 0.6, volume: 0.55 },
  scream: { voices: 1, gap: 6, volume: 0.45 },
  human: { voices: 3, gap: 0.15, volume: 0.6 },
  click: { voices: 2, gap: 0.03, volume: 0.3 },
  radio: { voices: 1, gap: 4, volume: 0.32 },
  hive: { voices: 2, gap: 0.2, volume: 0.9 },
  flyby: { voices: 2, gap: 1, volume: 0.45 },
  chute: { voices: 2, gap: 0.3, volume: 0.6 },
  power: { voices: 1, gap: 1, volume: 0.8 },
  thud: { voices: 2, gap: 0.2, volume: 0.7 },
};

/** Looping beds: ambience everywhere (volume), and the engineers' work loop (placed at each crew). */
const AMBIENCE: { file: string; volume: number }[] = [
  { file: 'amb_suburb', volume: 0.2 }, // round 13 #151: was 0.3
  { file: 'amb_horror', volume: 0.12 }, // quiet but there (round 13 #152: 0.05 was inaudible)
];
const BUILD_LOOP = 'build_loop';
const BUILD_VOLUME = 0.5;
/** MG emplacements (v4.55): their burst loops while they fire, fading out this long after the last shot. */
const MG_LOOP = 'mg_loop';
const MG_VOLUME = 0.7;
const MG_HOLD = 0.35;
/** Orders that mean "engineers hammering away" once they're standing at the job. */
/** Seconds into plane_flyby where the jet is loudest (directly overhead); crates fall for 6 s after that. */
const FLYBY_PEAK = 11;
const CRATE_FALL_SEC = 6;
const WORK_ORDERS = new Set(['build', 'repair', 'upgrade', 'deconstruct']);
/** Radio traffic from these speakers gets a burst of chatter (squads' own lines don't). */
const RADIO_SPEAKERS = new Set(['Command', 'Overwatch', 'Intel', 'Quartermaster', 'Engineers', 'Command Post']);
/** Distance (m) at which a sound is at half volume; well beyond this it fades out. */
const HALF_DIST = 28;
const MAX_DIST = 140;

const VOLUMES = [1, 0.6, 0.3, 0];

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

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers: Partial<Record<Bank, AudioBuffer[]>> = {};
  private playing = Object.fromEntries(Object.keys(FILES).map((b) => [b, 0])) as Record<Bank, number>;
  private lastStart = Object.fromEntries(Object.keys(FILES).map((b) => [b, -9])) as Record<Bank, number>;
  private groanTimer = 2;
  /** Seconds until the next bit of background radio chatter. */
  private chatterTimer = 30;
  /** Supply crates already given their flyby / parachute sounds. */
  private crateFlyby = new Set<number>();
  private crateChute = new Set<number>();
  private crateLand = new Set<number>();
  private loops: Record<string, AudioBuffer | undefined> = {};
  private ambience: GainNode[] = [];
  /** One looping work sound per crew at a job (squad id → its nodes). */
  private work = new Map<number, { src: AudioBufferSourceNode; g: GainNode; p: StereoPannerNode }>();
  /** Firing MG emplacements: their loop, where they are, and when they last fired (v4.55). */
  private mgs = new Map<string, { src: AudioBufferSourceNode; g: GainNode; p: StereoPannerNode; pos: Vec2; last: number }>();
  /** Master volume, one of VOLUMES (remembered per browser). */
  volume = 1;

  constructor(private game: Game) {
    const saved = Number(pref.get('volume'));
    if (VOLUMES.includes(saved) && pref.get('volume') !== null) this.volume = saved;
    // browsers only allow audio after a user gesture: start on the first click or key press
    const unlock = () => {
      this.start();
      removeEventListener('pointerdown', unlock);
      removeEventListener('keydown', unlock);
    };
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);

    const ev = game.world.events;
    ev.on('shot', (e) => {
      if (e.weapon === 'Carbine') this.play('carbine', e.from, { rate: 0.93 + Math.random() * 0.14 });
      else if (e.weapon === 'Pistol') this.play('pistol', e.from, { rate: 0.95 + Math.random() * 0.1, gain: 0.8 }); // STATUS #20 medics
      else if (e.weapon === 'Mounted HMG') this.mgFiring(e.from); // v4.55: a continuous 50-cal burst, not single shots
      else this.play('rifle', e.from, e.heavy ? { rate: 0.82, gain: 1.35 } : { rate: 0.94 + Math.random() * 0.12 });
    });
    ev.on('zombieKilled', (e) => {
      if (e.defId === 'bloater') return; // it bursts instead (the toxic explosion below)
      if (Math.random() < 0.65) this.play('death', e.pos, { rate: 0.85 + Math.random() * 0.3 });
    });
    ev.on('explosion', (e) => {
      if (e.type === 'toxic') this.play('bloater', e.pos, { rate: 0.9 + Math.random() * 0.2 });
      else this.play('explosion', e.pos, { rate: 0.9 + Math.random() * 0.15, gain: Math.min(1.3, 0.6 + e.radius / 8) });
    });
    ev.on('hiveDestroyed', (e) => {
      const h = game.world.hives.find((x) => x.id === e.hiveId);
      this.play('hive', h ? h.pos : null, { rate: 0.95 + Math.random() * 0.1 });
    });
    // placed at the station: louder the closer the camera is (owner's call)
    ev.on('powerRestored', (e) => {
      const st = game.world.structures.find((s) => s.id === e.id);
      if (st) this.play('power', st.pos);
    });
    ev.on('memberKilled', (e) => this.play('human', e.pos, { rate: 0.92 + Math.random() * 0.16 }));
    ev.on('radio', (e) => {
      if (RADIO_SPEAKERS.has(e.speaker)) this.play('radio', null);
    });
    ev.on('hordePulse', () => this.play('scream', null, { rate: 0.95 + Math.random() * 0.1 }));
    ev.on('noiseAlert', () => this.play('scream', null, { rate: 1.05 }));
  }

  /** A HUD button press (plays while paused too). */
  uiClick(): void {
    this.play('click', null, { rate: 0.97 + Math.random() * 0.06 });
  }

  /** Cycle 100% → 60% → 30% → off (top-bar button). */
  cycleVolume(): void {
    const i = VOLUMES.indexOf(this.volume);
    this.volume = VOLUMES[(i + 1) % VOLUMES.length];
    pref.set('volume', String(this.volume));
    if (this.master) this.master.gain.value = this.volume;
  }

  private start(): void {
    if (this.ctx) return;
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    for (const [bank, names] of Object.entries(FILES) as [Bank, string[]][]) {
      void Promise.all(
        names.map(async (n) => {
          const res = await fetch(`audio/${n}.mp3`);
          return this.ctx!.decodeAudioData(await res.arrayBuffer());
        }),
      )
        .then((b) => (this.buffers[bank] = b))
        .catch(() => {
          /* a missing clip just stays silent */
        });
    }
    const load = async (n: string) => this.ctx!.decodeAudioData(await (await fetch(`audio/${n}.mp3`)).arrayBuffer());
    for (const n of [BUILD_LOOP, MG_LOOP])
      load(n)
        .then((b) => (this.loops[n] = b))
        .catch(() => {});
    // ambience: start each bed as soon as it's loaded, looping for good (a missing file stays silent)
    for (const a of AMBIENCE)
      load(a.file)
        .then((b) => {
          const src = this.ctx!.createBufferSource();
          src.buffer = b;
          src.loop = true;
          const g = this.ctx!.createGain();
          g.gain.value = 0;
          g.gain.linearRampToValueAtTime(a.volume, this.ctx!.currentTime + 4); // fade in
          src.connect(g).connect(this.master!);
          src.start(0, Math.random() * b.duration);
          this.ambience.push(g);
        })
        .catch(() => {});
  }

  /** Where a sound at `pos` sits for the listener: volume factor and stereo pan (0 gain = out of earshot). */
  private place(pos: Vec2): { gain: number; pan: number } {
    const rig = this.game.renderer.rig;
    const d = Math.hypot(pos.x - rig.target.x, pos.y - rig.target.z);
    if (d > MAX_DIST) return { gain: 0, pan: 0 };
    let gain = 1 / (1 + (d / HALF_DIST) ** 2);
    gain *= rig.strategic ? 0.35 : 1; // zoomed far out (ops map), the battlefield is quieter
    const sp = this.game.renderer.worldToScreen(pos);
    return { gain, pan: Math.max(-0.9, Math.min(0.9, (sp.x / innerWidth) * 2 - 1)) };
  }

  /** An MG emplacement fired (a shot from it): start or keep its burst loop going. */
  private mgFiring(pos: Vec2): void {
    const ctx = this.ctx;
    const buf = this.loops[MG_LOOP];
    if (!ctx || !this.master || !buf || this.volume === 0) return;
    const key = `${Math.round(pos.x)},${Math.round(pos.y)}`;
    let m = this.mgs.get(key);
    if (!m) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 0;
      const p = ctx.createStereoPanner();
      src.connect(g).connect(p).connect(this.master);
      src.start(0, Math.random() * buf.duration);
      m = { src, g, p, pos: { ...pos }, last: 0 };
      this.mgs.set(key, m);
    }
    m.last = ctx.currentTime;
  }

  private updateMgs(): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    for (const [key, m] of this.mgs) {
      const at = this.place(m.pos);
      const on = !this.game.paused && now - m.last < MG_HOLD;
      m.g.gain.setTargetAtTime(on ? MG_VOLUME * at.gain : 0, now, on ? 0.02 : 0.08);
      m.p.pan.setTargetAtTime(at.pan, now, 0.1);
      if (now - m.last > 3) {
        m.src.stop(now + 0.3);
        this.mgs.delete(key);
      }
    }
  }

  /** Engineers at a job get a looping construction sound, placed at them; it fades out when they stop. */
  private updateWork(): void {
    const ctx = this.ctx!;
    const buf = this.loops[BUILD_LOOP];
    if (!buf) return;
    const now = ctx.currentTime;
    const busy = new Set<number>();
    for (const s of this.game.world.squads) {
      const o = s.currentOrder?.type;
      if (!s.alive || s.moving || !o || !WORK_ORDERS.has(o)) continue;
      busy.add(s.id);
      let w = this.work.get(s.id);
      if (!w) {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const g = ctx.createGain();
        g.gain.value = 0;
        const p = ctx.createStereoPanner();
        src.connect(g).connect(p).connect(this.master!);
        src.start(0, Math.random() * buf.duration); // two crews don't hammer in unison
        w = { src, g, p };
        this.work.set(s.id, w);
      }
      const at = this.place(s.pos);
      const target = this.game.paused ? 0 : BUILD_VOLUME * at.gain;
      w.g.gain.setTargetAtTime(target, now, 0.15);
      w.p.pan.setTargetAtTime(at.pan, now, 0.1);
    }
    for (const [id, w] of this.work)
      if (!busy.has(id)) {
        w.g.gain.setTargetAtTime(0, now, 0.1);
        w.src.stop(now + 0.6);
        this.work.delete(id);
      }
  }

  /** Ambient groans from zombies near where the camera is looking. Call every frame. */
  update(dt: number): void {
    if (!this.ctx) return;
    this.updateWork();
    this.updateMgs();
    if (this.game.paused) return;
    this.updateCrates();
    // now and then, quieter chatter from somewhere on the net
    this.chatterTimer -= dt;
    if (this.chatterTimer <= 0) {
      this.chatterTimer = 45 + Math.random() * 45;
      this.play('radio', null, { gain: 0.55 });
    }
    this.groanTimer -= dt;
    if (this.groanTimer > 0) return;
    this.groanTimer = 1.2 + Math.random() * 2.8;
    const t = this.game.renderer.rig.target;
    const near = this.game.world.zombieHash.query({ x: t.x, y: t.z }, 45).filter((z) => z.alive);
    if (!near.length) return;
    const z = near[Math.floor(Math.random() * near.length)];
    this.play('groan', z.pos, { rate: 0.85 + Math.random() * 0.3 });
  }

  /** Supply drops: the plane passes over (peaking above the drop), then the chute opens. */
  private updateCrates(): void {
    const w = this.game.world;
    for (const c of w.crates) {
      const toOverhead = c.landsAt - CRATE_FALL_SEC - w.time;
      if (!this.crateFlyby.has(c.id) && !c.landed && toOverhead <= FLYBY_PEAK && toOverhead > -FLYBY_PEAK) {
        this.crateFlyby.add(c.id);
        this.play('flyby', null, { offset: Math.max(0, FLYBY_PEAK - toOverhead) });
      }
      if (!this.crateLand.has(c.id) && c.landed) {
        this.crateLand.add(c.id);
        this.play('thud', c.pos, { rate: 0.95 + Math.random() * 0.1 });
      }
      if (!this.crateChute.has(c.id) && !c.landed && toOverhead <= 0) {
        this.crateChute.add(c.id);
        this.play('chute', c.pos, { rate: 0.95 + Math.random() * 0.1 });
      }
    }
  }

  /** Play a clip from a bank at a world position (null = everywhere, e.g. a distant scream). */
  private play(bank: Bank, pos: Vec2 | null, opt: { rate?: number; gain?: number; offset?: number } = {}): void {
    const ctx = this.ctx;
    const bufs = this.buffers[bank];
    if (!ctx || !this.master || !bufs?.length || this.volume === 0) return;
    if (this.game.paused && bank !== 'scream' && bank !== 'click') return;
    const L = LIMITS[bank];
    const now = ctx.currentTime;
    if (this.playing[bank] >= L.voices || now - this.lastStart[bank] < L.gap) return;

    let gain = L.volume * (opt.gain ?? 1);
    let pan = 0;
    if (pos) {
      const at = this.place(pos);
      gain *= at.gain;
      if (gain < 0.01) return;
      pan = at.pan;
    }
    const src = ctx.createBufferSource();
    src.buffer = bufs[Math.floor(Math.random() * bufs.length)];
    src.playbackRate.value = (opt.rate ?? 1) * this.game.speed ** 0.15; // a touch quicker at 2×/4×
    const g = ctx.createGain();
    g.gain.value = gain;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    src.connect(g).connect(p).connect(this.master);
    this.playing[bank]++;
    this.lastStart[bank] = now;
    src.onended = () => this.playing[bank]--;
    src.start(0, opt.offset ?? 0);
  }
}
