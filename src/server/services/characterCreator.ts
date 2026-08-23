import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import { defaultBlockDisplay } from "@/src/core/schemas/blocks/registry";
import { createEntity } from "@/src/server/services/entities";
import { insertBlock } from "@/src/server/repos/blocks";
import type { EntitySummary } from "@/src/server/repos/entities";

type TypedClient = SupabaseClient<Database>;

/**
 * Cree l'entite et les blocs issus de l'assistant de creation de personnage
 * (specs/wiki-liens-et-personnages.md §B8, ecran MJ V2-G1). Meme visibilite
 * par defaut que "+ Personnage" dans `EntityBlocks.tsx` (public, aucune
 * portee) — l'assistant ne fait que preremplir un bloc que le MJ pourra
 * rouvrir et retoucher comme n'importe quel autre.
 *
 * `character`/`inventory` sont deja valides par
 * `createCharacterFromWizardSchema` (Zod, cote appelant) — pas de deuxieme
 * validation ici, `insertBlock` accepte du JSON brut par construction (meme
 * contrat que `createBlock`, qui lui utilise `defaultBlockData()`).
 */
export async function createCharacterFromWizard(
  supabase: TypedClient,
  params: {
    worldId: string;
    createdBy: string;
    name: string;
    character: CharacterBlockData;
    inventory: InventoryBlockData | undefined;
  }
): Promise<EntitySummary> {
  const entity = await createEntity(supabase, {
    worldId: params.worldId,
    createdBy: params.createdBy,
    name: params.name,
    entityKind: "character",
    aliases: [],
  });

  await insertBlock(supabase, {
    entityId: entity.id,
    blockType: "character",
    display: defaultBlockDisplay("character", "Personnage"),
    data: params.character as Json,
    displayOrder: 1000,
    visibilityLevel: "public",
    visibilityScopeId: null,
    createdBy: params.createdBy,
  });

  if (params.inventory && params.inventory.items.length > 0) {
    await insertBlock(supabase, {
      entityId: entity.id,
      blockType: "inventory",
      display: defaultBlockDisplay("inventory", "Inventaire"),
      data: params.inventory as Json,
      displayOrder: 2000,
      visibilityLevel: "public",
      visibilityScopeId: null,
      createdBy: params.createdBy,
    });
  }

  return entity;
}
