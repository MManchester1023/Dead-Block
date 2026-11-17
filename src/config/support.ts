/**
 * Command Post support powers (doc §6, §8; v4.4 "command structure is clickable with power-ups").
 * Every call-in is marked with its own smoke colour before it lands (doc §8 v4).
 * Locked entries show players what the Command Post grows into.
 */
export interface SupportDef {
  id: string;
  name: string;
  desc: string;
  cost: { money: number; supplies: number };
  cooldown: number; // seconds
  delay: number; // seconds from marking smoke to effect
  smoke: number; // marker colour
  smokeName: string;
  /** Feature that must be on, if any; otherwise available from the start for playtesting. */
  requires?: string;
  unlock: string;
}

export const SUPPORT: SupportDef[] = [
  {
    id: 'artillery',
    name: 'Artillery Barrage',
    desc: '8 shells over ~4 s across a 10 m radius. Danger close: it will hit your own people.',
    cost: { money: 150, supplies: 20 },
    cooldown: 150,
    delay: 4,
    smoke: 0xeeeeee,
    smokeName: 'white',
    // v4.12 (#73): a later unlock, with the Artillery tier (doc §21 Tier 2)
    requires: 'artillery',
    unlock: 'Artillery tier (later in the campaign)',
  },
  {
    id: 'supplyDrop',
    name: 'Supply Drop',
    desc: 'A cargo plane passes over the green smoke and drops a crate (+45 supplies). A squad has to reach it to collect.',
    cost: { money: 60, supplies: 0 },
    cooldown: 120,
    delay: 14, // v4.9 (#37): ~8 s of flyover, then ~6 s under the chute
    smoke: 0x5ad06a,
    smokeName: 'green',
    unlock: 'Command Post',
  },
  { id: 'gunRun', name: 'Gun Run (heavy attack plane)', desc: 'Strafes a line.', cost: { money: 300, supplies: 0 }, cooldown: 240, delay: 6, smoke: 0xd8402a, smokeName: 'red', requires: 'airSupport', unlock: 'Airfield' },
  { id: 'bombRun', name: 'Bombing Run (fast fighter)', desc: 'HE or incendiary.', cost: { money: 350, supplies: 0 }, cooldown: 240, delay: 6, smoke: 0xe08a2a, smokeName: 'orange', requires: 'airSupport', unlock: 'Airfield' },
  { id: 'ac130', name: 'AC-130 Orbit', desc: '90 s of 25/40/105 mm.', cost: { money: 900, supplies: 0 }, cooldown: 600, delay: 8, smoke: 0x9a5ad0, smokeName: 'purple', requires: 'airSupport', unlock: 'Airfield' },
];

export const SUPPORT_BY_ID: Record<string, SupportDef> = Object.fromEntries(SUPPORT.map((s) => [s.id, s]));
