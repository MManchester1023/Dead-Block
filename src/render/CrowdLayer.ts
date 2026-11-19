import type * as THREE from 'three';
import type { World } from '../sim/World';
import { Crowd, type Clip, type Flipbook } from './characters';

/** Which body and tint a zombie gets: varied by id, Bloaters swollen and sickly, Runners lean. */
export function zombieLook(id: number, defId: string): { key: string; sx: number; sy: number; tint: number } {
  const h = ((id * 2654435761) >>> 0) / 4294967296;
  const shade = 0.82 + h * 0.3;
  const grey = Math.round(Math.min(1, shade) * 255);
  const tint = (grey << 16) | (grey << 8) | grey;
  // v4.13 (#70): unmistakable at a glance: much wider, squat, sickly yellow-green
  if (defId === 'bloater') return { key: 'zombieM', sx: 2.15, sy: 1.04, tint: 0xc8f070 };
  if (defId === 'runner') return { key: 'zombieF', sx: 0.92, sy: 1.02, tint };
  return { key: h < 0.3 ? 'zombieF' : 'zombieM', sx: 1, sy: 0.96 + h * 0.1, tint };
}

/** The crowd a squad's soldiers are drawn from. */
// STATUS #20 / v4.62: medics have their own crowd (pistol clips, healing animation); v4.64: their own model.
const squadCrowd = (defId: string) => (defId === 'engineer' ? 'engineer' : defId === 'medic' ? 'medic' : defId === 'civilians' ? 'civilian' : 'soldier');
/**
 * v4.62: height above the ground while jumping off a tower of `height` m, `e` s into Mixamo's "Jumping Down".
 * The clip itself drops 0.6 m (it starts on a ledge); the rest of the drop is a gravity fall over its
 * airborne stretch (1.3–1.85 s), so the landing crouch at ~1.9 s meets the ground.
 */
const JUMP_CLIP_DROP = 0.6;
export function jumpLift(e: number, height: number): number {
  const extra = Math.max(0, height - JUMP_CLIP_DROP);
  if (e <= 1.3) return extra;
  if (e >= 1.85) return 0;
  const k = (e - 1.3) / 0.55;
  return extra * (1 - k * k);
}

/** v4.62: every other civilian is the female model. */
const memberCrowd = (defId: string, i: number | undefined, base: string) => (defId === 'civilians' && (i ?? 0) % 2 === 1 ? 'civilianF' : base);

/**
 * Animated soldiers, engineers, civilians, zombies and corpses, drawn as flipbook crowds
 * (characters.ts): every frame, each character picks a clip and a time in it.
 */
export class CrowdLayer {
  private crowds: Record<string, Crowd>;
  private prevPos = new Map<number, { x: number; y: number; v: number }>();
  private gaits = new Map<number, 0 | 1 | 2>();
  private corpses: { key: string; x: number; z: number; facing: number; t0: number; sx: number; sy: number; tint?: number; clip?: Clip }[] = [];
  /** v4.55: soldiers getting up from a crouch (key → when they started), and who was low last frame. */
  private standing = new Map<number, number>();
  private wasLow = new Set<number>();
  /** Animation time: sim seconds, so pausing freezes everyone mid-stride. */
  private clock = 0;
  private anim = new Map<number, { clip: Clip; t: number; rate: number; seen: number }>();
  /** When each soldier settled into cover (animation clock), to play "taking cover" once first. */
  private coverSince = new Map<number, number>();
  private frame = 0;

  constructor(scene: THREE.Scene, private world: World, cast: Record<string, Flipbook>) {
    this.crowds = {
      soldier: new Crowd(cast.soldier, 96),
      engineer: new Crowd(cast.engineer, 48),
      medic: new Crowd(cast.medic, 32), // v4.62
      civilian: new Crowd(cast.civilian, 64),
      civilianF: new Crowd(cast.civilianF, 64), // v4.62: every other civilian
      zombieM: new Crowd(cast.zombieM, 2000),
      zombieF: new Crowd(cast.zombieF, 2000),
    };
    for (const c of Object.values(this.crowds)) scene.add(c.group);
    this.crowds.zombieM.shadowLimit = this.crowds.zombieF.shadowLimit = 300;
  }

  /** STATUS #47: at most this many zombies cast shadows (beyond it, none do). */
  setZombieShadows(n: number): void {
    this.crowds.zombieM.shadowLimit = this.crowds.zombieF.shadowLimit = n;
  }

  /** A zombie died: it plays its death and lies there a while. */
  zombieDied(e: { id: number; defId: string; pos: { x: number; y: number }; facing: number }): void {
    const look = zombieLook(e.id, e.defId);
    this.corpses.push({ key: look.key, x: e.pos.x, z: e.pos.y, facing: e.facing, t0: this.clock, sx: look.sx, sy: look.sy, tint: look.tint });
    if (this.corpses.length > 600) this.corpses.shift();
  }

  /** A soldier (or civilian) died. */
  memberDied(e: { unitId: string; pos: { x: number; y: number }; facing: number; low?: boolean; member?: number }): void {
    // v4.55: shot while crouched or in cover: the crouched death
    this.corpses.push({ key: memberCrowd(e.unitId, e.member, squadCrowd(e.unitId)), x: e.pos.x, z: e.pos.y, facing: e.facing, t0: this.clock, sx: 1, sy: 1, clip: e.low ? 'deathCrouch' : undefined });
  }

  update(simDt: number): void {
    this.clock += simDt;
    const w = this.world;
    const C = this.crowds;
    for (const c of Object.values(C)) c.begin();
    const t = this.clock;
    // Round 7 #79: the renderer runs ~60 fps but the sim steps at 30 Hz, so on frames without a sim
    // step nothing has moved. Measuring speed then read 0 and flipped every walker to idle and back
    // ~30 times a second. Now speed is only measured when the sim has stepped, and smoothed.
    const speedOf = (id: number, x: number, y: number) => {
      const p = this.prevPos.get(id);
      if (!p) {
        this.prevPos.set(id, { x, y, v: 0 });
        return 0;
      }
      if (simDt > 0) {
        const raw = Math.hypot(x - p.x, y - p.y) / simDt;
        p.v += (raw - p.v) * Math.min(1, simDt * 10);
        p.x = x;
        p.y = y;
      }
      return p.v;
    };
    /** Walk/run state with hysteresis (start above `on`, stop below `off`), so shuffling never flickers (#78). */
    const gait = (key: number, v: number, on: number, off: number, runOn = Infinity, runOff = Infinity): 0 | 1 | 2 => {
      const a = this.gaits.get(key) ?? 0;
      let g: 0 | 1 | 2 = a;
      if (a === 2) g = v < runOff ? (v > off ? 1 : 0) : 2;
      else if (a === 1) g = v > runOn ? 2 : v < off ? 0 : 1;
      else g = v > runOn ? 2 : v > on ? 1 : 0;
      this.gaits.set(key, g);
      return g;
    };

    this.frame++;
    for (const s of w.squads) {
      if (!s.alive) continue;
      const squadKey = squadCrowd(s.def.id);
      const order = s.currentOrder?.type;
      const working = !s.moving && (order === 'upgrade' || order === 'build' || order === 'repair' || order === 'deconstruct' || order === 'charge' || order === 'search' || order === 'heal');
      const tgt = w.get(s.targetId);
      // round 6 #67: stay in the firing pose while engaged; dropping it between shots (fire every 0.9 s,
      // pose shown for 0.7 s) is what made the arms jump up and down once a second
      const engaged = !!tgt && tgt.alive;
      // up a guard tower: stand on the platform (v4.13)
      const tower = s.garrisonedIn != null ? w.structures.find((x) => x.id === s.garrisonedIn) : undefined;
      let lift = tower?.def.garrison ? tower.def.garrison.height + 0.15 : 0;
      // v4.55: climbing the ladder: rise (or sink) over the climb, with the climbing clips
      let climbing: Clip | null = null;
      let jumpAt = -1;
      let jumpHeight = 0;
      if (s.climb) {
        const ct = w.structures.find((x) => x.id === s.climb!.towerId);
        const g = ct?.def.garrison;
        if (g && s.climb.up) {
          const k = Math.max(0, Math.min(1, s.climb.t / g.climbSec));
          lift = (g.height + 0.15) * (1 - k);
          climbing = 'climbUp';
        } else if (g) {
          // v4.62 (owner): they jump down. Timed per soldier from the start of the jump (see jumpLift)
          jumpAt = g.jumpSec - s.climb.t;
          lift = 0;
          climbing = 'climbDown';
          jumpHeight = g.height + 0.15;
        }
      }
      // round 10 #107: what the squad is hiding behind, so each soldier can tell if they're up against it
      const prop = s.inCover > 0 && s.coverPropId != null ? w.map.props.find((p) => p.id === s.coverPropId) : undefined;
      const coverSt = s.inCover > 0 && s.coverPropId != null && !prop ? w.structures.find((x) => x.id === s.coverPropId) : undefined;
      /** Metres from a soldier to the cover's surface, and how far that can be while still leaning on it
       *  (half the cover's reach beyond its footprint: ~1.1 m for a car, 1.5 m for sandbags). */
      const offCover = (p: { x: number; y: number }): boolean => {
        if (prop) {
          const dx = Math.max(0, Math.abs(p.x - prop.pos.x) - prop.w / 2);
          const dy = Math.max(0, Math.abs(p.y - prop.pos.y) - prop.h / 2);
          return Math.hypot(dx, dy) > (4.5 - Math.max(prop.w, prop.h) / 2) / 2;
        }
        if (coverSt) return Math.hypot(p.x - coverSt.pos.x, p.y - coverSt.pos.y) - coverSt.radius > 1.5;
        return false;
      };
      s.members.forEach((m, i) => {
        if (!m.alive) return;
        const crowd = C[memberCrowd(s.def.id, i, squadKey)] ?? C[squadKey];
        const key = s.id * 8 + i + 1e7;
        const v = speedOf(key, m.pos.x, m.pos.y);
        // round 12 #137: resting soldiers no longer drift (they stand still or walk to their spot at ~2 m/s),
        // so the same walk threshold works at rest as on the move
        const walking = gait(key, v, 0.6, 0.3) > 0;
        let clip: Clip = 'idle';
        let rate = 1;
        const firing = engaged && w.time - m.lastShot < s.def.weapon.cooldown * 2.5;
        const inCover = s.inCover > 0 && !s.moving && !walking && !working && s.garrisonedIn == null;
        if (!inCover) this.coverSince.delete(key);
        if (climbing && crowd.has(climbing)) clip = climbing;
        else if (working && crowd.has('work')) clip = 'work';
        else if (walking) {
          // v4.24 (#95): moving while engaged = walking while firing; v4.55: crouched squads crouch-walk
          clip = s.crouched && crowd.has('crouchWalk') ? 'crouchWalk' : firing && crowd.has('walkShoot') ? 'walkShoot' : 'walk';
          // v4.62: the straight "Rifle Crouch Walk" covers ~0.6 m/s at normal speed (crouched squads move ~6x that)
          rate = clip === 'crouchWalk' ? Math.min(3.5, Math.max(0.7, v / 0.6)) : Math.min(3, Math.max(0.7, v / 2.2));
        } else if (s.openCover && crowd.has('crouch') && s.garrisonedIn == null) clip = firing && crowd.has('crouchShoot') ? 'crouchShoot' : 'crouch'; // round 11 #125 (v4.55: kneeling fire)
        else if (firing) clip = 'shoot'; // stand up and fire, cover or not
        else if (inCover && crowd.has('crouch') && offCover(m.pos)) clip = 'crouch'; // too far out to lean on it
        else if (inCover && crowd.has('cover')) {
          // v4.24: get into cover once, then hold the cover pose
          const since = this.coverSince.get(key) ?? (this.coverSince.set(key, this.clock), this.clock);
          const dIn = crowd.book.durations.coverIn ?? 0;
          clip = this.clock - since < dIn && crowd.has('coverIn') ? 'coverIn' : 'cover';
        }
        // v4.55: getting up from a crouch (or from behind cover) to stand still or fire: the stand-up clip first
        const low = clip === 'crouch' || clip === 'crouchShoot' || clip === 'cover' || clip === 'coverIn';
        if (low) this.standing.delete(key);
        else if (this.wasLow.has(key) && (clip === 'idle' || clip === 'shoot') && crowd.has('standUp')) this.standing.set(key, this.clock);
        const since = this.standing.get(key);
        if (since !== undefined && !low && (clip === 'idle' || clip === 'shoot')) {
          if (this.clock - since < (crowd.book.durations.standUp ?? 0)) clip = 'standUp';
          else this.standing.delete(key);
        } else if (since !== undefined) this.standing.delete(key);
        if (low) this.wasLow.add(key);
        else this.wasLow.delete(key);
        if (clip === 'climbDown' && jumpAt >= 0) {
          // one after another, 0.12 s apart; clip time and fall in step so they land when the clip does
          const e = Math.max(0, jumpAt - i * 0.12);
          crowd.add(clip, e, m.pos.x, m.pos.y, m.facing, 1, undefined, -jumpLift(e, jumpHeight));
        } else crowd.add(clip, this.animTime(key, clip, rate, simDt), m.pos.x, m.pos.y, m.facing, 1, undefined, -lift);
      });
    }

    for (const z of w.zombies) {
      if (!z.alive) continue;
      const look = zombieLook(z.id, z.def.id);
      const crowd = C[look.key];
      const v = speedOf(z.id, z.pos.x, z.pos.y);
      const g = gait(z.id, v, 0.45, 0.2, crowd.has('run') ? 4.5 : Infinity, 3.5);
      let clip: Clip = 'idle';
      let rate = 1;
      if (z.state === 'attack') clip = 'punch';
      else if (g === 2) {
        clip = 'run';
        rate = Math.min(1.8, Math.max(0.8, v / 6));
      } else if (g === 1) {
        clip = 'walk';
        rate = Math.min(3.2, Math.max(0.6, v / 1.8));
      }
      crowd.add(clip, this.animTime(z.id, clip, rate, simDt), z.pos.x, z.pos.y, z.facing, look.sx, look.tint, 0, look.sy);
    }
    if (this.prevPos.size > 8000) {
      this.prevPos.clear();
      this.gaits.clear();
    }
    // forget animation state of characters that are gone
    if (this.frame % 300 === 0) for (const [k, a] of this.anim) if (this.frame - a.seen > 60) this.anim.delete(k);

    // corpses: play the death once, lie there a while, then sink into the ground. Models whose death
    // clip doesn't end on the ground get tipped over backwards as it finishes (round 4 #34).
    this.corpses = this.corpses.filter((c) => t - c.t0 < 50);
    for (const c of this.corpses) {
      const age = t - c.t0;
      const crowd = C[c.key];
      let sink = age > 42 ? (age - 42) * 0.15 : 0;
      let tilt = 0;
      if (!crowd.book.deathFalls) {
        const start = (crowd.book.durations.death ?? 1) * 0.45;
        const k = Math.min(1, Math.max(0, (age - start) / 0.45));
        tilt = k * k * (Math.PI / 2) * 0.96; // accelerate into the fall
        sink -= k * 0.14; // keep the back on the asphalt, not half under it
      }
      crowd.add(c.clip && crowd.has(c.clip) ? c.clip : 'death', age, c.x, c.z, c.facing, c.sx, c.tint, sink, c.sy, tilt);
    }
    for (const c of Object.values(C)) c.end();
  }

  /**
   * Per-character animation clock (round 6 #67). It advances by dt × a smoothed rate, so a change of
   * speed changes the tempo instead of jumping to a different frame. (It used to be the global clock
   * × speed factor: with the clock in the thousands of seconds, any wobble in speed was a random jump.)
   */
  private animTime(key: number, clip: Clip, rate: number, dt: number): number {
    let a = this.anim.get(key);
    if (!a) {
      a = { clip, t: (((key * 2654435761) >>> 0) / 4294967296) * 2, rate, seen: this.frame };
      this.anim.set(key, a);
    }
    if (a.clip !== clip) {
      a.clip = clip;
      a.t = (((key * 40503) >>> 0) % 1000) / 2000; // small stagger so a squad doesn't move in lockstep
    }
    a.rate += (rate - a.rate) * Math.min(1, dt * 3);
    a.t += dt * a.rate;
    a.seen = this.frame;
    return a.t;
  }
}
