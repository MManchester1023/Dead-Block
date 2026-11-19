import type { FrameState, RenderCtx } from './context';

/**
 * Significant buildings (STATUS #50, round 15 #185): a floating label over each one in an open region until
 * it's been looted, so players can find it. (The red cross on the hospital's roof is drawn with the city.)
 */
export class LandmarkLayer {
  private els = new Map<number, HTMLElement>();

  constructor(private ctx: RenderCtx) {}

  update(_f: FrameState): void {
    const { world: w, labels, overlay } = this.ctx;
    for (const b of w.map.buildings) {
      if (!b.landmark) continue;
      const centre = { x: b.rect.x + b.rect.w / 2, y: b.rect.y + b.rect.h / 2 };
      const d = w.districtAt(centre);
      const show = !!d && !d.locked && !w.buildingState.get(b.id)?.searched;
      let el = this.els.get(b.id);
      if (!show) {
        if (el) el.style.display = 'none';
        continue;
      }
      if (!el) {
        el = labels.make(overlay, `landmark-label ${b.landmark}`);
        this.els.set(b.id, el);
      }
      const label = el;
      const name = b.landmark === 'hospital' ? '✚ HOSPITAL' : b.landmark === 'police' ? '★ POLICE STATION' : '▲ FIRE STATION';
      labels.place(label, centre, b.height + 3, () => `${name}<small>search it for supplies and an unlock</small>`);
    }
  }
}
