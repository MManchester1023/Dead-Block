import type { Vec2 } from './math';
import type { DamageType } from '../sim/types';

/**
 * Every cross-system signal goes through here. The renderer, HUD and radio chatter
 * subscribe to these; the simulation never touches the DOM or Three.js.
 * New features (building collapse, airstrikes, Last Stand…) add event types here.
 */
export interface GameEvents {
  shot: { from: Vec2; to: Vec2; faction: string; heavy?: boolean; weapon?: string };
  explosion: { pos: Vec2; radius: number; type: DamageType };
  memberKilled: { squadId: number; squadName: string; pos: Vec2; facing: number; unitId: string };
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
