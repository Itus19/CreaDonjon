/**
 * Interface d'un generateur de nombres pseudo-aleatoires, injectee partout
 * ou un jet est necessaire. Jamais de Math.random() en dur dans le moteur :
 * c'est ce qui rend les tests deterministes et le rejeu possible (SCHEMA.md §20.3).
 */
export interface Rng {
  /** Retourne un entier dans [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

/**
 * RNG a graine deterministe (mulberry32). Pas d'usage cryptographique :
 * seulement la reproductibilite d'un jet de des a partir d'une graine.
 */
export class SeededRng implements Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError("maxExclusive doit etre un entier strictement positif");
    }
    return Math.floor(this.nextFloat() * maxExclusive);
  }

  private nextFloat(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
