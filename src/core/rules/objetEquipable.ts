/**
 * AG-19 (ADR 0107) — ce qu'un artéfact du sac fait à la fiche de qui le porte,
 * lu dans le bloc « Objet équipable » de sa fiche du wiki.
 *
 * Fonction pure : elle rend les champs d'un `EquippedItem`, que
 * `characterSheet()` sait déjà compter (modificateurs en couche 6, ressources
 * d'un objet, et désormais ses sorts accordés). « Seulement équipé » et
 * « harmonisation requise » se jugent ici et dans `characterSheet()`, qui
 * ignore tout objet harmonisable non lié.
 */
import type { EquippableBlockData } from "../schemas/blocks/equippable";
import type { RuleResource } from "../schemas/rule-blocks/playable";
import { resolveDeclaredModifiers, type EquippedItem, type FeatureSpell } from "./sheet";

export interface ObjetDuSac {
  id: string;
  label: string;
  equipped: boolean;
  attuned: boolean;
}

/** La clé du compteur de charges d'une action d'objet, propre à cet objet du sac. */
export function cleChargesObjet(itemId: string, actionId: string): string {
  return `item.${itemId}.${actionId}`;
}

export function effetsDeLObjet(item: ObjetDuSac, data: EquippableBlockData): EquippedItem {
  const source = `item:${item.id}`;
  const spells: FeatureSpell[] = data.spells.map((s) => ({
    key: s.key,
    atLevel: 0,
    ...(s.ability ? { ability: s.ability } : {}),
    alwaysPrepared: true,
    ...(s.free_cast ? { freeCast: s.free_cast } : {}),
  }));
  const resources: RuleResource[] = data.actions.map((a) => ({
    key: cleChargesObjet(item.id, a.id),
    label: { fr: a.name },
    max: { op: "num", value: a.charges },
    recharge: a.recharge,
  }));
  return {
    key: item.id,
    label: item.label,
    // « Seulement équipé » décoché : l'objet agit dès qu'il est sur soi.
    equipped: data.only_equipped ? item.equipped : true,
    modifiers: resolveDeclaredModifiers(data.modifiers, source, item.label, 6),
    ...(spells.length > 0 ? { spells } : {}),
    ...(resources.length > 0 ? { resources } : {}),
    requiresAttunement: data.requires_attunement,
    attuned: item.attuned,
  };
}
