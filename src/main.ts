import './style.css';
import { Game } from './Game';
import { Input } from './input/Input';
import { Hud } from './ui/Hud';
import { models } from './render/ModelLibrary';
import { loadCast } from './render/characters';
import { Sound } from './audio/Sound';
import { takePendingLoad } from './sim/save';

const view = document.getElementById('view')!;
const labels = document.getElementById('labels')!;
const hudRoot = document.getElementById('hud')!;

async function boot(): Promise<void> {
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
