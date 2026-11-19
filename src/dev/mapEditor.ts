/**
 * Map editor (dev-map.html, v4.45, STATUS "map data format"). A top-down view of src/data/maps/starter.json
 * on the nav grid (1 cell = 3 m). Select, drag, resize, add and delete buildings, cars, pumps, lots,
 * roads, rail, canopies, districts, hive sites and power stations; edit their properties on the right.
 * "Save" downloads the JSON (upload it to src/data/maps/ on GitHub); "Play" opens the game on the edit.
 */
import starter from '../data/maps/starter.json';
import { buildMap, Tile, type BuildingKind, type GroundTile, type MapData, type Landmark } from '../sim/map';
import type { Rect, Vec2 } from '../core/math';

type Sel =
  | { t: 'building' | 'prop' | 'ground' | 'canopy' | 'district'; i: number }
  | { t: 'hive'; i: number; j: number }
  | { t: 'power'; i: number; j: number }
  | { t: 'base' | 'gate' | 'rally' }
  | null;
type Tool = 'select' | 'building' | 'car' | 'pump' | 'lot' | 'road' | 'rail' | 'canopy' | 'district' | 'hive' | 'power';

const STORE = 'dbc.mapEdit';
const PLAY = 'dbc.mapOverride';
const KINDS: BuildingKind[] = ['houses', 'apartment', 'motel', 'shop', 'warehouse', 'boxcar'];
const TILES: GroundTile[] = ['dirt', 'road', 'sidewalk', 'baseConcrete', 'parking', 'building', 'grass', 'rail'];
const TILE_COL: Record<number, string> = {
  [Tile.Dirt]: '#6b5a44', [Tile.Road]: '#3a3a3c', [Tile.Sidewalk]: '#8a8680', [Tile.BaseConcrete]: '#7d7f7a',
  [Tile.Parking]: '#4a4a4c', [Tile.Building]: '#2a2622', [Tile.Grass]: '#5d6f3a', [Tile.Rail]: '#5a4a3e',
};
const KIND_COL: Record<BuildingKind, string> = { houses: '#c98a5a', apartment: '#8e5040', motel: '#a07850', shop: '#5f7ea0', warehouse: '#7a7f86', boxcar: '#8a4a32' };
const CAR_COLORS = ['#8b3a2f', '#3f5a6b', '#b0a890', '#2f2f2f', '#5b6b3a', '#9a8a5a', '#6b4a6b'];

// ---------------------------------------------------------------- state
const pref = (k: string, v?: string): string | null => {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
  return null;
};
let data: MapData = JSON.parse(pref(STORE) ?? JSON.stringify(starter));
let sel: Sel = null;
let tool: Tool = 'select';
const undo: string[] = [];
let scale = 5; // px per cell
let ox = 10;
let oy = 10;

// ---------------------------------------------------------------- DOM
document.body.innerHTML = `
<style>
  html,body{margin:0;height:100%;overflow:hidden;background:#1d1f22;color:#ddd;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace}
  #bar{position:absolute;left:0;right:300px;top:0;height:34px;display:flex;gap:4px;align-items:center;padding:0 6px;background:#26292d;border-bottom:1px solid #000;overflow-x:auto}
  #bar button{background:#3a3e44;color:#ddd;border:1px solid #555;padding:3px 7px;cursor:pointer;white-space:nowrap;font:inherit}
  #bar button.on{background:#5a7a3a;border-color:#8c6}
  #bar .sep{width:8px}
  canvas{position:absolute;left:0;top:35px;cursor:crosshair}
  #side{position:absolute;right:0;top:0;bottom:0;width:300px;background:#26292d;border-left:1px solid #000;overflow-y:auto;padding:8px;box-sizing:border-box}
  #side h3{margin:4px 0 6px;font-size:13px;color:#c8e0a0}
  #side label{display:block;margin:6px 0 2px;color:#aaa}
  #side input,#side select,#side textarea{width:100%;box-sizing:border-box;background:#1d1f22;color:#ddd;border:1px solid #555;font:inherit;padding:2px 4px}
  #side textarea{height:220px}
  #side button{margin-top:6px;background:#3a3e44;color:#ddd;border:1px solid #555;padding:3px 7px;cursor:pointer;font:inherit}
  .warn{color:#e0b24a}.bad{color:#e0574a}.good{color:#8fcf6a}
  #status{position:absolute;left:6px;bottom:6px;background:#000a;padding:3px 6px;pointer-events:none}
</style>
<div id="bar"></div><canvas id="c"></canvas><div id="side"></div><div id="status"></div>`;
const bar = document.getElementById('bar')!;
const side = document.getElementById('side')!;
const status = document.getElementById('status')!;
const cv = document.getElementById('c') as HTMLCanvasElement;
const g = cv.getContext('2d')!;

const TOOLS: [Tool, string][] = [
  ['select', 'Select / move'], ['building', '+ Building'], ['car', '+ Car'], ['pump', '+ Pump'], ['lot', '+ Lot'], ['road', '+ Road'],
  ['rail', '+ Rail'], ['canopy', '+ Canopy'], ['district', '+ District'], ['hive', '+ Hive site'], ['power', '+ Power station'],
];
function drawBar(): void {
  bar.innerHTML =
    TOOLS.map(([t, n]) => `<button data-tool="${t}" class="${tool === t ? 'on' : ''}">${n}</button>`).join('') +
    `<span class="sep"></span><button data-act="undo" title="Ctrl+Z">Undo</button><button data-act="save" title="Download the JSON">Save</button><button data-act="copy">Copy JSON</button><button data-act="play" title="Open the game on this map">Play</button><button data-act="revert" title="Back to the file in the repo">Revert</button>`;
}
bar.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b) return;
  if (b.dataset.tool) {
    tool = b.dataset.tool as Tool;
    drawBar();
    return;
  }
  const a = b.dataset.act;
  if (a === 'undo') doUndo();
  if (a === 'save') download();
  if (a === 'copy') void navigator.clipboard.writeText(format(data)).then(() => flash('JSON copied'));
  if (a === 'play') {
    pref(PLAY, JSON.stringify(data));
    window.open('index.html?map=edited', '_blank');
  }
  if (a === 'revert' && confirm('Throw away your edits and go back to the map file in the repo?')) {
    data = JSON.parse(JSON.stringify(starter));
    sel = null;
    changed();
  }
});

// ---------------------------------------------------------------- helpers
const snap = (v: number) => Math.round(v);
const toCell = (px: number, py: number): Vec2 => ({ x: (px - ox) / scale, y: (py - oy) / scale });
const inR = (p: Vec2, r: Rect, pad = 0) => p.x >= r.x - pad && p.y >= r.y - pad && p.x < r.x + r.w + pad && p.y < r.y + r.h + pad;
const groundRect = (gr: MapData['ground'][number]): Rect => ('paint' in gr ? gr.rect : 'road' in gr ? gr.road : gr.rail);
const propRect = (p: MapData['props'][number]): Rect => ('pump' in p ? { ...p.pump, w: 2, h: 1 } : { ...p.car, w: p.horizontal ? 2 : 1, h: p.horizontal ? 1 : 2 });
function selRect(s: Sel): Rect | null {
  if (!s) return null;
  if (s.t === 'building') return data.buildings[s.i].rect;
  if (s.t === 'prop') return propRect(data.props[s.i]);
  if (s.t === 'ground') return groundRect(data.ground[s.i]);
  if (s.t === 'canopy') return data.canopies[s.i];
  if (s.t === 'district') return data.districts[s.i].rect;
  if (s.t === 'base') return data.base.rect;
  if (s.t === 'gate') return data.base.gate;
  return null;
}
function selPoint(s: Sel): Vec2 | null {
  if (!s) return null;
  if (s.t === 'hive') return data.districts[s.i].hiveSites[s.j];
  if (s.t === 'power') return data.districts[s.i].powerStations![s.j];
  if (s.t === 'rally') return data.base.rally;
  return null;
}
function pushUndo(): void {
  undo.push(JSON.stringify(data));
  if (undo.length > 100) undo.shift();
}
function doUndo(): void {
  const s = undo.pop();
  if (!s) return;
  data = JSON.parse(s);
  sel = null;
  changed(false);
}
function changed(save = true): void {
  if (save) pref(STORE, JSON.stringify(data));
  cache = null;
  draw();
  drawSide();
}
function flash(m: string): void {
  status.textContent = m;
  setTimeout(() => (status.textContent = ''), 1800);
}
function districtAt(p: Vec2): number {
  for (let i = data.districts.length - 1; i >= 0; i--) if (data.districts[i].id !== 'base' && inR(p, data.districts[i].rect)) return i;
  return -1;
}

/** Compact JSON with a space after each comma and colon (the repo file's style). */
function compact(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(compact).join(', ')}]`;
  if (v && typeof v === 'object') return `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${compact(x)}`).join(', ')}}`;
  return JSON.stringify(v);
}
/** Same layout as the repo file: one feature per line, so diffs stay readable. */
function format(d: MapData): string {
  const out = ['{'];
  const keys = Object.keys(d) as (keyof MapData)[];
  keys.forEach((k, i) => {
    const v = d[k] as unknown;
    const comma = i < keys.length - 1 ? ',' : '';
    if (Array.isArray(v) && v.length && typeof v[0] === 'object') {
      out.push(` "${k}": [`);
      v.forEach((e, j) => out.push('  ' + compact(e) + (j < v.length - 1 ? ',' : '')));
      out.push(' ]' + comma);
    } else out.push(` "${k}": ` + compact(v) + comma);
  });
  out.push('}');
  return out.join('\n') + '\n';
}
function download(): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([format(data)], { type: 'application/json' }));
  a.download = 'starter.json';
  a.click();
  flash('Saved starter.json: upload it to src/data/maps/ on GitHub');
}

// ---------------------------------------------------------------- checks (same as tests/mapdata.test.ts)
function problems(): { msg: string; rect?: Rect }[] {
  const out: { msg: string; rect?: Rect }[] = [];
  const on = (r: Rect) => r.x >= 0 && r.y >= 0 && r.x + r.w <= data.cols && r.y + r.h <= data.rows && r.w > 0 && r.h > 0;
  const ov = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  data.buildings.forEach((b, i) => {
    if (!on(b.rect)) out.push({ msg: `Building ${i + 1} is off the map`, rect: b.rect });
    for (let j = i + 1; j < data.buildings.length; j++) if (ov(b.rect, data.buildings[j].rect)) out.push({ msg: `Buildings ${i + 1} and ${j + 1} overlap`, rect: b.rect });
  });
  const ids = new Set<string>();
  for (const d of data.districts) {
    if (ids.has(d.id)) out.push({ msg: `Two districts are called "${d.id}"`, rect: d.rect });
    ids.add(d.id);
  }
  for (const d of data.districts) {
    if (d.unlockAfter && !ids.has(d.unlockAfter)) out.push({ msg: `${d.name} opens after "${d.unlockAfter}", which doesn't exist`, rect: d.rect });
    for (const h of d.hiveSites) if (!inR(h, d.rect)) out.push({ msg: `A hive of ${d.name} is outside the district`, rect: { x: h.x - 1, y: h.y - 1, w: 2, h: 2 } });
  }
  const m = cachedMap();
  const made = new Set(m.props.map((p) => `${p.cells.x},${p.cells.y}`));
  data.props.forEach((p, i) => {
    const r = propRect(p);
    if (!made.has(`${r.x},${r.y}`)) out.push({ msg: `Car ${i + 1} sits on a building or another car (it won't appear)`, rect: r });
  });
  return out;
}

// ---------------------------------------------------------------- drawing
let cache: { map: ReturnType<typeof buildMap>; img: HTMLCanvasElement } | null = null;
function cachedMap() {
  if (!cache) {
    const map = buildMap(data);
    const img = document.createElement('canvas');
    img.width = data.cols;
    img.height = data.rows;
    const c = img.getContext('2d')!;
    for (let y = 0; y < data.rows; y++)
      for (let x = 0; x < data.cols; x++) {
        c.fillStyle = TILE_COL[map.tiles[y * data.cols + x]] ?? '#f0f';
        c.fillRect(x, y, 1, 1);
      }
    cache = { map, img };
  }
  return cache.map;
}
function draw(): void {
  cv.width = innerWidth - 300;
  cv.height = innerHeight - 35;
  g.fillStyle = '#111';
  g.fillRect(0, 0, cv.width, cv.height);
  cachedMap();
  g.imageSmoothingEnabled = false;
  g.drawImage(cache!.img, ox, oy, data.cols * scale, data.rows * scale);
  const R = (r: Rect) => [ox + r.x * scale, oy + r.y * scale, r.w * scale, r.h * scale] as const;

  // canopies, buildings, props
  g.strokeStyle = '#d0c070';
  g.setLineDash([4, 3]);
  for (const c of data.canopies) g.strokeRect(...R(c));
  g.setLineDash([]);
  for (const b of data.buildings) {
    g.fillStyle = KIND_COL[b.kind];
    g.fillRect(...R(b.rect));
    g.strokeStyle = '#000';
    g.strokeRect(...R(b.rect));
    if (scale >= 5) {
      g.fillStyle = '#fff';
      g.font = `${Math.min(11, scale * 1.6)}px monospace`;
      g.fillText(`${b.kind[0].toUpperCase()}${b.floors}`, ox + b.rect.x * scale + 2, oy + b.rect.y * scale + Math.min(11, scale * 1.6));
    }
  }
  for (const p of data.props) {
    g.fillStyle = 'pump' in p ? '#b83a2a' : p.color;
    g.fillRect(...R(propRect(p)));
    g.strokeStyle = '#ddd';
    g.strokeRect(...R(propRect(p)));
  }
  // districts, hives, power stations, base gate and rally
  g.lineWidth = 2;
  for (const d of data.districts) {
    g.strokeStyle = d.id === 'base' ? '#7ab0e0' : d.locked ? '#e0b24a' : '#8fcf6a';
    g.strokeRect(...R(d.rect));
    g.fillStyle = g.strokeStyle;
    g.font = '12px monospace';
    g.fillText(`${d.name}${d.unlockAfter ? ` (after ${d.unlockAfter})` : ''}`, ox + d.rect.x * scale + 4, oy + (d.rect.y + d.rect.h) * scale - 5);
    for (const h of d.hiveSites) {
      g.fillStyle = '#e0574a';
      g.beginPath();
      g.arc(ox + h.x * scale, oy + h.y * scale, Math.max(4, scale * 1.3), 0, Math.PI * 2);
      g.fill();
    }
    for (const p of d.powerStations ?? []) {
      g.fillStyle = '#f0e050';
      g.fillRect(ox + p.x * scale, oy + p.y * scale, 6 * scale, 4 * scale);
    }
  }
  g.strokeStyle = '#7ab0e0';
  g.strokeRect(...R(data.base.gate));
  g.fillStyle = '#7ab0e0';
  g.beginPath();
  g.arc(ox + data.base.rally.x * scale, oy + data.base.rally.y * scale, 4, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 1;

  // problems in red
  g.strokeStyle = '#ff3030';
  g.lineWidth = 2;
  for (const pr of problems()) if (pr.rect) g.strokeRect(...R(pr.rect));
  g.lineWidth = 1;

  // selection: outline and a resize handle in the bottom-right corner
  const r = selRect(sel);
  const pt = selPoint(sel);
  g.strokeStyle = '#fff';
  g.setLineDash([5, 3]);
  if (r) g.strokeRect(ox + r.x * scale - 2, oy + r.y * scale - 2, r.w * scale + 4, r.h * scale + 4);
  if (pt) g.strokeRect(ox + pt.x * scale - 6, oy + pt.y * scale - 6, 12, 12);
  g.setLineDash([]);
  if (r && sel && sel.t !== 'prop') {
    g.fillStyle = '#fff';
    g.fillRect(ox + (r.x + r.w) * scale - 5, oy + (r.y + r.h) * scale - 5, 10, 10);
  }
  if (drag?.kind === 'new' && drag.cur) {
    const a = drag.start;
    const b = drag.cur;
    g.strokeStyle = '#8f8';
    g.strokeRect(ox + Math.min(a.x, b.x) * scale, oy + Math.min(a.y, b.y) * scale, Math.abs(b.x - a.x) * scale, Math.abs(b.y - a.y) * scale);
  }
}

// ---------------------------------------------------------------- properties panel
function field(label: string, html: string): string {
  return `<label>${label}</label>${html}`;
}
function drawSide(): void {
  const probs = problems();
  const list = probs.length ? `<div class="bad">${probs.map((p) => `• ${p.msg}`).join('<br>')}</div>` : '<div class="good">No problems found.</div>';
  const help = `<p style="color:#999">Wheel: zoom · right-drag: pan · drag: move · white corner: resize · Del: delete · R: turn a car / road · arrows: nudge · Ctrl+Z: undo. Edits are kept in this browser until you Revert. <b>Save</b> downloads <code>starter.json</code>: upload it to <code>src/data/maps/</code>. <b>Play</b> opens the game on your edit (nothing is uploaded).</p>`;
  let body = '<h3>Nothing selected</h3><p>Pick a tool above, or click something on the map.</p>';
  const s = sel;
  if (s?.t === 'building') {
    const b = data.buildings[s.i];
    body = `<h3>Building ${s.i + 1}</h3>` +
      field('Kind', `<select data-f="kind">${KINDS.map((k) => `<option ${k === b.kind ? 'selected' : ''}>${k}</option>`).join('')}</select>`) +
      field('Floors', `<input type="number" min="1" max="12" data-f="floors" value="${b.floors}">`) +
      field('Colour', `<input type="color" data-f="color" value="${b.color}">`) +
      field('Significant', `<select data-f="landmark">${['', 'hospital', 'police', 'fire'].map((k) => `<option value="${k}" ${k === (b.landmark ?? '') ? 'selected' : ''}>${k || '(no: an ordinary building)'}</option>`).join('')}</select>`) +
      rectFields(b.rect) +
      `<p style="color:#999">A row of houses (kind "houses") is split into one house per ~13 m of street front.</p>`;
  } else if (s?.t === 'prop') {
    const p = data.props[s.i];
    body = 'pump' in p
      ? `<h3>Pump island ${s.i + 1}</h3><p>2 × 1 cells, low cover.</p>`
      : `<h3>Car ${s.i + 1}</h3>` + field('Facing', `<select data-f="horizontal"><option value="1" ${p.horizontal ? 'selected' : ''}>east–west</option><option value="0" ${p.horizontal ? '' : 'selected'}>north–south</option></select>`) + field('Colour', `<input type="color" data-f="color" value="${p.color}">`);
  } else if (s?.t === 'ground') {
    const gr = data.ground[s.i];
    body = `<h3>Ground ${s.i + 1} of ${data.ground.length}</h3><p style="color:#999">Painted in list order: later ones cover earlier ones.</p>` +
      ('paint' in gr
        ? field('Paint', `<select data-f="paint">${TILES.map((t) => `<option ${t === gr.paint ? 'selected' : ''}>${t}</option>`).join('')}</select>`)
        : 'road' in gr
          ? field('Road runs', `<select data-f="axis"><option value="h" ${gr.axis === 'h' ? 'selected' : ''}>east–west</option><option value="v" ${gr.axis === 'v' ? 'selected' : ''}>north–south</option></select>`) + field('Sidewalks', `<select data-f="sidewalks"><option value="1" ${gr.sidewalks ? 'selected' : ''}>yes</option><option value="0" ${gr.sidewalks ? '' : 'selected'}>no</option></select>`)
          : '<p>Rail line (rails over roads at crossings).</p>') +
      rectFields(groundRect(gr)) +
      `<button data-a="raise">Draw later (on top)</button> <button data-a="lower">Draw earlier</button>`;
  } else if (s?.t === 'canopy') body = `<h3>Canopy ${s.i + 1}</h3><p>A roof on posts (gas stations); walkable underneath.</p>` + rectFields(data.canopies[s.i]);
  else if (s?.t === 'district') {
    const d = data.districts[s.i];
    body = `<h3>District: ${d.name}</h3>` + rectFields(d.rect) +
      `<label>All settings (JSON): id, name, difficulty (0 tutorial, 1 easy, 2 standard), initialInfestation, density, mix, packs, hiveStage, locked, unlockAfter, borders, civilians…</label><textarea data-f="json">${JSON.stringify(d, null, 1)}</textarea><button data-a="applyjson">Apply</button>`;
  } else if (s?.t === 'hive') body = `<h3>Hive site (${data.districts[s.i].name})</h3><p>Since v4.53 each game puts a region's hives at random open spots; the sites here set <b>how many</b> hives it has (and are the fallback if no spot fits). Drag to move.</p>`;
  else if (s?.t === 'power') body = `<h3>Power station (${data.districts[s.i].name})</h3><p>6 × 4 cells, placed when the region opens. Drag to move.</p>`;
  else if (s?.t === 'base') body = '<h3>Main base</h3>' + rectFields(data.base.rect);
  else if (s?.t === 'gate') body = '<h3>Base gate</h3>' + rectFields(data.base.gate);
  else if (s?.t === 'rally') body = '<h3>Rally point</h3><p>Where new squads gather. Drag to move.</p>';
  side.innerHTML = body + (s && s.t !== 'base' && s.t !== 'gate' && s.t !== 'rally' ? '<button data-a="delete">Delete</button>' : '') + `<h3 style="margin-top:14px">Checks</h3>${list}${help}`;
}
function rectFields(r: Rect): string {
  return `<label>x, y, width, height (cells; 1 cell = 3 m)</label><div style="display:flex;gap:4px">${(['x', 'y', 'w', 'h'] as const).map((k) => `<input type="number" data-r="${k}" value="${r[k]}">`).join('')}</div>`;
}
side.addEventListener('change', (e) => {
  const el = e.target as HTMLInputElement;
  const s = sel;
  if (!s) return;
  pushUndo();
  if (el.dataset.r) {
    const r = selRect(s);
    if (r) r[el.dataset.r as keyof Rect] = Math.max(el.dataset.r === 'w' || el.dataset.r === 'h' ? 1 : -999, snap(Number(el.value)));
  }
  const f = el.dataset.f;
  if (s.t === 'building' && f) {
    const b = data.buildings[s.i];
    if (f === 'kind') b.kind = el.value as BuildingKind;
    if (f === 'floors') b.floors = Math.max(1, Math.round(Number(el.value)));
    if (f === 'color') b.color = el.value;
    // STATUS #50: a significant building (a long search, a big haul, an unlock: hospital → the Med Bay)
    if (f === 'landmark') {
      if (el.value) b.landmark = el.value as Landmark;
      else delete b.landmark;
    }
  }
  if (s.t === 'prop' && f) {
    const p = data.props[s.i];
    if ('car' in p && f === 'horizontal') p.horizontal = el.value === '1';
    if ('car' in p && f === 'color') p.color = el.value;
  }
  if (s.t === 'ground' && f) {
    const gr = data.ground[s.i];
    if ('paint' in gr && f === 'paint') gr.paint = el.value as GroundTile;
    if ('road' in gr && f === 'axis') gr.axis = el.value as 'h' | 'v';
    if ('road' in gr && f === 'sidewalks') gr.sidewalks = el.value === '1';
  }
  if (f === 'json') return; // applied with the button
  changed();
});
side.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).dataset.a;
  if (!a || !sel) return;
  const s = sel;
  if (a === 'delete') return del();
  pushUndo();
  if (a === 'applyjson' && s.t === 'district') {
    try {
      data.districts[s.i] = JSON.parse((side.querySelector('textarea') as HTMLTextAreaElement).value);
    } catch (err) {
      undo.pop();
      alert(`That isn't valid JSON: ${(err as Error).message}`);
      return;
    }
  }
  if ((a === 'raise' || a === 'lower') && s.t === 'ground') {
    const j = s.i + (a === 'raise' ? 1 : -1);
    if (j < 0 || j >= data.ground.length) return;
    [data.ground[s.i], data.ground[j]] = [data.ground[j], data.ground[s.i]];
    sel = { t: 'ground', i: j };
  }
  changed();
});

// ---------------------------------------------------------------- picking and editing
function pick(p: Vec2): Sel {
  const near = (q: Vec2) => Math.hypot(q.x - p.x, q.y - p.y) < Math.max(1.5, 6 / scale);
  for (let i = 0; i < data.districts.length; i++) {
    const d = data.districts[i];
    for (let j = 0; j < d.hiveSites.length; j++) if (near(d.hiveSites[j])) return { t: 'hive', i, j };
    for (let j = 0; j < (d.powerStations ?? []).length; j++) if (inR(p, { ...d.powerStations![j], w: 6, h: 4 })) return { t: 'power', i, j };
  }
  if (near(data.base.rally)) return { t: 'rally' };
  for (let i = data.props.length - 1; i >= 0; i--) if (inR(p, propRect(data.props[i]))) return { t: 'prop', i };
  for (let i = data.buildings.length - 1; i >= 0; i--) if (inR(p, data.buildings[i].rect)) return { t: 'building', i };
  for (let i = data.canopies.length - 1; i >= 0; i--) if (inR(p, data.canopies[i])) return { t: 'canopy', i };
  if (inR(p, data.base.gate)) return { t: 'gate' };
  for (let i = data.ground.length - 1; i >= 0; i--) {
    const gr = data.ground[i];
    if (!('paint' in gr && gr.paint === 'baseConcrete') && inR(p, groundRect(gr))) return { t: 'ground', i };
  }
  for (let i = data.districts.length - 1; i >= 0; i--) {
    const r = data.districts[i].rect;
    const edge = Math.max(1, 6 / scale);
    const onEdge = inR(p, r, edge) && !inR(p, { x: r.x + edge, y: r.y + edge, w: r.w - edge * 2, h: r.h - edge * 2 });
    if (onEdge) return data.districts[i].id === 'base' ? { t: 'base' } : { t: 'district', i };
  }
  return null;
}
function del(): void {
  const s = sel;
  if (!s || s.t === 'base' || s.t === 'gate' || s.t === 'rally') return;
  pushUndo();
  if (s.t === 'building') data.buildings.splice(s.i, 1);
  if (s.t === 'prop') data.props.splice(s.i, 1);
  if (s.t === 'ground') data.ground.splice(s.i, 1);
  if (s.t === 'canopy') data.canopies.splice(s.i, 1);
  if (s.t === 'district') {
    if (data.districts[s.i].id === 'base') return;
    data.districts.splice(s.i, 1);
  }
  if (s.t === 'hive') data.districts[s.i].hiveSites.splice(s.j, 1);
  if (s.t === 'power') data.districts[s.i].powerStations!.splice(s.j, 1);
  sel = null;
  changed();
}

let drag:
  | { kind: 'move'; start: Vec2; orig: Rect | Vec2 }
  | { kind: 'resize'; start: Vec2; orig: Rect }
  | { kind: 'pan'; sx: number; sy: number; ox: number; oy: number }
  | { kind: 'new'; start: Vec2; cur?: Vec2 }
  | null = null;

cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (e) => {
  const p = toCell(e.offsetX, e.offsetY);
  if (e.button === 2 || e.button === 1) {
    drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox, oy };
    return;
  }
  const at = { x: snap(p.x), y: snap(p.y) };
  if (tool === 'select') {
    // the resize handle of the current selection first
    const r = selRect(sel);
    if (r && sel && sel.t !== 'prop' && Math.abs(p.x - (r.x + r.w)) * scale < 7 && Math.abs(p.y - (r.y + r.h)) * scale < 7) {
      pushUndo();
      drag = { kind: 'resize', start: p, orig: { ...r } };
      return;
    }
    sel = pick(p);
    const rr = selRect(sel);
    const pt = selPoint(sel);
    if (rr || pt) {
      pushUndo();
      drag = { kind: 'move', start: p, orig: rr ? { ...rr } : { ...pt! } };
    }
    draw();
    drawSide();
    return;
  }
  // one-click tools
  pushUndo();
  if (tool === 'car') {
    data.props.push({ car: at, horizontal: true, color: CAR_COLORS[data.props.length % CAR_COLORS.length] });
    sel = { t: 'prop', i: data.props.length - 1 };
  } else if (tool === 'pump') {
    data.props.push({ pump: at });
    sel = { t: 'prop', i: data.props.length - 1 };
  } else if (tool === 'hive' || tool === 'power') {
    const i = districtAt(at);
    if (i < 0) {
      undo.pop();
      flash('Put it inside a district');
      return;
    }
    const d = data.districts[i];
    if (tool === 'hive') {
      d.hiveSites.push(at);
      sel = { t: 'hive', i, j: d.hiveSites.length - 1 };
    } else {
      (d.powerStations ??= []).push(at);
      sel = { t: 'power', i, j: d.powerStations.length - 1 };
    }
  } else {
    undo.pop(); // drag tools push when the rectangle is finished
    drag = { kind: 'new', start: at };
    return;
  }
  changed();
});
addEventListener('pointermove', (e) => {
  const rect = cv.getBoundingClientRect();
  const p = toCell(e.clientX - rect.left, e.clientY - rect.top);
  status.textContent = `cell ${Math.floor(p.x)}, ${Math.floor(p.y)}  (${Math.floor(p.x) * 3} m, ${Math.floor(p.y) * 3} m)`;
  if (!drag) return;
  if (drag.kind === 'pan') {
    ox = drag.ox + e.clientX - drag.sx;
    oy = drag.oy + e.clientY - drag.sy;
  } else if (drag.kind === 'new') drag.cur = { x: snap(p.x), y: snap(p.y) };
  else {
    const dx = snap(p.x - drag.start.x);
    const dy = snap(p.y - drag.start.y);
    if (drag.kind === 'resize') {
      const r = selRect(sel)!;
      r.w = Math.max(1, drag.orig.w + dx);
      r.h = Math.max(1, drag.orig.h + dy);
    } else {
      const r = selRect(sel);
      const pt = selPoint(sel);
      const o = drag.orig as Rect;
      if (r) (r.x = o.x + dx), (r.y = o.y + dy);
      else if (pt) (pt.x = o.x + dx), (pt.y = o.y + dy);
    }
    cache = null;
  }
  draw();
});
addEventListener('pointerup', () => {
  if (drag?.kind === 'new' && drag.cur) {
    const a = drag.start;
    const b = drag.cur;
    const r = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
    if (r.w >= 1 && r.h >= 1) {
      pushUndo();
      if (tool === 'building') {
        data.buildings.push({ rect: r, kind: 'houses', floors: 1, color: '#7a7266' });
        sel = { t: 'building', i: data.buildings.length - 1 };
      } else if (tool === 'lot') {
        data.ground.push({ paint: 'parking', rect: r });
        sel = { t: 'ground', i: data.ground.length - 1 };
      } else if (tool === 'road') {
        data.ground.push({ road: r, axis: r.w >= r.h ? 'h' : 'v', sidewalks: true });
        sel = { t: 'ground', i: data.ground.length - 1 };
      } else if (tool === 'rail') {
        data.ground.push({ rail: r });
        sel = { t: 'ground', i: data.ground.length - 1 };
      } else if (tool === 'canopy') {
        data.canopies.push(r);
        sel = { t: 'canopy', i: data.canopies.length - 1 };
      } else if (tool === 'district') {
        let n = data.districts.length;
        while (data.districts.some((d) => d.id === `district${n}`)) n++;
        const last = data.districts[data.districts.length - 1];
        data.districts.push({ id: `district${n}`, name: `New district ${n}`, rect: r, starter: false, hiveSites: [], initialInfestation: 60, difficulty: 2, density: 1, mix: { walker: 0.8, runner: 0.2 }, locked: true, unlockAfter: last?.id });
        sel = { t: 'district', i: data.districts.length - 1 };
      }
    }
  }
  if (drag && drag.kind !== 'pan' && drag.kind !== 'new') changed();
  drag = null;
  draw();
});
cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  const before = toCell(e.offsetX, e.offsetY);
  scale = Math.min(30, Math.max(2, scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  ox = e.offsetX - before.x * scale;
  oy = e.offsetY - before.y * scale;
  draw();
}, { passive: false });
addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'SELECT') return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    return doUndo();
  }
  if (e.key === 'Delete' || e.key === 'Backspace') return del();
  if (e.key === 'Escape') {
    sel = null;
    tool = 'select';
    drawBar();
    draw();
    drawSide();
    return;
  }
  const s = sel;
  if (e.key.toLowerCase() === 'r' && s) {
    pushUndo();
    if (s.t === 'prop') {
      const p = data.props[s.i];
      if ('car' in p) p.horizontal = !p.horizontal;
    }
    if (s.t === 'ground') {
      const gr = data.ground[s.i];
      if ('road' in gr) gr.axis = gr.axis === 'h' ? 'v' : 'h';
    }
    return changed();
  }
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (d && s) {
    e.preventDefault();
    pushUndo();
    const r = selRect(s);
    const pt = selPoint(s);
    if (r) (r.x += d[0]), (r.y += d[1]);
    else if (pt) (pt.x += d[0]), (pt.y += d[1]);
    changed();
  }
});
addEventListener('resize', draw);

// fit the map to the window
scale = Math.max(2, Math.min((innerWidth - 320) / data.cols, (innerHeight - 55) / data.rows));
drawBar();
draw();
drawSide();
(window as unknown as { mapEditor: unknown }).mapEditor = { get data() { return data; }, format, problems };
