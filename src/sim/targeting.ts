import { dist, type Vec2 } from '../core/math';
import type { Targetable } from './types';

export interface TargetQuery {
  pos: Vec2;
  range: number;
  /** Kept for callers; round 11 #130 made every target "nearest first", so it no longer changes the pick. */
  dangerClose: number;
  current: Targetable | null;
  candidates: Iterable<Targetable>;
  /** Filter: line of sight, damage-type immunity (e.g. bullets vs hives), etc. */
  canEngage?: (t: Targetable) => boolean;
}

/**
 * Round 11 #130: the closest target you can engage always comes first (it used to be threat class
 * first, with a lock on the current target). Ties (within 0.5 m) keep the current target, then go to
 * the higher threat, so a squad doesn't flicker between two dead at the same distance.
 * A target the player clicks (forced attack, combat.ts) still overrides this.
 */
export function pickTarget(q: TargetQuery): Targetable | null {
  const { pos, range } = q;
  const engage = q.canEngage ?? (() => true);
  const TIE = 0.5;
  let best: Targetable | null = null;
  let bestD = Infinity;
  for (const t of q.candidates) {
    if (!t.alive) continue;
    const d = dist(pos, t.pos) - t.radius;
    if (d > range || d > bestD + TIE || !engage(t)) continue;
    if (best && Math.abs(d - bestD) <= TIE) {
      // a tie: stay on what we're shooting, else take the bigger threat
      if (best === q.current) continue;
      if (t !== q.current && t.threat <= best.threat) continue;
    }
    best = t;
    bestD = Math.min(bestD, d); // the nearest distance seen, so ties can't creep outward
  }
  return best;
}
