"use client";

import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import type { WeaponData, ArmorData, ItemCost } from "@/src/core/rules/srdMapping";
import type { EncumbranceResult } from "@/src/core/rules/encumbrance";
import InventoryPanel from "./InventoryPanel";

/**
 * Onglet Inventaire de la fiche jouable (V1-B5, extrait de
 * `PlayableCharacterSheet.tsx` par V2-G5 — pur découpage, aucun changement de
 * comportement) : corps entier partagé avec le bloc d'inventaire autonome
 * (V1-C18, `InventoryPanel.tsx`).
 */
export default function InventoryTab({
  worldSlug,
  inventory,
  onUpdateInventory,
  strMod,
  dexMod,
  proficiencyBonus,
  isMonk,
  weaponByKey,
  equipment,
  weight,
  cost,
  encumbrance,
  server,
}: {
  worldSlug: string;
  inventory: InventoryBlockData | undefined;
  onUpdateInventory: (data: InventoryBlockData) => void;
  strMod: number;
  dexMod: number;
  proficiencyBonus: number;
  isMonk: boolean;
  weaponByKey: Record<string, WeaponData | null>;
  equipment: Record<string, ArmorData | null>;
  weight: Record<string, number | null>;
  cost: Record<string, ItemCost | null>;
  encumbrance: EncumbranceResult;
  /** V3.1-24 : monnaie et equipement par les services serveur (voir `InventoryPanel`). */
  server?: { entityId: string; campaignId: string | null; onBlockRefreshed: (fresh: { id: string; data: unknown; version: number }) => void };
}) {
  return (
    <div className="pt-3">
      <InventoryPanel
        worldSlug={worldSlug}
        inventory={inventory}
        onUpdateInventory={onUpdateInventory}
        strMod={strMod}
        dexMod={dexMod}
        proficiencyBonus={proficiencyBonus}
        isMonk={isMonk}
        showAttackInfo={true}
        weaponByKey={weaponByKey}
        equipment={equipment}
        weight={weight}
        cost={cost}
        encumbrance={encumbrance}
        server={server}
      />
    </div>
  );
}
