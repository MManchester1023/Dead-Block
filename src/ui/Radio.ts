import type { World } from '../sim/World';

export interface RadioLine {
  speaker: string;
  text: string;
  tone: 'info' | 'warn' | 'good' | 'bad';
  t: number;
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** Gritty, dry radio chatter with occasional dark humour (doc §14). Cosmetic only, so Math.random is fine here. */
export class Radio {
  lines: RadioLine[] = [];
  private lastMemberLine = 0;

  constructor(private world: World, private onLine: (line: RadioLine) => void) {
    const ev = world.events;
    ev.on('radio', (e) => this.say(e.speaker, e.text, e.tone ?? 'info'));
    ev.on('memberKilled', (e) => {
      if (world.time - this.lastMemberLine < 3) return;
      this.lastMemberLine = world.time;
      this.say(e.squadName, pick(['Man down! Man down!', "We lost one. Keep firing!", 'They got Rodriguez!', "Medic! …right, we don't have medics yet."]), 'bad');
    });
    ev.on('squadWiped', (e) => this.say('Command', `${e.squadName} is gone. All hands. Their record goes with them.`, 'bad'));
    ev.on('hiveStage', (e) => this.say('Intel', `Hive activity rising — stage ${e.stage} of 4. It does not go back down.`, 'warn'));
    ev.on('hiveDestroyed', () => this.say('Command', "Hive's down. Good kill. Now finish clearing the district.", 'good'));
    ev.on('hordePulse', (e) => this.say('Overwatch', `Horde wave moving — about ${e.size} contacts heading for our lines.`, 'warn'));
    ev.on('noiseAlert', () => this.say('Overwatch', "You're making too much noise. Everything in the district just heard you.", 'warn'));
    ev.on('structureBuilt', (e) => {
      const lines: Record<string, string> = {
        sandbags: 'Sandbags up. Duck behind them, not on top of them.',
        wire: "Wire's strung. That'll slow 'em down.",
        mgNest: 'Gun nest is live. I brought enough ammo to be rude.',
        outpost: "Outpost established. Flag's up. Nobody touch the radio.",
      };
      this.say('Engineers', lines[e.defId] ?? 'Construction complete.', 'good');
    });
    ev.on('structureDestroyed', (e) => {
      if (e.defId !== 'baseWall') this.say('Engineers', `We lost a ${e.defId === 'mgNest' ? 'gun nest' : e.defId}.`, 'bad');
    });
    ev.on('districtSecured', (e) => this.say('Command', `${e.name} is SECURED. Income is flowing. Reclaim it block by block.`, 'good'));
    ev.on('districtLost', (e) => this.say('Command', `We lost ${e.name}. The outpost is a hive now.`, 'bad'));
    ev.on('unitProduced', (e) => this.say('Barracks', `${e.name} ready and moving to rally.`, 'info'));
    ev.on('levelUp', (e) => this.say(e.squadName, pick([`Promoted to ${e.level}. Drinks are on the dead.`, `${e.level} now. Still not paid enough.`]), 'good'));
    ev.on('newDay', (e) => this.say('Quartermaster', e.paid ? `Day ${e.day}. Upkeep paid: ${e.upkeep} supplies.` : `Day ${e.day}. We couldn't cover upkeep — squads on half rations.`, e.paid ? 'info' : 'bad'));
  }

  say(speaker: string, text: string, tone: RadioLine['tone'] = 'info'): void {
    const line = { speaker, text, tone, t: this.world.time };
    this.lines.push(line);
    if (this.lines.length > 40) this.lines.shift();
    this.onLine(line);
  }
}
