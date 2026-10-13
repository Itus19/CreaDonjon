import type { ClassSpellcasting } from "./sheet";

/**
 * Emplacements de sort d'un personnage (V3.1-113, ADR 0045). Pure.
 *
 * - Une seule classe à emplacements : sa propre table, à son niveau.
 * - Plusieurs : leurs niveaux PONDÉRÉS (`casterWeight` : tous les niveaux,
 *   ou la moitié arrondie selon le ruleset — au supérieur en 2024, à
 *   l'inférieur en 2014) s'additionnent, et la table du multiclassé du
 *   ruleset (`character_rules.multiclass_spell_slots`) donne la ligne.
 * - La magie de pacte reste une réserve SÉPARÉE : un nombre d'emplacements
 *   d'un seul niveau, lu dans la table de la classe à son niveau.
 *
 * Une classe « à emplacements » est une classe qui en a à son niveau : un
 * paladin 1 de 2014 ne lance pas encore de sort et ne compte pas.
 */
export interface CastingClass {
  key: string;
  level: number;
  spellcasting?: ClassSpellcasting;
}

export interface SpellSlotsResult {
  /** Niveau d'emplacement → nombre. */
  slots: Record<number, number>;
  /** Réserve de pacte : `count` emplacements de niveau `slotLevel`. */
  pact?: { count: number; slotLevel: number };
  /** Plusieurs classes à emplacements, mais le ruleset n'a pas la table du multiclassé : aucun emplacement n'est inventé. */
  missingMulticlassTable?: true;
}

function weightedLevel(level: number, weight: ClassSpellcasting["casterWeight"]): number {
  if (!weight) return 0;
  if (weight.fraction === "full") return level;
  return weight.rounding === "up" ? Math.ceil(level / 2) : Math.floor(level / 2);
}

export function computeSpellSlots(classes: readonly CastingClass[], multiclassTable: Readonly<Record<string, readonly number[]>> | undefined): SpellSlotsResult {
  const result: SpellSlotsResult = { slots: {} };

  const pactClass = classes.find((c) => c.spellcasting?.kind === "pact" && c.spellcasting.slotsByLevel[c.level]);
  if (pactClass) {
    const row = pactClass.spellcasting!.slotsByLevel[pactClass.level];
    const [slotLevel, count] = Object.entries(row).map(([l, n]) => [Number(l), n] as const).find(([, n]) => n > 0) ?? [];
    if (slotLevel !== undefined && count !== undefined) result.pact = { count, slotLevel };
  }

  const slotClasses = classes.filter((c) => c.spellcasting && c.spellcasting.kind !== "pact" && c.spellcasting.slotsByLevel[c.level]);
  if (slotClasses.length === 1) {
    const only = slotClasses[0];
    result.slots = { ...only.spellcasting!.slotsByLevel[only.level] };
  } else if (slotClasses.length > 1) {
    if (!multiclassTable) {
      result.missingMulticlassTable = true;
      return result;
    }
    const casterLevel = slotClasses.reduce((sum, c) => sum + weightedLevel(c.level, c.spellcasting!.casterWeight), 0);
    const row = multiclassTable[String(Math.min(casterLevel, 20))] ?? [];
    row.forEach((count, index) => {
      if (count > 0) result.slots[index + 1] = count;
    });
  }
  return result;
}
