import type { Vec2 } from '../core/math';
import type { RenderCtx } from './context';

/**
 * Floating text over the map (round 12 #142 / round 11 #121): what a house search turned up, rising and
 * fading over a couple of seconds. Real time, so it reads the same at any game speed.
 */
export class Popups {
  private live: { el: HTMLDivElement; pos: Vec2; age: number; html: string }[] = [];
  private static readonly LIFE = 2.6;

  constructor(private ctx: RenderCtx) {
    ctx.world.events.on('buildingSearched', (e) => {
      const b = ctx.world.map.buildings.find((x) => x.id === e.buildingId);
      const pos = b ? { x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h / 2 } : e.pos;
      if (e.found === 'zombies') this.add(pos, 'Contact!', 'bad');
      else if (e.found === 'civilians') this.add(pos, 'Survivors!', 'good');
      else if (e.found === 'nothing') this.add(pos, 'Empty', 'muted');
      else this.add(pos, e.found.replace(/supplies/, '▣').replace(/, /g, '  '), 'good');
    });
  }

  add(pos: Vec2, text: string, tone: 'good' | 'bad' | 'muted'): void {
    const el = this.ctx.labels.make(this.ctx.overlay, `popup ${tone}`);
    this.live.push({ el, pos: { ...pos }, age: 0, html: text });
  }

  update(realDt: number): void {
    for (const p of this.live) {
      p.age += realDt;
      const k = p.age / Popups.LIFE;
      this.ctx.labels.place(p.el, p.pos, 9 + k * 6, () => p.html);
      p.el.style.opacity = String(k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3));
    }
    for (const p of this.live.filter((x) => x.age >= Popups.LIFE)) p.el.remove();
    this.live = this.live.filter((x) => x.age < Popups.LIFE);
  }
}
