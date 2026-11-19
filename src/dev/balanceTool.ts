// Dev page (dev-balance.html, round 15 #181, v4.68): tune difficulty without code. Shows every knob from
// src/config/tuning.ts with its default; Save writes this browser's edits (the game applies them on its next
// start), Download writes balance.json (upload it to public/ to keep it for everyone).
import { getKnob, knobs, TUNING_STORAGE_KEY, type Knob, type KnobValue } from '../config/tuning';
import { currentMapData } from '../sim/map';
import { DIFFICULTY, HORDE } from '../config/balance';

const map = currentMapData();
const KNOBS = knobs(map);
/** The defaults in code (this page never applies a tuning, so the modules hold them). */
const defaults = new Map<string, KnobValue>(KNOBS.map((k) => [k.path, getKnob(k.path, map)!]));

const same = (a: KnobValue | undefined, b: KnobValue | undefined) => JSON.stringify(a) === JSON.stringify(b);
const read = (): Record<string, KnobValue> => {
  try {
    return JSON.parse(localStorage.getItem(TUNING_STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
};

let file: Record<string, KnobValue> = {};
/** What a new game starts from without this browser's edits: the defaults plus balance.json. */
const base = (p: string) => (p in file ? file[p] : defaults.get(p)!);
const vals = new Map<string, KnobValue>();
let dirty = false;

const statusEl = document.getElementById('status')!;
const groupsEl = document.getElementById('groups')!;

function status(extra = ''): void {
  const changed = KNOBS.filter((k) => !same(vals.get(k.path), defaults.get(k.path))).length;
  const f = Object.keys(file).length;
  statusEl.textContent = `${changed} setting${changed === 1 ? '' : 's'} differ from the defaults${f ? ` (balance.json sets ${f})` : ''}${dirty ? ' · unsaved changes' : ''}${extra ? ' · ' + extra : ''}`;
}

const fmt = (v: KnobValue) => (Array.isArray(v) ? v.join(', ') : String(v));

function row(k: Knob): string {
  const v = vals.get(k.path)!;
  const arr = Array.isArray(v) ? v : [v];
  const parts = k.parts?.split(', ') ?? [];
  const inputs = arr
    .map((x, i) => {
      const lab = arr.length > 1 ? `<span>${parts[i] ?? i + 1}<input type="number" step="${k.int ? 1 : 'any'}" data-p="${k.path}" data-i="${i}" value="${x}"></span>` : `<input type="number" step="${k.int ? 1 : 'any'}" data-p="${k.path}" data-i="0" value="${x}">`;
      return lab;
    })
    .join('');
  const changed = !same(v, defaults.get(k.path));
  return `<div class="row ${changed ? 'changed' : ''}" data-row="${k.path}">
    <label>${k.label}${k.hint ? `<span class="hint">${k.hint}</span>` : ''}</label>
    <div class="inputs">${inputs}</div>
    <div><span class="def">default ${fmt(defaults.get(k.path)!)}</span> <button class="reset" data-reset="${k.path}" title="Back to the default">↺</button></div>
  </div>`;
}

/** Rough starting zombie count for a region, from the current values (the game also rounds and adds packs). */
function regionEstimate(id: string): string {
  const num = (p: string) => Number(vals.get(p) ?? 0);
  const inf = num(`region.${id}.initialInfestation`);
  const dens = num(`region.${id}.density`);
  const tier = Math.max(0, Math.min(DIFFICULTY.length - 1, Math.round(num(`region.${id}.difficulty`))));
  const tierDens = Number(vals.get(`tier.${tier}.density`) ?? DIFFICULTY[tier].density);
  const count = Number(vals.get('HORDE.count') ?? HORDE.count);
  let packs = 0;
  for (let i = 0; vals.has(`region.${id}.packs.${i}.count`); i++) packs += num(`region.${id}.packs.${i}.count`) * num(`region.${id}.packs.${i}.size`);
  return `≈ ${Math.round(inf * dens * tierDens * count)} starting zombies${packs ? ` + ${Math.round(packs * count)} in packs` : ''}`;
}

const open = new Set<string>();
function render(): void {
  groupsEl.querySelectorAll('details[open]').forEach((d) => open.add((d as HTMLElement).dataset.g!));
  const groups = new Map<string, Knob[]>();
  for (const k of KNOBS) (groups.get(k.group) ?? groups.set(k.group, []).get(k.group)!).push(k);
  groupsEl.innerHTML = [...groups]
    .map(([g, ks]) => {
      const n = ks.filter((k) => !same(vals.get(k.path), defaults.get(k.path))).length;
      const region = ks[0].path.startsWith('region.') ? ks[0].path.split('.')[1] : null;
      return `<details data-g="${g}" ${open.has(g) ? 'open' : ''}><summary>${g}${region ? ` <small class="est">${regionEstimate(region)}</small>` : ''}${n ? `<small>${n} changed</small>` : ''}</summary>${ks.map(row).join('')}</details>`;
    })
    .join('');
  status();
}

function setFrom(t: Record<string, KnobValue>): void {
  for (const k of KNOBS) vals.set(k.path, k.path in t ? t[k.path] : base(k.path));
}

groupsEl.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement;
  const p = el.dataset.p;
  if (!p) return;
  const k = KNOBS.find((x) => x.path === p)!;
  let n = Number(el.value);
  if (!Number.isFinite(n)) return;
  if (k.int) n = Math.round(n);
  const v = vals.get(p)!;
  if (Array.isArray(v)) {
    const next = [...v];
    next[Number(el.dataset.i)] = n;
    vals.set(p, next);
  } else vals.set(p, n);
  dirty = true;
  render();
});

groupsEl.addEventListener('click', (e) => {
  const p = (e.target as HTMLElement).dataset.reset;
  if (!p) return;
  e.preventDefault();
  vals.set(p, defaults.get(p)!);
  dirty = true;
  render();
});

/** This browser's edits: whatever differs from what the game would start with anyway. */
function browserEdits(): Record<string, KnobValue> {
  const out: Record<string, KnobValue> = {};
  for (const k of KNOBS) if (!same(vals.get(k.path), base(k.path))) out[k.path] = vals.get(k.path)!;
  return out;
}

/** The whole tuning, measured from the code's defaults (what balance.json should hold). */
function fullTuning(): Record<string, KnobValue> {
  const out: Record<string, KnobValue> = {};
  for (const k of KNOBS) if (!same(vals.get(k.path), defaults.get(k.path))) out[k.path] = vals.get(k.path)!;
  return out;
}

document.querySelector('header')!.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).dataset.a;
  if (a === 'save') {
    const t = browserEdits();
    try {
      if (Object.keys(t).length) localStorage.setItem(TUNING_STORAGE_KEY, JSON.stringify(t));
      else localStorage.removeItem(TUNING_STORAGE_KEY);
      dirty = false;
      status('saved: reload the game tab (or press Open the game)');
    } catch {
      status('could not save (browser storage blocked)');
    }
  } else if (a === 'download') {
    const blob = new Blob([JSON.stringify(fullTuning(), null, 2) + '\n'], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'balance.json';
    link.click();
    URL.revokeObjectURL(link.href);
    status('downloaded: upload it to public/ to keep it');
  } else if (a === 'resetall') {
    if (!confirm('Put every setting back to the defaults in the code? (Save afterwards to use it.)')) return;
    for (const k of KNOBS) vals.set(k.path, defaults.get(k.path)!);
    dirty = true;
    render();
  } else if (a === 'play') {
    if (dirty && !confirm('You have unsaved changes. Open the game without them?')) return;
    window.open('/', '_blank');
  }
});

document.querySelector('input[type=file]')!.addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  try {
    const t = JSON.parse(await f.text()) as Record<string, KnobValue>;
    const known = Object.keys(t).filter((p) => defaults.has(p));
    for (const k of KNOBS) vals.set(k.path, k.path in t ? t[k.path] : defaults.get(k.path)!);
    dirty = true;
    render();
    status(`loaded ${known.length} setting${known.length === 1 ? '' : 's'}${known.length < Object.keys(t).length ? ` (${Object.keys(t).length - known.length} unknown skipped)` : ''}; Save to use them`);
  } catch {
    status('that file is not a balance.json');
  }
});

(async () => {
  try {
    const res = await fetch('/balance.json', { cache: 'no-store' });
    if (res.ok && (res.headers.get('content-type') ?? '').includes('json')) file = await res.json();
  } catch {
    /* none */
  }
  setFrom(read());
  render();
  document.title = 'Difficulty tuning';
  (window as unknown as { __ready: boolean }).__ready = true;
})();
