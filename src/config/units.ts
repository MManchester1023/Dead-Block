import type { DamageType } from '../sim/types';
import { ThreatClass } from '../sim/types';

export interface WeaponDef {
  name: string;
  range: number; // metres
  damage: number;
  cooldown: number; // seconds between shots per member
  accuracy: number; // 0..1 hit chance at point blank, falls off with range
  type: DamageType;
  loudness: number; // noise per shot (doc §9 noise)
}

export type UnitCategory = 'infantry' | 'vehicle' | 'helicopter' | 'support';

export interface UnitDef {
  id: string;
  name: string;
  category: UnitCategory;
  members: number;
  memberHp: number;
  speed: number; // m/s
  weapon: WeaponDef;
  cost: { money: number; supplies: number };
  upkeep: number; // supplies per in-game day
  command: number; // command-cap weight
  buildTime: number;
  producedAt: string; // structure def id
  /** Feature id that must be enabled, plus the in-world unlock condition from doc §12. */
  requires?: string;
  unlock: string;
  canBuild?: string[];
  abilities?: string[];
  tags?: string[];
}

// v4.21 (#86): riflemen see/engage a little further (was 24 m; carbine was 18 m)
const rifle: WeaponDef = { name: 'Service rifle', range: 30, damage: 9, cooldown: 0.9, accuracy: 0.62, type: 'bullet', loudness: 2.2 };
const carbine: WeaponDef = { name: 'Carbine', range: 22, damage: 7, cooldown: 1.0, accuracy: 0.7, type: 'bullet', loudness: 1.8 };

/**
 * Full roster from doc §7. Only units whose `requires` feature is on (or which have none)
 * can be produced. The rest exist so UI, unlock flow and save data are already shaped for them.
 */
export const UNITS: Record<string, UnitDef> = {
  rifle: {
    id: 'rifle', name: 'Rifle Squad', category: 'infantry', members: 4, memberHp: 40, speed: 6.4,
    weapon: rifle, cost: { money: 60, supplies: 20 }, upkeep: 4, command: 2, buildTime: 12,
    producedAt: 'barracks', unlock: 'Starting unit', tags: ['canCover'],
  },
  engineer: {
    id: 'engineer', name: 'Engineer Team', category: 'infantry', members: 2, memberHp: 48, speed: 6,
    weapon: carbine, cost: { money: 50, supplies: 15 }, upkeep: 3, command: 2, buildTime: 10,
    producedAt: 'barracks', unlock: 'Starting unit', tags: ['canCover'],
    canBuild: ['outpost', 'sandbags', 'wire', 'mgNest', 'guardTower', 'medBay'],
    abilities: ['demoCharge'],
  },
  medic: { id: 'medic', name: 'Medic Team', category: 'infantry', members: 2, memberHp: 36, speed: 6.4, weapon: carbine, cost: { money: 70, supplies: 20 }, upkeep: 3, command: 2, buildTime: 12, producedAt: 'barracks', requires: 'powerStations', unlock: 'Suburbs power / Barracks Lv2' },
  recon: { id: 'recon', name: 'Recon Pair', category: 'infantry', members: 2, memberHp: 32, speed: 8.4, weapon: { ...carbine, loudness: 0.6 }, cost: { money: 60, supplies: 15 }, upkeep: 3, command: 1, buildTime: 10, producedAt: 'barracks', requires: 'fogOfWar', unlock: 'Suburbs power / Barracks Lv2' },
  mg: { id: 'mg', name: 'Machine Gun Team', category: 'infantry', members: 3, memberHp: 42, speed: 4.8, weapon: { name: 'M240-style MG', range: 20, damage: 6, cooldown: 0.18, accuracy: 0.55, type: 'bullet', loudness: 3 }, cost: { money: 110, supplies: 30 }, upkeep: 5, command: 3, buildTime: 16, producedAt: 'armory', requires: 'powerStations', unlock: 'Main Street power / Armory' },
  sniper: { id: 'sniper', name: 'Sniper Team', category: 'infantry', members: 2, memberHp: 34, speed: 6, weapon: { name: 'Marksman rifle', range: 36, damage: 45, cooldown: 2.4, accuracy: 0.92, type: 'bullet', loudness: 3.5 }, cost: { money: 110, supplies: 25 }, upkeep: 4, command: 2, buildTime: 16, producedAt: 'armory', requires: 'powerStations', unlock: 'Main Street power / Armory' },
  flame: { id: 'flame', name: 'Flame Team', category: 'infantry', members: 3, memberHp: 44, speed: 5.6, weapon: { name: 'Flamethrower', range: 9, damage: 14, cooldown: 0.3, accuracy: 0.95, type: 'fire', loudness: 1.5 }, cost: { money: 130, supplies: 35 }, upkeep: 5, command: 3, buildTime: 18, producedAt: 'armory', requires: 'powerStations', unlock: 'Harbor power / Armory Lv2' },
  mortar: { id: 'mortar', name: 'Mortar Team', category: 'infantry', members: 3, memberHp: 38, speed: 4.8, weapon: { name: '81mm mortar', range: 52, damage: 40, cooldown: 4, accuracy: 0.6, type: 'explosive', loudness: 6 }, cost: { money: 150, supplies: 40 }, upkeep: 6, command: 3, buildTime: 20, producedAt: 'armory', requires: 'artillery', unlock: 'Harbor power / Armory Lv2' },
  gunJeep: { id: 'gunJeep', name: 'Gun Jeep', category: 'vehicle', members: 1, memberHp: 220, speed: 14, weapon: { name: 'Mounted MG', range: 20, damage: 7, cooldown: 0.15, accuracy: 0.6, type: 'bullet', loudness: 4 }, cost: { money: 160, supplies: 40 }, upkeep: 6, command: 3, buildTime: 20, producedAt: 'armorStation', requires: 'vehicles', unlock: 'Industrial Park power' },
  supplyTruck: { id: 'supplyTruck', name: 'Supply Truck', category: 'vehicle', members: 1, memberHp: 260, speed: 11, weapon: { name: 'None', range: 0, damage: 0, cooldown: 99, accuracy: 0, type: 'bullet', loudness: 0 }, cost: { money: 120, supplies: 30 }, upkeep: 4, command: 2, buildTime: 18, producedAt: 'armorStation', requires: 'outpostResupply', unlock: 'Industrial Park power', tags: ['resupply'] },
  lav: { id: 'lav', name: 'LAV', category: 'vehicle', members: 1, memberHp: 480, speed: 10, weapon: { name: '25mm autocannon', range: 26, damage: 22, cooldown: 0.5, accuracy: 0.7, type: 'explosive', loudness: 5 }, cost: { money: 260, supplies: 60 }, upkeep: 8, command: 4, buildTime: 28, producedAt: 'armorStation', requires: 'vehicles', unlock: 'Stadium power / Armor Station Lv2' },
  tank: { id: 'tank', name: 'Battle Tank', category: 'vehicle', members: 1, memberHp: 900, speed: 7.6, weapon: { name: '120mm main gun', range: 32, damage: 120, cooldown: 3.5, accuracy: 0.85, type: 'explosive', loudness: 9 }, cost: { money: 420, supplies: 90 }, upkeep: 12, command: 6, buildTime: 40, producedAt: 'armorStation', requires: 'vehicles', unlock: 'Stadium power / Armor Station Lv2', tags: ['crushesCars', 'damagesBuildings'] },
  howitzer: { id: 'howitzer', name: 'SP Howitzer (candidate)', category: 'vehicle', members: 1, memberHp: 600, speed: 6.8, weapon: { name: '155mm howitzer', range: 120, damage: 150, cooldown: 7, accuracy: 0.5, type: 'explosive', loudness: 10 }, cost: { money: 480, supplies: 100 }, upkeep: 12, command: 6, buildTime: 45, producedAt: 'armorStation', requires: 'artillery', unlock: 'Stadium power (proposed)', abilities: ['strikePatterns'] },
  hawk: { id: 'hawk', name: 'Hawk Helicopter', category: 'helicopter', members: 1, memberHp: 500, speed: 20, weapon: { name: 'Door miniguns', range: 22, damage: 6, cooldown: 0.08, accuracy: 0.5, type: 'bullet', loudness: 7 }, cost: { money: 400, supplies: 80 }, upkeep: 10, command: 5, buildTime: 40, producedAt: 'airfield', requires: 'airfield', unlock: 'Airport power', abilities: ['transport8', 'rappel'] },
  sparrow: { id: 'sparrow', name: 'Sparrow light helo', category: 'helicopter', members: 1, memberHp: 300, speed: 26, weapon: { name: 'Miniguns', range: 20, damage: 6, cooldown: 0.07, accuracy: 0.5, type: 'bullet', loudness: 6 }, cost: { money: 300, supplies: 60 }, upkeep: 8, command: 4, buildTime: 32, producedAt: 'airfield', requires: 'airfield', unlock: 'Airport power', abilities: ['transport4'] },
};

export interface ZombieDef {
  id: string;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  attackCooldown: number;
  sight: number;
  hearing: number; // multiplier on noise radius
  threat: ThreatClass;
  /** Spawn class (doc §9, v4.13): normal = Walker/Runner, medium = every other non-boss type. */
  class: 'normal' | 'medium' | 'boss';
  radius: number;
  requires?: string;
  onDeath?: 'toxicCloud';
  /** Salvage per kill (v4.4). */
  bounty: { money: number; supplies: number };
}

export const ZOMBIES: Record<string, ZombieDef> = {
  walker: { id: 'walker', name: 'Walker', hp: 36, speed: 2.7, damage: 7, attackCooldown: 1.2, sight: 14, hearing: 1, threat: ThreatClass.Normal, class: 'normal', radius: 0.4, bounty: { money: 1, supplies: 1 } },
  runner: { id: 'runner', name: 'Runner', hp: 22, speed: 7.6, damage: 5, attackCooldown: 0.8, sight: 18, hearing: 1.4, threat: ThreatClass.Normal, class: 'normal', radius: 0.38, bounty: { money: 1, supplies: 1 } },
  bloater: { id: 'bloater', name: 'Bloater', hp: 120, speed: 1.8, damage: 10, attackCooldown: 1.6, sight: 12, hearing: 0.8, threat: ThreatClass.Special, class: 'medium', radius: 0.75, onDeath: 'toxicCloud', bounty: { money: 4, supplies: 3 } },
  screamer: { id: 'screamer', name: 'Screamer', hp: 40, speed: 3.2, damage: 3, attackCooldown: 1.5, sight: 24, hearing: 1.2, threat: ThreatClass.Special, class: 'medium', radius: 0.4, requires: 'specialZombies', bounty: { money: 3, supplies: 2 } },
  brute: { id: 'brute', name: 'Brute', hp: 300, speed: 2.8, damage: 25, attackCooldown: 1.8, sight: 16, hearing: 1, threat: ThreatClass.Special, class: 'medium', radius: 0.9, requires: 'specialZombies', bounty: { money: 10, supplies: 6 } },
};

export interface StructureDef {
  id: string;
  name: string;
  hp: number;
  cost: { money: number; supplies: number };
  buildTime: number;
  size: { w: number; h: number }; // nav cells (3 m each)
  blocksMovement: boolean;
  cover?: number; // damage reduction for infantry hugging it
  slow?: number; // movement multiplier for zombies passing through
  weapon?: WeaponDef;
  requiresSecured?: boolean;
  requires?: string;
  /** Tall walls are the one thing zombie pile-ups can't climb (doc §6, §20). */
  climbable?: boolean;
  lure?: number; // loudspeaker
  hotkey?: string;
  /** Field of fire in degrees (v4.13, #71): the weapon only engages inside this arc around its aim. */
  arc?: number;
  /** One squad can man it (guard tower, v4.13): range multiplier, cover, platform height (m). */
  garrison?: { rangeMult: number; cover: number; height: number };
  /** Campaign unlock key; buildable once `World.unlocked` has it (e.g. opened by a tutorial region). */
  unlock?: string;
  /**
   * A fixed map objective that starts offline and is *restored* rather than built (power station,
   * v4.17): engineers work on it only while no zombie is within `clearRadius` metres. Wrecked, it goes
   * offline again instead of being destroyed.
   */
  restore?: { clearRadius: number };
  /** Can only be built inside the main base. */
  baseOnly?: boolean;
  /** Needs power from a working power station to do anything. */
  needsPower?: boolean;
  /** Med Bay (v4.17): squads resting within `radius` m heal `perSec` of their max health per second, paying supplies. */
  heal?: { radius: number; perSec: number; suppliesPerHp: number; restAfterHitSec: number };
}

export const STRUCTURES: Record<string, StructureDef> = {
  commandPost: { id: 'commandPost', name: 'Command Post', hp: 2000, cost: { money: 0, supplies: 0 }, buildTime: 0, size: { w: 5, h: 4 }, blocksMovement: true },
  barracks: { id: 'barracks', name: 'Barracks', hp: 1500, cost: { money: 0, supplies: 0 }, buildTime: 0, size: { w: 5, h: 3 }, blocksMovement: true },
  supplyDepot: { id: 'supplyDepot', name: 'Supply Depot', hp: 1200, cost: { money: 0, supplies: 0 }, buildTime: 0, size: { w: 4, h: 3 }, blocksMovement: true },
  baseWall: { id: 'baseWall', name: 'Base Wall', hp: 15000, cost: { money: 0, supplies: 0 }, buildTime: 0, size: { w: 1, h: 1 }, blocksMovement: true, climbable: false },
  // v4.17: the power system (tutorial region 3). Restored, not built; unlocks the Med Bay.
  powerStation: { id: 'powerStation', name: 'Power Station', hp: 2500, cost: { money: 0, supplies: 0 }, buildTime: 25, size: { w: 6, h: 4 }, blocksMovement: true, restore: { clearRadius: 30 } },
  medBay: { id: 'medBay', name: 'Med Bay', hp: 900, cost: { money: 150, supplies: 40 }, buildTime: 20, size: { w: 4, h: 3 }, blocksMovement: true, hotkey: 'N', unlock: 'medBay', baseOnly: true, needsPower: true,
    heal: { radius: 10, perSec: 0.025, suppliesPerHp: 0.12, restAfterHitSec: 5 } },
  // v4.13: introduced by tutorial region 2 (#54, #74)
  guardTower: { id: 'guardTower', name: 'Guard Tower', hp: 900, cost: { money: 120, supplies: 40 }, buildTime: 18, size: { w: 2, h: 2 }, blocksMovement: true, hotkey: 'V', garrison: { rangeMult: 1.4, cover: 0.5, height: 5 }, unlock: 'guardTower' },
  outpost: { id: 'outpost', name: 'Outpost', hp: 600, cost: { money: 100, supplies: 30 }, buildTime: 30, size: { w: 3, h: 3 }, blocksMovement: true, requiresSecured: true, hotkey: 'O' },
  sandbags: { id: 'sandbags', name: 'Sandbag Wall', hp: 260, cost: { money: 15, supplies: 10 }, buildTime: 6, size: { w: 3, h: 1 }, blocksMovement: true, cover: 0.55, climbable: true, hotkey: 'Q' },
  wire: { id: 'wire', name: 'Barbed Wire', hp: 120, cost: { money: 10, supplies: 5 }, buildTime: 4, size: { w: 3, h: 1 }, blocksMovement: false, slow: 0.35, hotkey: 'W' },
  mgNest: { id: 'mgNest', name: 'MG Emplacement', hp: 380, cost: { money: 140, supplies: 45 }, buildTime: 12, size: { w: 2, h: 2 }, blocksMovement: true, cover: 0.5, hotkey: 'E', arc: 120, weapon: { name: 'Mounted HMG', range: 35, damage: 8, cooldown: 0.2, accuracy: 0.6, type: 'bullet', loudness: 3.2 } },
  tallWall: { id: 'tallWall', name: 'Tall Concrete Wall (40 ft)', hp: 4000, cost: { money: 400, supplies: 120 }, buildTime: 60, size: { w: 4, h: 1 }, blocksMovement: true, climbable: false, requires: 'tallWalls' },
  loudspeaker: { id: 'loudspeaker', name: 'Loudspeaker', hp: 80, cost: { money: 40, supplies: 10 }, buildTime: 8, size: { w: 1, h: 1 }, blocksMovement: false, lure: 6, requires: 'tallWalls' },
};

export const ABILITIES = {
  demoCharge: { name: 'Demo Charge', plantTime: 3, fuse: 5, damage: 520, radius: 7, type: 'explosive' as DamageType, cost: { money: 25, supplies: 10 }, loudness: 30 },
};
