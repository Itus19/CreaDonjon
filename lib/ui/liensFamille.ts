/**
 * V3.1-73 — les neuf liens que la barre du Généalogie propose, et la relation
 * qu'ils créent. Même route qu'avant (`POST /api/entities/{source}/relations`) :
 * seul le choix de la source et de la cible se décide ici, testé sans réseau.
 */

import type { FamilyRelationType } from "@/src/core/genealogy/buildFamilyTree";

export interface LienFamille {
  /** Clé du libellé (`fiche.genealogie.liens.<cle>`). */
  cle: string;
  relationType: FamilyRelationType;
  /** Le rôle de la fiche touchée dans la relation : « Parent » la place en cible (l'autre fiche est son parent), « Enfant » en source. */
  roleAncre: "source" | "target";
}

export const LIENS_FAMILLE: readonly LienFamille[] = [
  { cle: "parent", relationType: "parent_of", roleAncre: "target" },
  { cle: "enfant", relationType: "parent_of", roleAncre: "source" },
  { cle: "partenaire", relationType: "partner_of", roleAncre: "source" },
  { cle: "exPartenaire", relationType: "ex_partner_of", roleAncre: "source" },
  { cle: "fratrie", relationType: "sibling_of", roleAncre: "source" },
  { cle: "demiFratrie", relationType: "half_sibling_of", roleAncre: "source" },
  { cle: "beauParent", relationType: "step_parent_of", roleAncre: "target" },
  { cle: "beauEnfant", relationType: "step_parent_of", roleAncre: "source" },
  { cle: "adopte", relationType: "adopted_by", roleAncre: "source" },
];

export function lienFamille(cle: string): LienFamille | undefined {
  return LIENS_FAMILLE.find((l) => l.cle === cle);
}

export interface RelationACreer {
  sourceEntityId: string;
  targetEntityId: string;
  relationType: FamilyRelationType;
}

/** La relation à poster pour lier `ancreId` (la fiche touchée) à `autreId` selon le lien choisi. */
export function relationPourLien(ancreId: string, autreId: string, lien: LienFamille): RelationACreer {
  const [sourceEntityId, targetEntityId] = lien.roleAncre === "source" ? [ancreId, autreId] : [autreId, ancreId];
  return { sourceEntityId, targetEntityId, relationType: lien.relationType };
}

/**
 * Les relations à poster pour ajouter un ENFANT à un couple (case « + enfant ») :
 * un lien « Enfant » pour chacun des deux parents.
 */
export function relationsPourEnfantDeCouple(parentA: string, parentB: string, enfantId: string): RelationACreer[] {
  const enfant = lienFamille("enfant");
  if (!enfant) return [];
  return [relationPourLien(parentA, enfantId, enfant), relationPourLien(parentB, enfantId, enfant)];
}
