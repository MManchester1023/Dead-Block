import type { Vec2 } from '../core/math';

/** `hostile` is reserved for the human enemy faction (doc §9a). Combat code is faction-vs-faction from day one. */
export type Faction = 'player' | 'zombie' | 'hostile';

export const HOSTILITY: Record<Faction, Faction[]> = {
  player: ['zombie', 'hostile'],
  zombie: ['player', 'hostile'],
  hostile: ['player', 'zombie'],
};

export const areHostile = (a: Faction, b: Faction): boolean => HOSTILITY[a].includes(b);

/** Hives can only be destroyed by `explosive` or `fire` (doc §9). */
export type DamageType = 'bullet' | 'explosive' | 'fire' | 'melee' | 'toxic' | 'crush';

/** Threat class drives target priority (doc §5). Higher = shot first once nothing is danger-close. */
export enum ThreatClass {
  Structure = 0,
  Normal = 1,
  Special = 2,
  Boss = 3,
}

export type OrderType = 'move' | 'attackMove' | 'hold' | 'cover' | 'build' | 'charge' | 'patrol' | 'attack' | 'deconstruct' | 'repair' | 'disband' | 'search' | 'garrison' | 'upgrade' | 'heal' | 'board';

export interface Order {
  type: OrderType;
  pos: Vec2;
  /** cover prop/structure id, structure def to build, hive id for charge */
  targetId?: number;
  buildDef?: string;
  /** Patrol (round 14 #174): the loop of points, and which one it's heading for. */
  route?: Vec2[];
  leg?: number;
  /** Face this way (radians) on arrival (round 14 #177: formations dragged with right-click). */
  face?: number;
}

/** Formation shapes for moving several squads together (round 14 #177). */
export type FormationShape = 'line' | 'column' | 'wedge' | 'box' | 'spread';
/** How a group move is laid out: the shape, which way it faces (radians; default: the way it's going), and the front's width (m). */
export interface Formation {
  shape: FormationShape;
  facing?: number;
  width?: number;
}

/** Anything that can be shot at. */
export interface Targetable {
  id: number;
  faction: Faction;
  pos: Vec2;
  alive: boolean;
  threat: ThreatClass;
  radius: number;
}
