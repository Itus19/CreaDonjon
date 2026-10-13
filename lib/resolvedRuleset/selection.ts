import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import { itemRef } from "@/components/blocks/inventoryItem";

/**
 * Ce qu'une fiche demande a `/api/worlds/[worldSlug]/resolved-ruleset`.
 *
 * V3.1-62 (ADR 0056) : construit au MEME endroit pour la fiche (navigateur)
 * et pour la page qui lance son calcul avec elle (serveur). La cle
 * `selectionKey` doit etre identique des deux cotes, sinon la reponse partie
 * avec la page ne sert pas.
 */
export interface RulesetSelection {
  species?: string;
  background?: string;
  /** V3.1-117 : `subclass`, clé de la sous-classe choisie, pour résoudre ses aptitudes. */
  classes: { key: string; level: number; subclass?: string }[];
  equipmentKeys: string[];
  spellKeys: string[];
}

export function rulesetSelectionFromBlocks(
  character: CharacterBlockData | undefined,
  inventory: InventoryBlockData | undefined,
  spellcasting: SpellcastingBlockData | undefined
): RulesetSelection {
  return {
    species: character?.species?.kind === "rule" ? character.species.key : undefined,
    background: character?.background?.kind === "rule" ? character.background.key : undefined,
    classes: (character?.classes ?? [])
      .filter((c) => c.class.kind === "rule" && c.class.key)
      .map((c) => ({
        key: (c.class as { kind: "rule"; key: string }).key,
        level: c.level,
        ...(c.subclass?.kind === "rule" && c.subclass.key ? { subclass: c.subclass.key } : {}),
      })),
    equipmentKeys: (inventory?.items ?? [])
      .map(itemRef)
      .filter((r): r is { kind: "rule"; key: string } => r?.kind === "rule")
      .map((r) => r.key),
    spellKeys: (spellcasting?.known ?? [])
      .map((k) => k.ref)
      .filter((r): r is { kind: "rule"; key: string } => r.kind === "rule")
      .map((r) => r.key),
  };
}

/**
 * Une cle vide apparait des qu'un objet d'inventaire bascule en « reference
 * de regle » avant que l'utilisateur ait tape quoi que ce soit : la route la
 * rejetterait (`z.string().min(1)`). Filtree avant tout envoi.
 */
export function nonEmptyKeys(keys: readonly string[]): string[] {
  return keys.filter((k) => k.trim() !== "");
}

/** Le corps envoye a la route (et calcule par la page, ADR 0056). */
export function selectionBody(s: RulesetSelection): {
  species?: string;
  background?: string;
  classes: { key: string; level: number; subclass?: string }[];
  equipmentKeys: string[];
  spellKeys: string[];
} {
  return {
    species: s.species,
    background: s.background,
    classes: s.classes,
    equipmentKeys: nonEmptyKeys(s.equipmentKeys),
    spellKeys: nonEmptyKeys(s.spellKeys),
  };
}

/** Identite d'une selection : deux selections de meme cle donnent la meme reponse. */
export function selectionKey(s: RulesetSelection): string {
  return JSON.stringify([s.species, s.background, s.classes, [...nonEmptyKeys(s.equipmentKeys)].sort(), [...nonEmptyKeys(s.spellKeys)].sort()]);
}

/** La selection demande-t-elle quelque chose ? (L'equipement se resout meme sans personnage, V1-C18.) */
export function selectionHasAnything(s: RulesetSelection): boolean {
  return Boolean(s.species || s.background || s.classes.length > 0 || nonEmptyKeys(s.equipmentKeys).length > 0);
}
