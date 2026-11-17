import { dist, type Vec2 } from '../core/math';
import type { Targetable } from './types';

export interface TargetQuery {
  pos: Vec2;
  range: number;
  dangerClose: number;
  current: Targetable | null;
  candidates: Iterable<Targetable>;
  /** Filter: line of sight, damage-type immunity (e.g. bullets vs hives), etc. */
  canEngage?: (t: Targetable) => boolean;
}

/**
 * Threat-priority focus fire (doc §5, v4):
 *  1. Lock a target and keep shooting it until it dies or leaves range.
 *  2. Anything danger-close overrides the lock (nearest danger-close first).
 *  3. Otherwise pick by threat class (boss > special > normal > structure), nearest within class.
 */
export function pickTarget(q: TargetQuery): Targetable | null {
  const { pos, range, dangerClose } = q;
  const engage = q.canEngage ?? (() => true);
  const inRange = (t: Targetable) => t.alive && dist(pos, t.pos) - t.radius <= range && engage(t);

  let nearestClose: Targetable | null = null;
  let nearestCloseD = Infinity;
  let best: Targetable | null = null;
  let bestThreat = -1;
  let bestD = Infinity;

  for (const t of q.candidates) {
    if (!inRange(t)) continue;
    const d = dist(pos, t.pos) - t.radius;
    if (d <= dangerClose && (d < nearestCloseD - 1e-6 || (Math.abs(d - nearestCloseD) < 1e-6 && t.threat > (nearestClose?.threat ?? -1)))) {
      nearestClose = t;
      nearestCloseD = d;
    }
    if (t.threat > bestThreat || (t.threat === bestThreat && d < bestD)) {
      best = t;
      bestThreat = t.threat;
      bestD = d;
    }
  }

  const cur = q.current && inRange(q.current) ? q.current : null;
  if (cur) {
    const curD = dist(pos, cur.pos) - cur.radius;
    if (curD <= dangerClose) return cur; // already shooting the thing in our face
    if (nearestClose) return nearestClose; // something got too close — deal with it first
    return cur; // focus fire: finish what we started
  }
  return nearestClose ?? best;
}
