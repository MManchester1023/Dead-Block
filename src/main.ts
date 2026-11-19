import './style.css';
import { Game } from './Game';
import { Input } from './input/Input';
import { Hud } from './ui/Hud';
import { models } from './render/ModelLibrary';
import { loadCast } from './render/characters';
import { Sound } from './audio/Sound';
import { takePendingLoad } from './sim/save';
import { currentMapData, useMapData } from './sim/map';
import { applyTuning, TUNING_STORAGE_KEY } from './config/tuning';

const view = document.getElementById('view')!;
const labels = document.getElementById('labels')!;
const hudRoot = document.getElementById('hud')!;

/** Apply public/balance.json and then this browser's edits (dev-balance.html); a line for the HUD if any. */
async function loadTuning(): Promise<string | null> {
  const map = currentMapData();
  const parts: string[] = [];
  const bad: string[] = [];
  try {
    const res = await fetch('balance.json', { cache: 'no-store' });
    if (res.ok && (res.headers.get('content-type') ?? '').includes('json')) {
      const t = (await res.json()) as Record<string, unknown>;
      bad.push(...applyTuning(t, map));
      if (Object.keys(t).length) parts.push(`${Object.keys(t).length} from balance.json`);
    }
  } catch {
    /* no file: the defaults */
  }
  try {
    const raw = localStorage.getItem(TUNING_STORAGE_KEY);
    const t = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    bad.push(...applyTuning(t, map));
    if (Object.keys(t).length) parts.push(`${Object.keys(t).length} from this browser`);
  } catch {
    /* no storage */
  }
  if (bad.length) console.warn('[tuning] skipped:', bad);
  return parts.length ? `Tuned difficulty in use: ${parts.join(', ')} (dev-balance.html)` : null;
}

async function boot(): Promise<void> {
  // the map editor's Play button (dev-map.html) opens the game with ?map=edited on its edit
  if (new URLSearchParams(location.search).get('map') === 'edited') {
    try {
      const raw = localStorage.getItem('dbc.mapOverride');
      if (raw) useMapData(JSON.parse(raw));
    } catch {
      /* no storage: the normal map */
    }
  }
  // round 15 #181: difficulty tuning from dev-balance.html: the kept file, then this browser's test edits
  const tuned = await loadTuning();
  // optional glTF overrides first (public/models/manifest.json); everything else is procedural
  const loading = document.getElementById('loading');
  const [, cast] = await Promise.all([models.preload(), loadCast()]);
  loading?.remove();

  // a save the player chose to load (the page reloads to rebuild the scene from it)
  const pending = await takePendingLoad();
  let game: Game;
  let loadError: string | null = pending && !pending.data ? 'That save could not be read.' : null;
  try {
    game = new Game(view, labels, cast, pending?.data ?? null);
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'That save could not be loaded.';
    view.innerHTML = '';
    labels.innerHTML = '';
    game = new Game(view, labels, cast);
  }
  const input = new Input(game, view);
  const hud = new Hud(game, hudRoot);
  const sound = new Sound(game);
  hud.sound = sound;
  if (loadError) hud.toast(`Load failed: ${loadError} Starting a new game.`);
  else if (tuned) hud.toast(tuned);

  let last = performance.now();
  game.start(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    input.update(dt);
    hud.update(dt);
    sound.update(dt);
  });

  // handy in the browser console while playtesting
  Object.assign(window as unknown as Record<string, unknown>, { game, hud, sound });
}

void boot();
