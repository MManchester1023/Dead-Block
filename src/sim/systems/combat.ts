import { dist, type Vec2 } from '../../core/math';
import { BALANCE } from '../../config/balance';
import { isEnabled } from '../../config/features';
import { ABILITIES, type WeaponDef } from '../../config/units';
import { Hive, Squad, Zombie } from '../entities';
import { pickTarget } from '../targeting';
import { areHostile, type Faction, type Targetable } from '../types';
import type { World } from '../World';

/** Can this weapon hurt that target at all? Bullets bounce off hives (doc §9). */
export function canHurt(weapon: WeaponDef, t: Targetable): boolean {
  if (t instanceof Hive) return weapon.type === 'explosive' || weapon.type === 'fire';
  return true;
}

function candidatesFor(w: World, faction: Faction, pos: Vec2, range: number): Targetable[] {
  const out: Targetable[] = [];
  if (areHostile(faction, 'zombie')) {
    w.zombieHash.query(pos, range + 2, out as Zombie[]);
    for (const h of w.hives) if (h.alive && dist(h.pos, pos) <= range + h.radius) out.push(h);
  }
  // 'hostile' human faction candidates get appended here when that faction exists (doc §9a)
  return out;
}

function acquire(w: World, shooter: { pos: Vec2; targetId: number | null }, faction: Faction, weapon: WeaponDef): Targetable | null {
  if (!isEnabled('threatTargeting')) {
    // fallback: nearest, no lock (useful for A/B playtesting the v4 rule)
    shooter.targetId = null;
  }
  const t = pickTarget({
    pos: shooter.pos,
    range: weapon.range,
    dangerClose: BALANCE.combat.dangerCloseRadius,
    current: w.get(shooter.targetId) ?? null,
    candidates: candidatesFor(w, faction, shooter.pos, weapon.range),
    canEngage: (t) => canHurt(weapon, t) && w.grid.lineClear(shooter.pos, t.pos),
  });
  shooter.targetId = t?.id ?? null;
  return t;
}

function fire(w: World, from: Vec2, t: Targetable, weapon: WeaponDef, dmgMult: number, accMult: number): boolean {
  const d = dist(from, t.pos);
  const acc = weapon.accuracy * (1 - 0.35 * Math.min(1, d / weapon.range)) * accMult;
  const hit = w.rng.chance(acc);
  const miss = hit ? { x: 0, y: 0 } : { x: w.rng.range(-1.6, 1.6), y: w.rng.range(-1.6, 1.6) };
  w.events.emit('shot', { from: { ...from }, to: { x: t.pos.x + miss.x, y: t.pos.y + miss.y }, faction: 'player', heavy: weapon.damage >= 30 });
  w.makeNoise(from, weapon.loudness);
  if (!hit) return false;
  const wasAlive = t.alive;
  w.damage(t, weapon.damage * dmgMult, weapon.type, from);
  return wasAlive && !t.alive;
}

export function updateCombat(w: World, dt: number): void {
  for (const s of w.squads) {
    if (!s.alive || s.stunned > 0) continue;
    const order = s.currentOrder;
    const busy = order?.type === 'build' || order?.type === 'charge' || order?.type === 'deconstruct';
    // forced target (right-clicked zombie) overrides threat priority once it's in range and visible
    const forced = order?.type === 'attack' ? w.get(order.targetId ?? null) : undefined;
    const forcedOk =
      forced && forced.alive && dist(s.pos, forced.pos) - forced.radius <= s.def.weapon.range && canHurt(s.def.weapon, forced) && w.grid.lineClear(s.pos, forced.pos);
    if (forcedOk) s.targetId = forced.id;
    const t = forcedOk ? forced : acquire(w, s, s.faction, s.def.weapon);
    if (!t) continue;
    if (!s.moving) s.facing = Math.atan2(t.pos.y - s.pos.y, t.pos.x - s.pos.x);
    // builders only defend themselves against danger-close threats
    if (busy && dist(t.pos, s.pos) > BALANCE.combat.dangerCloseRadius + 2) continue;
    const accMult = s.moving ? 0.6 : 1;
    for (const m of s.members) {
      if (!m.alive) continue;
      m.cooldown -= dt;
      if (m.cooldown > 0) continue;
      m.cooldown = s.def.weapon.cooldown * w.rng.range(0.85, 1.15);
      if (!t.alive) break;
      if (fire(w, m.pos, t, s.def.weapon, s.dmgMult, accMult)) {
        s.kills++;
        gainXp(w, s, t instanceof Zombie && t.def.threat >= 2 ? 3 : BALANCE.combat.xpPerKill);
      }
    }
  }

  for (const st of w.structures) {
    const wpn = st.def.weapon;
    if (!wpn || !st.built || !st.alive) continue;
    st.cooldown -= dt;
    const t = acquire(w, st, st.faction, wpn);
    if (!t) continue;
    st.facing = Math.atan2(t.pos.y - st.pos.y, t.pos.x - st.pos.x);
    if (st.cooldown <= 0) {
      st.cooldown = wpn.cooldown;
      fire(w, st.pos, t, wpn, 1, 1);
    }
  }

  // demo charges
  for (const c of w.charges) {
    c.fuse -= dt;
    if (c.fuse <= 0) {
      const ab = ABILITIES.demoCharge;
      w.explode(c.pos, ab.radius, ab.damage, ab.type, 2.2);
      w.makeNoise(c.pos, ab.loudness);
    }
  }
  w.charges = w.charges.filter((c) => c.fuse > 0);

  // Bloater clouds hurt the living, not the dead
  for (const cl of w.clouds) {
    cl.remaining -= dt;
    for (const s of w.squads) if (s.alive && dist(s.pos, cl.pos) < cl.radius + s.radius) w.damageSquad(s, cl.dps * dt, 'toxic');
  }
  w.clouds = w.clouds.filter((c) => c.remaining > 0);

  for (const z of w.zombies) {
    if (z.alive && z.burning > 0) {
      z.burning -= dt;
      w.damageZombie(z, 8 * dt, 'fire');
    }
  }
}

export function gainXp(w: World, s: Squad, amount: number): void {
  if (!isEnabled('leveling')) return;
  s.xp += amount;
  const levels = BALANCE.combat.levels;
  while (s.level < levels.length - 1 && s.xp >= levels[s.level + 1].xp) {
    const prev = levels[s.level];
    s.level++;
    const next = levels[s.level];
    for (const m of s.members) {
      const newMax = (m.maxHp / prev.hp) * next.hp;
      if (m.alive) m.hp += newMax - m.maxHp;
      m.maxHp = newMax;
    }
    w.events.emit('levelUp', { squadId: s.id, squadName: s.name, level: next.name });
  }
}
