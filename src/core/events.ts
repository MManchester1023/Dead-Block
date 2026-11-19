import type { Vec2 } from './math';
import type { DamageType } from '../sim/types';

/**
 * Every cross-system signal goes through here. The renderer, HUD and radio chatter
 * subscribe to these; the simulation never touches the DOM or Three.js.
 * New features (building collapse, airstrikes, Last Stand…) add event types here.
 */
export interface GameEvents {
  shot: { from: Vec2; to: Vec2; faction: string; heavy?: boolean; weapon?: string; shooter?: number };
  explosion: { pos: Vec2; radius: number; type: DamageType };
  /** STATUS #20: a medic team treated a squad. */
  squadHealed: { medicId: number; targetId: number; amount: number; rejoined: number };
  /** STATUS #50: a significant building was looted (`first`: the first one ever, for the tutorial pop-up). */
  landmarkLooted: { buildingId: number; kind: string; pos: Vec2; first: boolean; firstOfKind: boolean; supplies: number; money: number };
  /** STATUS #51: a squad climbed into / out of a vehicle (`bailOut`: the vehicle was destroyed). */
  squadBoarded: { vehicleId: number; squadId: number };
  squadUnloaded: { vehicleId: number; squadId: number; bailOut: boolean };
  /** Round 17 #207: a vehicle was sent somewhere (its drive-off sound). */
  vehicleOrdered: { id: number; pos: Vec2 };
  memberKilled: { squadId: number; squadName: string; pos: Vec2; facing: number; unitId: string; low?: boolean; member?: number };
  squadWiped: { squadId: number; squadName: string };
  zombieKilled: { id: number; defId: string; pos: Vec2; facing: number; districtId: string | null };
  hiveStage: { hiveId: number; stage: number; districtId: string };
  hiveDestroyed: { hiveId: number; districtId: string };
  hordePulse: { districtId: string; size: number; target: Vec2 };
  noiseAlert: { districtId: string };
  structureBuilt: { id: number; defId: string; pos: Vec2 };
  structureDestroyed: { id: number; defId: string; pos: Vec2 };
  structureDismantled: { id: number; defId: string; pos: Vec2; refund: { money: number; supplies: number } };
  districtSecured: { districtId: string; name: string };
  districtLost: { districtId: string; name: string };
  districtUnlocked: { districtId: string; name: string; unlocks: string[] };
  powerRestored: { id: number; first: boolean };
  powerLost: { id: number };
  memberRejoined: { squadId: number; squadName: string; pos: Vec2 };
  unitProduced: { id: number; defId: string; name: string };
  newDay: { day: number; upkeep: number; paid: boolean };
  levelUp: { squadId: number; squadName: string; level: string };
  bleed: { pos: Vec2; from?: Vec2; heavy: boolean };
  smoke: { pos: Vec2; color: number; duration: number };
  radio: { speaker: string; text: string; tone?: 'info' | 'warn' | 'good' | 'bad' };
  toxicCloud: { pos: Vec2; radius: number; duration: number };
  buildingSearched: { buildingId: number; pos: Vec2; found: string };
  /** Survivors found in a house (STATUS #10); the first time, the HUD explains what to do with them. */
  civiliansFound: { squadId: number; count: number; pos: Vec2; first: boolean };
  civiliansEvacuated: { count: number; money: number; supplies: number; pos: Vec2 };
  /** A roaming pack set off (STATUS #11). */
  roamers: { from: string; to: string; count: number; outpostId: number | null; pos: Vec2 };
  /** Dead got inside a secured district (STATUS #11). */
  districtContested: { districtId: string; name: string };
  nestBurst: { buildingId: number; pos: Vec2; count: number };
  victory: { reason: string };
  defeat: { reason: string };
}

type Handler<T> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<keyof GameEvents, Handler<any>[]>();

  on<K extends keyof GameEvents>(type: K, fn: Handler<GameEvents[K]>): () => void {
    const list = this.handlers.get(type) ?? [];
    list.push(fn);
    this.handlers.set(type, list);
    return () => {
      const l = this.handlers.get(type);
      if (l) l.splice(l.indexOf(fn), 1);
    };
  }

  emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
    const list = this.handlers.get(type);
    if (!list) return;
    for (const fn of list) fn(payload);
  }
}
