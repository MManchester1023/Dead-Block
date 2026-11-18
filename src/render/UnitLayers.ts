import * as THREE from 'three';
import { BALANCE } from '../config/balance';
import type { Vec2 } from '../core/math';
import type { Squad } from '../sim/entities';
import { squadStatus } from '../ui/status';
import type { FrameState, RenderCtx } from './context';
import { SOLDIER_SCALE, buildHiveMesh, buildStructureMesh, makeSoldier } from './meshes';
import { PAL } from './palette';

interface SquadView {
  group: THREE.Group;
  ring: THREE.Mesh;
  /** Box figures, only when the character models aren't loaded (the crowds draw them otherwise). */
  members: THREE.Group[];
  label: HTMLDivElement;
}

/** Squads: selection ring, name / status / health label, and box figures if there are no models. */
export class SquadLayer {
  private views = new Map<number, SquadView>();

  constructor(private ctx: RenderCtx, private placeholders: boolean) {}

  private view(s: Squad): SquadView {
    let v = this.views.get(s.id);
    if (v) return v;
    const { scene, overlay, labels } = this.ctx;
    const group = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.7, 3.1, 32), new THREE.MeshBasicMaterial({ color: PAL.select, transparent: true, opacity: 0.85, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    group.add(ring);
    const color = s.def.id === 'engineer' ? PAL.engineer : PAL.olive;
    const members = (this.placeholders ? s.members : []).map(() => {
      const m = makeSoldier(color);
      scene.add(m);
      return m;
    });
    scene.add(group);
    v = { group, ring, members, label: labels.make(overlay, 'squad-label') };
    this.views.set(s.id, v);
    return v;
  }

  update(f: FrameState): void {
    const { scene, world: w, labels } = this.ctx;
    const seen = new Set<number>();
    for (const s of w.squads) {
      if (!s.alive) continue;
      seen.add(s.id);
      const v = this.view(s);
      v.group.position.set(s.pos.x, 0, s.pos.y);
      v.ring.visible = f.selected.has(s.id);
      if (this.placeholders) s.members.forEach((m, i) => {
        const g = v.members[i];
        if (!g) return; // placeholder figures were made before an Elite's fifth soldier joined
        g.visible = m.alive;
        if (!m.alive) return;
        const bob = s.moving ? Math.abs(Math.sin(f.time * 10 + i)) * 0.1 : 0;
        g.position.set(m.pos.x, bob, m.pos.y);
        g.rotation.y = -m.facing;
        g.scale.y = SOLDIER_SCALE * (s.inCover && !s.moving ? 0.82 : 1); // crouch behind cover
      });
      // round 13 #158: a squad's label (name, status, health) only shows while the mouse is over it;
      // round 14 #178: every squad under the cursor shows it, stacked upwards so they don't cover each other
      const k = f.hoveredSquads.indexOf(s.id);
      if (k < 0 && f.hovered !== s.id) {
        v.label.style.display = 'none';
        continue;
      }
      v.label.style.marginTop = `${-Math.max(0, k) * 34}px`;
      labels.place(v.label, s.pos, s.garrisonedIn != null ? 9.5 : 3.4, () => this.labelHtml(s, f.selected.has(s.id), true));
    }
    for (const [id, v] of this.views)
      if (!seen.has(id)) {
        scene.remove(v.group);
        v.members.forEach((m) => scene.remove(m));
        v.label.remove();
        this.views.delete(id);
      }
  }

  /** Squad whose name label is under this screen point (clicking a name selects it; #39). */
  atLabel(x: number, y: number): number | null {
    for (const [id, v] of this.views) {
      if (v.label.style.display === 'none') continue;
      // round 7 #84: the whole label (name, status, bar) is a click target, not just the name
      const r = v.label.getBoundingClientRect();
      if (!r.width) continue;
      if (x >= r.left - 3 && x <= r.right + 3 && y >= r.top - 3 && y <= r.bottom + 3) return id;
    }
    return null;
  }

  private labelHtml(s: Squad, sel: boolean, hover = false): string {
    const k = s.hp / s.maxHp;
    const bar = `<span class="hpbar"><i class="${k < 0.35 ? 'low' : k < 0.7 ? 'mid' : ''}" style="width:${(k * 100).toFixed(0)}%"></i></span>`;
    const pips = bar + s.members.map((m) => `<span class="pip ${m.alive ? '' : 'dead'}"></span>`).join('');
    const st = squadStatus(s, this.ctx.world);
    const cover = st.tone === 'idle' && st.text === 'IDLE' ? '' : `<span class="status ${st.tone}">${st.text}</span>`;
    const lvl = s.level ? `<span class="tag lvl">${s.levelName.toUpperCase()}</span>` : '';
    const bars = sel || hover ? `<div class="pips">${pips}</div>` : '';
    return `<div class="sname ${sel ? 'sel' : ''} ${hover ? 'hover' : ''}">${s.name}${lvl}</div>${cover ? `<div>${cover}</div>` : ''}${bars}`;
  }
}

/** Structures: models, build/health/power labels, lamps and MG turrets; a puff of debris when one goes. */
export class StructureLayer {
  private views = new Map<number, THREE.Object3D>();
  private labelEls = new Map<number, HTMLDivElement>();

  /** `destroyed` is called with where a structure stood when it disappears. */
  constructor(private ctx: RenderCtx, private destroyed: (p: Vec2) => void) {}

  update(f: FrameState): void {
    const { scene, overlay, world: w, labels } = this.ctx;
    const seen = new Set<number>();
    for (const s of w.structures) {
      if (!s.alive) continue;
      seen.add(s.id);
      let o = this.views.get(s.id);
      if (!o) {
        o = buildStructureMesh(s);
        o.position.set(s.pos.x, 0, s.pos.y);
        // round 13 #160: an emplacement faces its field of fire (the sandbag opening ends up at the back)
        if (s.def.arc) o.rotation.y = -s.aim;
        scene.add(o);
        this.views.set(s.id, o);
      }
      // a power station being restored is a whole (dead) building, not a half-built site (v4.17)
      const whole = s.built || !!s.def.restore;
      const k = whole ? 1 : 0.15 + 0.85 * Math.min(1, s.buildProgress / s.def.buildTime);
      o.scale.y = k;
      o.traverse((c) => {
        const mat = (c as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
        if (mat && 'opacity' in mat) mat.opacity = whole ? 1 : 0.55;
      });
      // power lamps: red = offline / no power, green = running (v4.17)
      const lamp = o.getObjectByName('lamp') as THREE.Mesh | undefined;
      if (lamp) {
        const on = s.def.restore ? s.built : s.built && w.powerOnline;
        (lamp.material as THREE.MeshLambertMaterial).color.set(on ? 0x5ad06a : 0xc83a2a);
        (lamp.material as THREE.MeshLambertMaterial).emissive.set(on ? 0x2a7a32 : 0x5a1a12);
      }
      const turret = o.getObjectByName('turret');
      if (turret) turret.rotation.y = -(s.facing - (s.def.arc ? s.aim : 0)); // relative to the nest's own turn (#160)
      // progress bar while unfinished, health bar while damaged (v4.4: resume / repair)
      // build progress always shows; health only on hover / selection (#35)
      const focus = f.hovered === s.id || f.selectedStructure === s.id;
      // power objects always say what state they're in
      const powerNote = s.def.restore ? (s.built ? 'POWER STATION · ONLINE' : 'POWER STATION · OFFLINE') : s.def.needsPower && s.built && !w.powerOnline ? 'MED BAY · NO POWER' : '';
      const needsBar = !s.built || (focus && s.hp < s.def.hp - 0.5) || !!powerNote;
      let lab = this.labelEls.get(s.id);
      if (needsBar) {
        if (!lab) {
          lab = labels.make(overlay, 'struct-label');
          this.labelEls.set(s.id, lab);
        }
        const pct = s.built ? (s.hp / s.def.hp) * 100 : Math.min(100, (s.buildProgress / s.def.buildTime) * 100);
        const what = s.def.restore && !s.built ? `${s.buildProgress > 0 ? 'Restoring' : 'Offline · engineers can restore it'}` : s.built ? 'Damaged' : 'Unfinished';
        const showBar = !s.built || (focus && s.hp < s.def.hp - 0.5);
        labels.place(lab, s.pos, s.def.restore ? 9 : 2.5, () =>
          `${powerNote ? `<b class="${powerNote.includes('ONLINE') ? 'good' : 'bad'}">${powerNote}</b><br>` : ''}${showBar ? `<span>${what} ${Math.floor(pct)}%</span><div class="bar ${s.built ? 'hp' : 'build'}"><i style="width:${pct.toFixed(0)}%"></i></div>` : ''}`,
        );
      } else if (lab) {
        lab.remove();
        this.labelEls.delete(s.id);
      }
    }
    for (const [id, lab] of this.labelEls)
      if (!seen.has(id)) {
        lab.remove();
        this.labelEls.delete(id);
      }
    for (const [id, o] of this.views)
      if (!seen.has(id)) {
        scene.remove(o);
        this.views.delete(id);
        const p = new THREE.Vector3();
        o.getWorldPosition(p);
        this.destroyed({ x: p.x, y: p.z });
      }
  }
}

/** Hives: a pulsing core that grows with its stage, and a label (with health on hover). */
export class HiveLayer {
  private views = new Map<number, { group: THREE.Group; core: THREE.Mesh; label: HTMLDivElement }>();

  constructor(private ctx: RenderCtx) {}

  update(f: FrameState): void {
    const { scene, overlay, world: w, labels } = this.ctx;
    for (const h of w.hives) {
      let v = this.views.get(h.id);
      if (!v) {
        const { group, core } = buildHiveMesh();
        group.position.set(h.pos.x, 0, h.pos.y);
        scene.add(group);
        v = { group, core, label: labels.make(overlay, 'hive-label') };
        this.views.set(h.id, v);
      }
      if (!h.alive) {
        if (v.group.visible) {
          v.group.visible = false;
          v.label.remove();
        }
        continue;
      }
      const pulse = 1 + Math.sin(f.time * (1.5 + h.stage)) * 0.06;
      v.core.scale.setScalar((0.8 + h.stage * 0.18) * pulse);
      (v.core.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.15 + h.stage * 0.12 + (pulse - 1) * 2;
      labels.place(v.label, h.pos, 7, () => {
        const pct = Math.max(0, h.hp / BALANCE.hive.hpByStage[h.stage - 1]) * 100;
        if (f.hovered !== h.id) return `<b>HIVE</b> · stage ${h.stage}/4`;
        // round 11 #135: on hover, time to the next stage with a progress bar under the health bar
        const dur = BALANCE.hive.stageDurationSec[h.stage - 1];
        const grow = dur
          ? `<div class="hive-next">stage ${h.stage + 1} in ${Math.floor(Math.max(0, dur - h.stageTimer) / 60)}:${String(Math.floor(Math.max(0, dur - h.stageTimer) % 60)).padStart(2, '0')}</div><div class="bar grow"><i style="width:${Math.min(100, (h.stageTimer / dur) * 100).toFixed(0)}%"></i></div>`
          : '<div class="hive-next">fully grown</div>';
        return `<b>HIVE</b> · stage ${h.stage}/4<div class="bar"><i style="width:${pct}%"></i></div>${grow}`;
      });
    }
  }
}
