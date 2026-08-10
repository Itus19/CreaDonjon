import { SKILLS, SKILL_ABILITIES, type Ability, type Modifier } from "./sheet";
import type { InventoryItem } from "../schemas/blocks/inventory";

/**
 * Variante d'encombrement du SRD (texte verifie dans data/srd/srd-2014.json,
 * Rule-Sections "using-each-ability" — "Variant: Encumbrance"). Le SRD 2024
 * importe ne porte pas la section de regle equivalente en texte libre ;
 * reutilisee telle quelle pour les deux editions, decision utilisateur (la
 * mecanique de capacite de charge n'a pas change entre les deux).
 *
 * Capacite de charge = FOR x 15. Au-dela de FOR x 5 (strictement, "en exces
 * de") : encombre, vitesse -10. Au-dela de FOR x 10 : lourdement encombre,
 * vitesse -20 et desavantage aux jets de FOR/DEX/CON (verifications,
 * attaques, sauvegardes).
 */
export type EncumbranceTier = "none" | "encumbered" | "heavily_encumbered";

export interface EncumbranceResult {
  carried: number;
  capacity: number;
  tier: EncumbranceTier;
  speedPenalty: number;
  disadvantageAbilities: readonly Ability[];
}

const CAPACITY_MULTIPLIER = 15;
const ENCUMBERED_MULTIPLIER = 5;
const HEAVILY_ENCUMBERED_MULTIPLIER = 10;

export function computeEncumbrance(strScore: number, carried: number): EncumbranceResult {
  const capacity = strScore * CAPACITY_MULTIPLIER;
  const heavyThreshold = strScore * HEAVILY_ENCUMBERED_MULTIPLIER;
  const encumberedThreshold = strScore * ENCUMBERED_MULTIPLIER;

  if (carried > heavyThreshold) {
    return { carried, capacity, tier: "heavily_encumbered", speedPenalty: 20, disadvantageAbilities: ["str", "dex", "con"] };
  }
  if (carried > encumberedThreshold) {
    return { carried, capacity, tier: "encumbered", speedPenalty: 10, disadvantageAbilities: [] };
  }
  return { carried, capacity, tier: "none", speedPenalty: 0, disadvantageAbilities: [] };
}

/**
 * Traduit un `EncumbranceResult` en modificateurs (couche 6, meme couche que
 * l'armure — l'encombrement est une consequence de l'equipement porte) :
 * penalite de vitesse, et desavantage sur les sauvegardes et competences
 * gouvernees par une caracteristique en `disadvantageAbilities`.
 */
export function encumbranceModifiers(result: EncumbranceResult, source: string, label: string): Modifier[] {
  const modifiers: Modifier[] = [];
  if (result.speedPenalty > 0) {
    modifiers.push({ target: "speed", op: "add", value: -result.speedPenalty, layer: 6, source, label });
  }
  for (const ability of result.disadvantageAbilities) {
    modifiers.push({ target: `save.${ability}`, op: "disadvantage", layer: 6, source, label });
  }
  for (const skill of SKILLS) {
    if (result.disadvantageAbilities.includes(SKILL_ABILITIES[skill])) {
      modifiers.push({ target: `skill.${skill}`, op: "disadvantage", layer: 6, source, label });
    }
  }
  return modifiers;
}

/**
 * Poids total porte : pour un objet de reference de regle, le poids vient
 * de `weightByKey` (resolu cote serveur/client depuis la fiche de regle,
 * `parseItemWeight`) ; pour un objet en ligne, son propre champ `weight`.
 * 0 si non resolu ou non renseigne — jamais une erreur, jamais une
 * estimation devinee.
 */
export function totalCarriedWeight(items: readonly InventoryItem[], weightByKey: Record<string, number | null>): number {
  let total = 0;
  for (const item of items) {
    const ref = (item as { ref?: { kind: "rule"; key: string } }).ref;
    const unitWeight = ref ? (weightByKey[ref.key] ?? 0) : ((item as { weight?: { value: number } }).weight?.value ?? 0);
    total += unitWeight * item.qty;
  }
  return total;
}
