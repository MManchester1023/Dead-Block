/** Small seeded PRNG (mulberry32) so the simulation is reproducible for tests and replays. */
export class Rng {
  private s: number;
  constructor(seed = 1337) {
    this.s = seed >>> 0;
  }
  /** The generator's whole state, for save/load (STATUS #16). */
  get state(): number {
    return this.s;
  }
  set state(v: number) {
    this.s = v >>> 0;
  }
  next(): number {
    // kept to 32 bits (same numbers: everything below only reads it mod 2^32); unwrapped, it grew
    // without bound, lost precision after a few million calls, and couldn't be saved exactly
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }
  int(lo: number, hiInclusive: number): number {
    return Math.floor(this.range(lo, hiInclusive + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}
