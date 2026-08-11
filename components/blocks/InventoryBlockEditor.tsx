"use client";

import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import { useCharacterSheetContext } from "./useCharacterSheetContext";
import InventoryPanel from "./InventoryPanel";

/**
 * Bloc d'inventaire autonome (V1-C18, demande explicite : « un
 * copier-coller » de l'onglet Inventaire de la fiche jouable). Delegue
 * entierement a `InventoryPanel` — meme composant, pas une copie qui
 * pourrait diverger. Meme bloc `inventory` que l'onglet Inventaire de la
 * fiche jouable (meme `id`, meme etat React `EntityBlocks.blocks`) :
 * ajouter un objet ici le fait apparaitre la-bas, et inversement, sans
 * mecanisme de synchronisation dedie (specs/arbitrage-modifications.md,
 * `EntityBlocks.tsx`).
 *
 * `character` optionnel : fourni par `EntityBlocks` quand l'entite a aussi
 * un bloc `character` (cas le plus frequent — ce bloc autonome sert alors
 * a montrer l'inventaire seul, ex. fenetre separee, sans exposer toute la
 * fiche). Sans lui (boutique, coffre, PNJ sans stats), `useCharacterSheetContext`
 * degrade proprement : poids/valeur/tags/pliage restent identiques, seules
 * les lignes Attaquer/Degats et la barre de charge disparaissent (elles
 * exigeraient un FOR/DEX/maitrise qui n'existent pas ici).
 */
export default function InventoryBlockEditor({
  data,
  onChange,
  worldSlug,
  character,
}: {
  data: InventoryBlockData;
  onChange: (data: InventoryBlockData) => void;
  worldSlug: string;
  character?: CharacterBlockData;
}) {
  const { sheet, isMonk, weaponByKey, equipment, weight, cost } = useCharacterSheetContext(worldSlug, character, data, undefined);

  return (
    <InventoryPanel
      worldSlug={worldSlug}
      inventory={data}
      onUpdateInventory={onChange}
      strMod={sheet.abilities.str.mod}
      dexMod={sheet.abilities.dex.mod}
      proficiencyBonus={sheet.proficiencyBonus}
      isMonk={isMonk}
      showAttackInfo={character !== undefined}
      weaponByKey={weaponByKey}
      equipment={equipment}
      weight={weight}
      cost={cost}
      encumbrance={character ? sheet.encumbrance : undefined}
    />
  );
}
