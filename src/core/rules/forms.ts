import type { Ability } from "./abilities";

/**
 * V3.1-182 (ADR 0078) — le profil d'une créature sous une forme, en fonction
 * PURE. Deux modes (règles 2024) :
 * - `overlay` (Forme sauvage) : la bête donne sa CA, sa vitesse, sa FOR, sa
 *   DEX et sa CON ; la créature garde INT, SAG, CHA, ses PV et ses aptitudes.
 * - `replace` (Métamorphose) : la bête donne ses six caractéristiques.
 * Dans les deux cas, les PV de la créature restent les siens : la forme passe
 * par des PV temporaires (effet `temp_hp`, ADR 0095), et le service met fin à
 * une forme `replace` quand ils sont épuisés.
 */

export type FormMode = "overlay" | "replace";

export interface BaseStats {
  ac: number;
  /** Mètres. */
  speed: number;
  abilities: Record<Ability, number>;
}

const PHYSIQUES: readonly Ability[] = ["str", "dex", "con"];

export function formStats(base: BaseStats, beast: BaseStats, mode: FormMode): BaseStats {
  const abilities = { ...base.abilities };
  for (const a of Object.keys(beast.abilities) as Ability[]) {
    if (mode === "replace" || PHYSIQUES.includes(a)) abilities[a] = beast.abilities[a];
  }
  return { ac: beast.ac, speed: beast.speed, abilities };
}
