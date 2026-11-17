import './style.css';
import { Game } from './Game';
import { Input } from './input/Input';
import { Hud } from './ui/Hud';
import { models } from './render/ModelLibrary';
import { loadCast } from './render/characters';

const view = document.getElementById('view')!;
const labels = document.getElementById('labels')!;
const hudRoot = document.getElementById('hud')!;

async function boot(): Promise<void> {
  // optional glTF overrides first (public/models/manifest.json); everything else is procedural
  const loading = document.getElementById('loading');
  const [, cast] = await Promise.all([models.preload(), loadCast()]);
  loading?.remove();

  const game = new Game(view, labels, cast);
  const input = new Input(game, view);
  const hud = new Hud(game, hudRoot);

  let last = performance.now();
  game.start(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    input.update(dt);
    hud.update(dt);
  });

  // handy in the browser console while playtesting
  Object.assign(window as unknown as Record<string, unknown>, { game, hud });
}

void boot();
