"use client";

import type { FamilyTree } from "@/src/core/genealogy/buildFamilyTree";
import FamilyTreeCanvas from "@/components/entities/genealogy/FamilyTreeCanvas";
import FamilyTreeCard from "@/components/entities/genealogy/FamilyTreeCard";

/**
 * Rendu public du bloc genealogie (V2-H3) : lecture seule, jamais de "+" —
 * l'arbre est deja filtre par visibilite cote serveur (getFamilyTree,
 * viewer anonyme). Survoler ou cliquer un trait revele son libelle
 * (FamilyTreeCanvas), aucune autre interaction.
 */
export default function PublicGenealogyBlock({ tree, hrefBase }: { tree: FamilyTree; hrefBase: string }) {
  return (
    <FamilyTreeCanvas
      tree={tree}
      renderCard={(node) => <FamilyTreeCard node={node} href={`${hrefBase}/${node.slug}`} />}
    />
  );
}
