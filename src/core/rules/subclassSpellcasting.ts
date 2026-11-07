import type { SubclassSpellcastingBlockData } from "../schemas/rule-blocks/blocks";
import type { ClassSpellcasting } from "./sheet";

/**
 * V3.1-185 — l'incantation qu'une sous-classe donne à sa classe (Arnaqueur
 * arcanique, Chevalier occulte). Pure. La table du bloc ne liste que les
 * niveaux qui changent : on la déroule jusqu'au niveau 20, la dernière ligne
 * atteinte valant, pour que `computeSpellSlots` lise la classe comme une autre.
 */
export function subclassSpellcasting(data: SubclassSpellcastingBlockData): ClassSpellcasting {
  const lignes = [...data.slots].sort((a, b) => a.level - b.level);
  const slotsByLevel: Record<number, Record<number, number>> = {};
  let courante: Record<number, number> | undefined;
  for (let niveau = 1; niveau <= 20; niveau++) {
    const ligne = lignes.find((l) => l.level === niveau);
    if (ligne) {
      courante = {};
      ligne.counts.forEach((n, i) => {
        if (n > 0) courante![i + 1] = n;
      });
    }
    if (courante && Object.keys(courante).length > 0) slotsByLevel[niveau] = { ...courante };
  }
  return { ability: data.ability, kind: "slots", casterWeight: data.caster_weight, slotsByLevel };
}

/** Une classe qui lance déjà des sorts garde les siens ; sinon, la sous-classe choisie lui prête les siens. */
export function classSpellcastingWithSubclass(
  ofClass: ClassSpellcasting | undefined,
  ofSubclass: ClassSpellcasting | undefined
): ClassSpellcasting | undefined {
  return ofClass ?? ofSubclass;
}
