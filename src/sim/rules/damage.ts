import { dist, norm, sub, type Vec2 } from '../../core/math';
import { BALANCE, HORDE } from '../../config/balance';
import { isEnabled } from '../../config/features';
import { Hive, Squad, Structure, Zombie, newId, type ToxicCloud } from '../entities';
import type { DamageType, Targetable } from '../types';
import type { World } from '../World';

/** Damage, death and noise: what happens when anything gets hurt, blown up, or makes a racket. */

/** Infestation one kill of this kind takes off its district (v4.49: divided by HORDE.count). */
export function infestationPerKill(defId: string): number {
  return (BALANCE.infestation.perKill[defId] ?? 0.5) / HORDE.count;
}

export function makeNoise(w: World, pos: Vec2, loudness: number): void {
  if (!isEnabled('noise')) return;
  // merge with a fresh sound from the same spot (a squad's volley is one noise, not eight)
  const m2 = BALANCE.noise.mergeRadius ** 2;
  const same = w.noiseEvents.find((e) => e.age === 0 && (e.pos.x - pos.x) ** 2 + (e.pos.y - pos.y) ** 2 <= m2);
  if (same) same.loudness = Math.max(same.loudness, loudness) + Math.min(loudness, same.loudness) * 0.1;
  else w.noiseEvents.push({ pos: { ...pos }, loudness, age: 0 });
  const d = w.districtAt(pos);
  if (d && d.def.id !== 'base' && !d.locked && w.time >= (d.noiseLockUntil ?? 0)) {
    d.noise = Math.min(BALANCE.noise.pulseThreshold, d.noise + loudness * 0.12);
    d.noiseHold = BALANCE.noise.holdSec;
  }
}

export function damage(w: World, target: Targetable, amount: number, type: DamageType, source?: Vec2, attacker?: Targetable): void {
  if (!target.alive) return;
  // a squad up a guard tower can't be clawed at: the dead have to tear the tower down (v4.13)
  if (target instanceof Squad && target.garrisonedIn != null && type === 'melee') {
    const tower = w.get(target.garrisonedIn);
    if (tower instanceof Structure && tower.alive) return damageStructure(w, tower, amount);
  }
  if (target instanceof Squad) damageSquad(w, target, amount, type, source);
  else if (target instanceof Zombie) damageZombie(w, target, amount, type, attacker);
  else if (target instanceof Hive) damageHive(w, target, amount, type);
  else if (target instanceof Structure) damageStructure(w, target, amount);
}

export function damageSquad(w: World, sq: Squad, amount: number, type: DamageType, source?: Vec2): void {
  const reduction = type === 'toxic' || type === 'explosive' ? 0 : sq.inCover;
  let dmg = amount * (1 - reduction);
  if (!sq.alive) return;
  sq.lastHit = w.time;
  sq.pool = Math.max(0, sq.pool - dmg);
  // one shared pool (v4.9 #50): a soldier drops each time it crosses a member's share; the one
  // nearest the source (the one in front) goes first
  while (sq.aliveCount > sq.membersSupported) {
    const alive = sq.members.filter((m) => m.alive);
    const victim = source ? alive.reduce((a, b) => (dist(a.pos, source) < dist(b.pos, source) ? a : b)) : w.rng.pick(alive);
    victim.alive = false;
    w.events.emit('memberKilled', { squadId: sq.id, squadName: sq.name, pos: { ...victim.pos }, facing: victim.facing, unitId: sq.def.id });
    if (!sq.alive) {
      w.events.emit('squadWiped', { squadId: sq.id, squadName: sq.name });
      w.forget(sq.id);
      // Tier 2 hook: soldiers killed by the horde can rise again (specialZombies / reanimation)
      if (isEnabled('specialZombies')) w.spawnZombie('walker', sq.pos);
    }
  }
}

export function damageZombie(w: World, z: Zombie, amount: number, type: DamageType, attacker?: Targetable): void {
  z.hp -= amount;
  if (amount >= 1 && type !== 'toxic' && type !== 'fire') w.events.emit('bleed', { pos: { ...z.pos }, from: attacker ? { ...attacker.pos } : undefined, heavy: amount > 25 });
  // getting shot makes it angry at the shooter (v4.4: Bloaters sometimes just stood there)
  if (attacker && attacker.alive && z.alive && z.state !== 'attack') {
    const cur = w.get(z.targetId);
    if (!(cur instanceof Squad) || cur === attacker || dist(z.pos, attacker.pos) < dist(z.pos, cur.pos)) {
      z.targetId = attacker.id;
      z.state = 'chase';
      z.aggro = BALANCE.zombie.aggroTimeSec;
    }
  }
  if (type === 'fire') z.burning = Math.max(z.burning, 3);
  if (z.hp <= 0 && z.alive) {
    z.alive = false;
    w.forget(z.id);
    const d = w.districtAt(z.pos);
    w.events.emit('zombieKilled', { id: z.id, defId: z.def.id, pos: { ...z.pos }, facing: z.facing, districtId: d?.def.id ?? null });
    // small salvage per kill (v4.4): scavenged cash and gear
    // v4.49: twice the dead, so half the salvage and infestation each (HORDE.count)
    w.money += z.def.bounty.money / HORDE.count;
    w.addSupplies(z.def.bounty.supplies / HORDE.count);
    if (d) d.infestation = Math.max(0, d.infestation - infestationPerKill(z.def.id));
    if (z.def.onDeath === 'toxicCloud') {
      const cloud: ToxicCloud = { id: newId(), pos: { ...z.pos }, radius: 5.5, remaining: 8, dps: 7 };
      w.clouds.push(cloud);
      w.events.emit('toxicCloud', { pos: cloud.pos, radius: cloud.radius, duration: cloud.remaining });
      explode(w, z.pos, 4.5, 6, 'toxic', 0.8);
    }
  }
}

export function damageHive(w: World, h: Hive, amount: number, type: DamageType): void {
  // doc §9: only fire or explosives destroy hives
  if (type !== 'fire' && type !== 'explosive') return;
  h.hp -= amount;
  if (h.hp <= 0 && h.alive) {
    h.alive = false;
    w.forget(h.id);
    w.grid.setRect(w.grid.c(h.pos.x) - 1, w.grid.c(h.pos.y) - 1, 2, 2, false);
    const d = w.districts.get(h.districtId);
    if (d) d.infestation = Math.max(0, d.infestation - BALANCE.infestation.hiveDestroyed);
    w.money += BALANCE.economy.hiveBounty;
    w.events.emit('hiveDestroyed', { hiveId: h.id, districtId: h.districtId });
  }
}

export function damageStructure(w: World, s: Structure, amount: number): void {
  s.hp -= amount;
  if (s.def.restore) {
    // a wrecked power station goes dark, it isn't destroyed: engineers can restore it again
    if (s.hp <= 0 && s.alive) {
      const wasOn = s.built;
      s.hp = s.def.hp * 0.1;
      s.built = false;
      s.buildProgress = s.def.buildTime * 0.5;
      if (wasOn) {
        w.events.emit('powerLost', { id: s.id });
        w.events.emit('radio', { speaker: 'Command', text: 'We just lost the power station. The Med Bay is dark until engineers get it running again.', tone: 'bad' });
      }
    }
    return;
  }
  if (s.hp <= 0 && s.alive) {
    removeStructure(w, s);
    w.events.emit('structureDestroyed', { id: s.id, defId: s.def.id, pos: s.pos });
  }
}

/** Take a structure out of the world (destroyed or dismantled) and free its cells. */
export function removeStructure(w: World, s: Structure): void {
  s.alive = false;
  w.forget(s.id);
  const def = s.def;
  if (def.blocksMovement) w.grid.setRect(s.tile.x, s.tile.y, s.size.w, s.size.h, false);
  if (def.slow) w.grid.setSlow(s.tile.x, s.tile.y, s.size.w, s.size.h, 1);
}

/** Engineers can take back what they built (v4.2): full refund for an unstarted site, half otherwise. */
export function canDeconstruct(s: Structure): string | null {
  if (!s.alive) return 'Already gone';
  if (!s.def.cost.money && !s.def.cost.supplies) return "Base facilities can't be dismantled";
  return null;
}

export function dismantle(w: World, s: Structure): void {
  if (canDeconstruct(s)) return;
  const k = !s.built && s.buildProgress <= 0 ? 1 : 0.5;
  const refund = { money: Math.round(s.def.cost.money * k), supplies: Math.round(s.def.cost.supplies * k) };
  w.money += refund.money;
  w.addSupplies(refund.supplies);
  // dismantling your own outpost gives up the district quietly — no hive (that's for a zombie retake)
  for (const d of w.districts.values())
    if (d.outpostId === s.id) {
      d.secured = false;
      d.outpostId = null;
    }
  removeStructure(w, s);
  w.events.emit('structureDismantled', { id: s.id, defId: s.def.id, pos: s.pos, refund });
}

/** Area damage with knockback by distance (doc §5 v4: friend and foe both get thrown). */
export function explode(w: World, pos: Vec2, radius: number, dmg: number, type: DamageType, knockback = 1.5): void {
  w.events.emit('explosion', { pos: { ...pos }, radius, type });
  const kb = isEnabled('knockback') ? knockback : 0;
  for (const z of w.zombieHash.query(pos, radius + 2)) {
    if (!z.alive) continue;
    const d = dist(pos, z.pos);
    if (d > radius + z.radius) continue;
    const falloff = 1 - Math.min(1, d / (radius + z.radius)) * 0.6;
    damageZombie(w, z, dmg * falloff, type);
    if (kb) {
      const dir = norm(sub(z.pos, pos));
      z.knock.x += dir.x * kb * 12 * falloff; // m/s
      z.knock.y += dir.y * kb * 12 * falloff;
    }
  }
  for (const s of w.squads) {
    if (!s.alive) continue;
    const d = dist(pos, s.pos);
    if (d > radius + s.radius) continue;
    const falloff = 1 - Math.min(1, d / (radius + s.radius)) * 0.6;
    if (type !== 'toxic') damageSquad(w, s, dmg * 0.6 * falloff, type, pos);
    if (kb && d < radius * 0.7) {
      const dir = norm(sub(s.pos, pos));
      s.knock.x += dir.x * kb * 6 * falloff;
      s.knock.y += dir.y * kb * 6 * falloff;
      s.stunned = Math.max(s.stunned, 0.6 * falloff);
    }
  }
  for (const h of w.hives) if (h.alive && dist(pos, h.pos) <= radius + h.radius) damageHive(w, h, dmg, type);
  for (const st of w.structures)
    if (st.alive && st.def.id !== 'baseWall' && dist(pos, st.pos) <= radius + st.radius) damageStructure(w, st, dmg * 0.3);
  makeNoise(w, pos, type === 'toxic' ? 4 : radius * 3);
}
