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
 */

type Bank = 'rifle' | 'death' | 'groan' | 'scream';
const FILES: Record<Bank, string[]> = {
  rifle: ['rifle_1', 'rifle_2', 'rifle_3'],
  death: ['zombie_death'],
  groan: ['groan_1', 'groan_2', 'groan_3', 'groan_4', 'groan_5'],
  scream: ['scream_1', 'scream_2', 'scream_3', 'scream_4'],
};
/** Per bank: how many may play at once, and the minimum gap between starts (seconds). */
const LIMITS: Record<Bank, { voices: number; gap: number; volume: number }> = {
  rifle: { voices: 10, gap: 0.035, volume: 0.42 },
  death: { voices: 4, gap: 0.12, volume: 0.5 },
  groan: { voices: 3, gap: 0.6, volume: 0.55 },
  scream: { voices: 1, gap: 6, volume: 0.45 },
};
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
  private playing: Record<Bank, number> = { rifle: 0, death: 0, groan: 0, scream: 0 };
  private lastStart: Record<Bank, number> = { rifle: -9, death: -9, groan: -9, scream: -9 };
  private groanTimer = 2;
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
    ev.on('shot', (e) => this.play('rifle', e.from, e.heavy ? { rate: 0.82, gain: 1.35 } : { rate: 0.94 + Math.random() * 0.12 }));
    ev.on('zombieKilled', (e) => {
      if (Math.random() < 0.65) this.play('death', e.pos, { rate: 0.85 + Math.random() * 0.3 });
    });
    ev.on('hordePulse', () => this.play('scream', null, { rate: 0.95 + Math.random() * 0.1 }));
    ev.on('noiseAlert', () => this.play('scream', null, { rate: 1.05 }));
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
  }

  /** Ambient groans from zombies near where the camera is looking. Call every frame. */
  update(dt: number): void {
    if (!this.ctx || this.game.paused) return;
    this.groanTimer -= dt;
    if (this.groanTimer > 0) return;
    this.groanTimer = 1.2 + Math.random() * 2.8;
    const t = this.game.renderer.rig.target;
    const near = this.game.world.zombieHash.query({ x: t.x, y: t.z }, 45).filter((z) => z.alive);
    if (!near.length) return;
    const z = near[Math.floor(Math.random() * near.length)];
    this.play('groan', z.pos, { rate: 0.85 + Math.random() * 0.3 });
  }

  /** Play a clip from a bank at a world position (null = everywhere, e.g. a distant scream). */
  private play(bank: Bank, pos: Vec2 | null, opt: { rate?: number; gain?: number } = {}): void {
    const ctx = this.ctx;
    const bufs = this.buffers[bank];
    if (!ctx || !this.master || !bufs?.length || this.volume === 0) return;
    if (this.game.paused && bank !== 'scream') return;
    const L = LIMITS[bank];
    const now = ctx.currentTime;
    if (this.playing[bank] >= L.voices || now - this.lastStart[bank] < L.gap) return;

    let gain = L.volume * (opt.gain ?? 1);
    let pan = 0;
    if (pos) {
      const rig = this.game.renderer.rig;
      const d = Math.hypot(pos.x - rig.target.x, pos.y - rig.target.z);
      if (d > MAX_DIST) return;
      gain *= 1 / (1 + (d / HALF_DIST) ** 2);
      // zoomed far out (ops map), the battlefield is quieter
      gain *= rig.strategic ? 0.35 : 1;
      if (gain < 0.01) return;
      const sp = this.game.renderer.worldToScreen(pos);
      pan = Math.max(-0.9, Math.min(0.9, (sp.x / innerWidth) * 2 - 1));
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
    src.start();
  }
}
