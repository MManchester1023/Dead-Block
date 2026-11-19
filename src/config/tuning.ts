/**
 * Difficulty tuning without code (round 15 #181, v4.68): the knobs dev-balance.html shows, and how the game
 * applies changed values at startup.
 *
 * A tuning is a flat object of `path → value`, e.g. `{ "HORDE.count": 2.5, "tier.1.normalPool": [14, 24, 60, 120],
 * "region.motel.hiveStage": 2, "zombie.runner.speed": 9 }`. The game reads `public/balance.json` (the owner's
 * kept settings, uploaded through GitHub) and then the browser's own test edits (localStorage), each on top of
 * the defaults in balance.ts / units.ts / the map data. Only paths listed in `knobs()` are accepted.
 * The simulation tests and balance probes never load a tuning: they always run on the defaults.
 */
import { BALANCE, DIFFICULTY, HORDE } from './balance';
import { ZOMBIES } from './units';
import type { MapData } from '../sim/map';

export type KnobValue = number | number[];

export interface Knob {
  path: string;
  group: string;
  label: string;
  hint?: string;
  /** Array knobs: how many numbers, and what each one is (e.g. hive stages 1–4). */
  len?: number;
  parts?: string;
  /** Whole numbers only. */
  int?: boolean;
}

const STAGES = 'hive stage 1, 2, 3, 4';

/** Every knob, in the order the tool shows them. Region knobs come from the map in use. */
export function knobs(map: MapData): Knob[] {
  const k: Knob[] = [
    { path: 'HORDE.count', group: 'Whole horde', label: 'Zombie numbers (×)', hint: 'Multiplies how many dead there are everywhere: starting crowds, hive broods and spawns, packs, house nests, horde waves. Kill rewards are divided by it so the economy stays put.' },
    { path: 'HORDE.toughness', group: 'Whole horde', label: 'Zombie health (×)', hint: 'Multiplies every zombie’s health.' },
    { path: 'HORDE.damage', group: 'Whole horde', label: 'Zombie damage (×)', hint: 'Multiplies what each zombie hit does.' },
    { path: 'BALANCE.hive.hpByStage', group: 'Hives', label: 'Hive health', len: 4, parts: STAGES, int: true },
    { path: 'BALANCE.hive.stageDurationSec', group: 'Hives', label: 'Seconds to grow a stage', len: 3, parts: 'stage 1→2, 2→3, 3→4', int: true },
    { path: 'BALANCE.hive.minSpawnIntervalSec', group: 'Hives', label: 'Fastest spawn (seconds)', hint: 'A hive never spawns more often than this, whatever its stage.' },
    { path: 'BALANCE.hive.wanderRadius', group: 'Hives', label: 'How far idle dead wander from their hive (m)', int: true },
    { path: 'BALANCE.hive.reinforceBelow', group: 'Hives', label: 'Reinforce below this share of the brood', hint: 'A hive whose brood is below this share of its pools spawns faster…' },
    { path: 'BALANCE.hive.reinforceRate', group: 'Hives', label: '…at this multiple of its spawn interval' },
    { path: 'BALANCE.hive.alarmRadius', group: 'Hives', label: 'Alarm: a squad this close sets a hive off (m)', int: true },
    { path: 'BALANCE.hive.alarmCallRadius', group: 'Hives', label: 'Alarm: dead this close to the hive come (m)', int: true },
    { path: 'BALANCE.horde.basePulseSize', group: 'Horde waves', label: 'Wave size', int: true, hint: 'Zombies in a horde wave (before the tier’s wave size and the zombie numbers multiplier)…' },
    { path: 'BALANCE.horde.perStagePulseSize', group: 'Horde waves', label: '…plus this many per hive stage', int: true },
    { path: 'BALANCE.noise.pulseThreshold', group: 'Noise', label: 'Noise meter: wave at', int: true },
    { path: 'BALANCE.noise.pulseCooldownSec', group: 'Noise', label: 'Meter stays empty after a wave (seconds)', int: true },
    { path: 'BALANCE.noise.decayPerSec', group: 'Noise', label: 'Meter drains per second' },
    { path: 'BALANCE.noise.hearingRadiusPerLoudness', group: 'Noise', label: 'How far gunfire carries (m per loudness)', hint: 'A rifle is 2.2 loud: 27.3 here means it’s heard ~60 m away.' },
    { path: 'BALANCE.zombie.aggroTimeSec', group: 'Zombie behaviour', label: 'Seconds they hunt you after seeing you', int: true },
    { path: 'BALANCE.zombie.leashDistance', group: 'Zombie behaviour', label: '…then keep coming while within (m)', int: true },
    { path: 'BALANCE.search.nestChance', group: 'Houses', label: 'Share of houses with dead inside' },
    { path: 'BALANCE.search.nestSize', group: 'Houses', label: 'Dead inside a nest', len: 2, parts: 'fewest, most', int: true },
    { path: 'BALANCE.economy.startMoney', group: 'Economy', label: 'Starting money', int: true },
    { path: 'BALANCE.economy.startSupplies', group: 'Economy', label: 'Starting supplies', int: true },
    { path: 'BALANCE.economy.baseSuppliesPerMin', group: 'Economy', label: 'Supplies per minute (base)', int: true },
    { path: 'BALANCE.economy.commandCap', group: 'Economy', label: 'Command cap', int: true },
    { path: 'BALANCE.economy.hiveBounty', group: 'Economy', label: 'Money for a hive', int: true },
    { path: 'BALANCE.economy.districtClearBounty', group: 'Economy', label: 'Money for clearing a region', int: true },
  ];

  // zombie types
  for (const z of Object.values(ZOMBIES)) {
    const g = `Zombie: ${z.name}`;
    k.push(
      { path: `zombie.${z.id}.hp`, group: g, label: 'Health (before the health ×)', int: true },
      { path: `zombie.${z.id}.speed`, group: g, label: 'Speed (m/s; soldiers walk 6.4)' },
      { path: `zombie.${z.id}.damage`, group: g, label: 'Damage per hit (before the damage ×)' },
      { path: `zombie.${z.id}.attackCooldown`, group: g, label: 'Seconds between hits' },
      { path: `zombie.${z.id}.sight`, group: g, label: 'Sight (m)', int: true },
    );
  }

  // difficulty tiers: hive broods (the spawn pools), spawning, waves, roaming packs
  DIFFICULTY.forEach((t, i) => {
    const g = `Tier ${i}: ${t.name}`;
    k.push(
      { path: `tier.${i}.zombieHp`, group: g, label: 'Zombie health (×, on top of the horde’s)' },
      { path: `tier.${i}.density`, group: g, label: 'Starting crowd (×)' },
      { path: `tier.${i}.normalPool`, group: g, label: 'Hive pool: Walkers & Runners', len: 4, parts: STAGES, int: true, hint: 'Each hive’s brood is two pools: the most of each kind it keeps alive at once.' },
      { path: `tier.${i}.mediumPool`, group: g, label: 'Hive pool: Bloaters & other specials', len: 4, parts: STAGES, int: true },
      { path: `tier.${i}.spawnIntervalSec`, group: g, label: 'Seconds between hive spawns', len: 4, parts: STAGES },
      { path: `tier.${i}.spawnGroup`, group: g, label: 'Zombies per spawn', len: 4, parts: STAGES, int: true },
      { path: `tier.${i}.mediumChance`, group: g, label: 'Chance a spawn is a special', len: 4, parts: STAGES },
      { path: `tier.${i}.runnerShare`, group: g, label: 'Share of Walkers & Runners that are Runners', len: 4, parts: STAGES },
      { path: `tier.${i}.mediumStart`, group: g, label: 'Specials’ share of the starting crowd' },
      { path: `tier.${i}.mediumStartMin`, group: g, label: '…and at least this many', int: true },
      { path: `tier.${i}.firstPulseDelaySec`, group: g, label: 'First horde wave after (seconds)', int: true },
      { path: `tier.${i}.pulseIntervalSec`, group: g, label: 'Seconds between horde waves', len: 4, parts: STAGES, int: true },
      { path: `tier.${i}.pulseSize`, group: g, label: 'Horde wave size (×)' },
    );
    if (t.roam)
      k.push(
        { path: `tier.${i}.roam.everySec`, group: g, label: 'Roaming pack every (seconds)', len: 2, parts: 'soonest, latest', int: true },
        { path: `tier.${i}.roam.group`, group: g, label: 'Roaming pack size', len: 2, parts: 'smallest, biggest', int: true },
      );
  });

  // regions (the map's districts with hives)
  for (const d of map.districts) {
    if (!d.hiveSites?.length) continue;
    const g = `Region: ${d.name}`;
    const nh = d.hiveSites.length;
    k.push(
      { path: `region.${d.id}.difficulty`, group: g, label: `Difficulty tier (0–${DIFFICULTY.length - 1})`, int: true, hint: DIFFICULTY.map((t, i) => `${i} ${t.name}`).join(', ') },
      { path: `region.${d.id}.hiveStage`, group: g, label: nh > 1 ? 'Hive starting stage, per hive' : 'Hive starting stage (1–4)', len: nh > 1 ? nh : undefined, parts: nh > 1 ? Array.from({ length: nh }, (_, i) => `hive ${i + 1}`).join(', ') : undefined, int: true },
      { path: `region.${d.id}.initialInfestation`, group: g, label: 'Starting infestation (%)', int: true },
      { path: `region.${d.id}.density`, group: g, label: 'Ambient zombies per infestation point', hint: 'Starting zombies ≈ infestation × this × the tier’s starting crowd × zombie numbers.' },
    );
    if (d.mix?.runner !== undefined) k.push({ path: `region.${d.id}.mix.runner`, group: g, label: 'Runners’ share of the starting crowd (the rest are Walkers)' });
    (d.packs ?? []).forEach((p, i) =>
      k.push(
        { path: `region.${d.id}.packs.${i}.count`, group: g, label: `${p.kind[0].toUpperCase() + p.kind.slice(1)} packs`, int: true },
        { path: `region.${d.id}.packs.${i}.size`, group: g, label: `…of this many each`, int: true },
      ),
    );
  }
  return k;
}

/** The object and key a path points at (or null if it doesn't exist). */
function locate(path: string, map: MapData): { obj: Record<string, unknown>; key: string } | null {
  const bits = path.split('.');
  let obj: unknown;
  let rest: string[];
  const [root, a] = bits;
  if (root === 'HORDE') (obj = HORDE), (rest = bits.slice(1));
  else if (root === 'BALANCE') (obj = BALANCE), (rest = bits.slice(1));
  else if (root === 'tier') (obj = DIFFICULTY[Number(a)]), (rest = bits.slice(2));
  else if (root === 'zombie') (obj = ZOMBIES[a]), (rest = bits.slice(2));
  else if (root === 'region') {
    const d = map.districts.find((x) => x.id === a);
    obj = d;
    rest = bits.slice(2);
    // a region's hive stage may be missing (default 1)
    if (d && rest.join('.') === 'hiveStage' && d.hiveStage === undefined) (d as { hiveStage?: number }).hiveStage = 1;
  } else return null;
  for (let i = 0; i < rest.length - 1; i++) {
    if (obj == null || typeof obj !== 'object') return null;
    obj = (obj as Record<string, unknown>)[rest[i]];
  }
  if (obj == null || typeof obj !== 'object' || !rest.length) return null;
  const key = rest[rest.length - 1];
  if (!(key in (obj as object))) return null;
  return { obj: obj as Record<string, unknown>, key };
}

export function getKnob(path: string, map: MapData): KnobValue | undefined {
  const at = locate(path, map);
  if (!at) return undefined;
  const v = at.obj[at.key];
  return Array.isArray(v) ? [...(v as number[])] : (v as number);
}

/**
 * Apply a tuning on top of whatever is loaded now. Returns a line per value it couldn't use (unknown path,
 * not a number, wrong length), which are skipped.
 */
export function applyTuning(t: Record<string, unknown>, map: MapData): string[] {
  const bad: string[] = [];
  const allowed = new Map(knobs(map).map((k) => [k.path, k]));
  for (const [path, value] of Object.entries(t)) {
    const knob = allowed.get(path);
    const at = knob && locate(path, map);
    if (!knob || !at) {
      bad.push(`${path}: not a setting`);
      continue;
    }
    const cur = at.obj[at.key];
    const nums = (Array.isArray(value) ? value : [value]).map(Number);
    if (nums.some((n) => !Number.isFinite(n))) {
      bad.push(`${path}: not a number`);
      continue;
    }
    if (Array.isArray(cur)) {
      if (nums.length !== cur.length) {
        bad.push(`${path}: needs ${cur.length} numbers`);
        continue;
      }
      at.obj[at.key] = nums;
    } else if (knob.len && Array.isArray(value)) at.obj[at.key] = nums; // e.g. one hive stage per hive
    else at.obj[at.key] = nums[0];
  }
  return bad;
}

export const TUNING_STORAGE_KEY = 'dbc.tuning';
