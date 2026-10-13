import { SKILLS, type Ability } from "@/src/core/rules/sheet";
import { SKILL_LABELS_FR } from "@/src/i18n/fr";

/**
 * Constantes d'affichage de la fiche jouable, sans composant (V3.1-120).
 * Elles vivaient dans `PlayableCharacterSheet.tsx` ; l'assistant de montée
 * de niveau les importait de là, et la fiche importait l'assistant : un
 * cycle. Ici, la fiche et ses étapes les lisent sans se tirer l'une l'autre.
 */

/** Abréviations de la fiche. Distinct de `ABILITY_LABELS` du noyau (`src/core/rules/sheet.ts`), qui donne les noms complets (« Force »). */
export const ABILITY_LABELS: Record<Ability, string> = {
  str: "FOR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "SAG",
  cha: "CHA",
};

/** Compétences triées par libellé FR (V1-C4 suite) — même ordre que la référence visuelle fournie par l'utilisateur. Partagée par la fiche et l'assistant de création (V2-G1) — même esthétique, jamais un deuxième tri recalculé. */
export const SORTED_SKILLS = [...SKILLS].sort((a, b) => SKILL_LABELS_FR[a].localeCompare(SKILL_LABELS_FR[b]));
