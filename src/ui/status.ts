import type { Squad } from '../sim/entities';
import type { World } from '../sim/World';

export type StatusTone = 'idle' | 'move' | 'fight' | 'work' | 'bad';

/** One short, loud line for what a squad is doing right now (v4.5: "make it obvious"). */
export function squadStatus(s: Squad, w: World): { text: string; tone: StatusTone } {
  const t = w.get(s.targetId);
  const firing = !!t && t.alive;
  if (s.stunned > 0) return { text: 'STAGGERED', tone: 'bad' };
  if (s.def.category === 'civilian') return s.moving ? { text: 'ON THE MOVE', tone: 'move' } : { text: 'WAITING', tone: 'idle' };
  if (s.climb) return { text: s.climb.up ? 'CLIMBING UP' : 'CLIMBING DOWN', tone: 'move' };
  if (s.garrisonedIn != null) return { text: 'IN TOWER', tone: 'fight' };
  if (w.time - s.healing < 0.5) return { text: s.def.category === 'vehicle' ? 'REPAIRING' : 'TREATING', tone: 'work' }; // round 19 #228
  const o = s.currentOrder?.type;
  switch (o) {
    case 'move':
      return { text: firing ? 'MOVING · FIRING' : 'MOVING', tone: 'move' };
    case 'attackMove':
      return firing ? { text: 'ENGAGING', tone: 'fight' } : { text: 'ADVANCING', tone: 'move' };
    case 'patrol':
      return firing ? { text: 'PATROL · ENGAGING', tone: 'fight' } : { text: 'PATROLLING', tone: 'move' };
    case 'cover':
      return { text: 'TAKING COVER', tone: 'move' };
    case 'attack':
      return { text: 'ATTACKING TARGET', tone: 'fight' };
    case 'build':
      return { text: s.moving ? 'TO BUILD SITE' : 'BUILDING', tone: 'work' };
    case 'repair':
      return { text: s.moving ? 'TO REPAIR' : 'REPAIRING', tone: 'work' };
    case 'deconstruct':
      return { text: s.moving ? 'TO DISMANTLE' : 'DISMANTLING', tone: 'work' };
    case 'charge':
      return { text: s.moving ? 'TO THE HIVE' : 'PLANTING CHARGE', tone: 'work' };
    case 'garrison':
      return { text: 'TO THE TOWER', tone: 'move' };
    case 'search':
      return { text: s.moving ? 'TO SEARCH' : 'SEARCHING', tone: 'work' };
    case 'upgrade':
      return { text: s.moving ? 'TO THE OUTPOST' : 'INSTALLING', tone: 'work' };
    case 'heal':
      return { text: s.moving ? 'TO PATIENT' : 'HEALING', tone: 'work' };
    case 'board':
      return { text: 'TO THE HUMVEE', tone: 'move' };
    case 'disband':
      return { text: 'STANDING DOWN', tone: 'move' };
  }
  const base = s.openCover ? (s.crouched ? 'CROUCHED' : 'OPEN COVER') : s.inCover ? 'IN COVER' : s.holding ? 'HOLDING' : '';
  if (firing) return { text: base ? `${base} · FIRING` : 'FIRING', tone: 'fight' };
  return base ? { text: base, tone: 'idle' } : { text: 'IDLE', tone: 'idle' };
}
