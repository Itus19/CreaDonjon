"use client";

import type { FamilyTree } from "@/src/core/genealogy/buildFamilyTree";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import FamilyTreeCanvas from "@/components/entities/genealogy/FamilyTreeCanvas";

/**
 * Rendu public du bloc genealogie (V2-H3) : lecture seule, jamais de barre ni
 * de « + » — l'arbre est deja filtre par visibilite cote serveur
 * (getFamilyTree, viewer anonyme). Les dates ne s'ecrivent que si le calendrier
 * du monde est fourni ; le defunt reste gris sans lui.
 */
export default function PublicGenealogyBlock({
  tree,
  hrefBase,
  calendar,
}: {
  tree: FamilyTree;
  hrefBase: string;
  calendar?: CalendarConfigInput | null;
}) {
  return <FamilyTreeCanvas tree={tree} hrefBase={hrefBase} calendrier={calendar ?? null} />;
}
