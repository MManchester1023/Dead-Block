import './style.css';
import { Game } from './Game';
import { Input } from './input/Input';
import { Hud } from './ui/Hud';

const view = document.getElementById('view')!;
const labels = document.getElementById('labels')!;
const hudRoot = document.getElementById('hud')!;

const game = new Game(view, labels);
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
(window as unknown as { game: Game }).game = game;
