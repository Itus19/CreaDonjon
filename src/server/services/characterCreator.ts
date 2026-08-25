import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { CharacterBlockData } from "@/src/core/schemas/blocks/character";
import type { InventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import type { SpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";
import { defaultBlockDisplay, type BlockType } from "@/src/core/schemas/blocks/registry";
import { createEntity, updateEntity, type UpdateEntityResult } from "@/src/server/services/entities";
import { getEntityById } from "@/src/server/repos/entities";
import { insertBlock, listBlocksForEntity, updateBlockWithVersionCheck, type BlockRow } from "@/src/server/repos/blocks";
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
    spellcasting: SpellcastingBlockData | undefined;
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

  if (params.spellcasting && params.spellcasting.known.length > 0) {
    await insertBlock(supabase, {
      entityId: entity.id,
      blockType: "spellcasting",
      display: defaultBlockDisplay("spellcasting", "Incantation"),
      data: params.spellcasting as Json,
      displayOrder: 3000,
      visibilityLevel: "public",
      visibilityScopeId: null,
      createdBy: params.createdBy,
    });
  }

  return entity;
}

/**
 * Met a jour le bloc `data` d'un type donne s'il existe deja (ecrase en
 * place, meme si la nouvelle donnee est "vide" — `overwriteCharacterFromWizard`
 * ci-dessous doit vraiment ECRASER, pas fusionner), sinon en cree un
 * seulement si `data` n'est pas vide (`shouldCreateIfMissing`) — memes
 * regles que `createCharacterFromWizard` : ne jamais poser un bloc
 * inventaire/incantation vide qu'un "+ Personnage" tout seul n'aurait pas.
 */
async function upsertWizardBlock(
  supabase: TypedClient,
  params: {
    entityId: string;
    existingBlocks: BlockRow[];
    blockType: BlockType;
    label: string;
    displayOrder: number;
    data: unknown;
    shouldCreateIfMissing: boolean;
    createdBy: string;
  }
): Promise<void> {
  const found = params.existingBlocks.find((b) => b.block_type === params.blockType);
  if (found) {
    await updateBlockWithVersionCheck(supabase, {
      id: found.id,
      expectedVersion: found.version,
      display: found.display,
      data: params.data as Json,
      visibilityLevel: found.visibility_level,
      visibilityScopeId: found.visibility_scope_id,
    });
    return;
  }
  if (!params.shouldCreateIfMissing) return;
  await insertBlock(supabase, {
    entityId: params.entityId,
    blockType: params.blockType,
    display: defaultBlockDisplay(params.blockType, params.label),
    data: params.data as Json,
    displayOrder: params.displayOrder,
    visibilityLevel: "public",
    visibilityScopeId: null,
    createdBy: params.createdBy,
  });
}

/**
 * Ecrase une entite EXISTANTE avec le resultat de l'assistant (retour
 * utilisateur : "Assistant de creation" lance depuis une fiche) — jamais de
 * nouvelle entite, jamais de changement de slug (independant du nom,
 * specs verifiees dans `src/server/repos/entities.ts`). Renomme l'entite au
 * nom du personnage et force `entity_kind: "character"` (l'assistant ne
 * produit jamais qu'un personnage), memes types/`entity_kind`/`aliases`
 * actuels preserves sauf le nom — sinon ecrase les blocs
 * `character`/`inventory`/`spellcasting` en place.
 */
export async function overwriteCharacterFromWizard(
  supabase: TypedClient,
  params: {
    entityId: string;
    expectedVersion: number;
    changedBy: string;
    name: string;
    character: CharacterBlockData;
    inventory: InventoryBlockData | undefined;
    spellcasting: SpellcastingBlockData | undefined;
  }
): Promise<UpdateEntityResult> {
  const current = await getEntityById(supabase, params.entityId);
  if (!current) return { ok: false, reason: "not_found" };

  const renamed = await updateEntity(supabase, {
    id: params.entityId,
    changedBy: params.changedBy,
    expectedVersion: params.expectedVersion,
    name: params.name,
    entityKind: "character",
    aliases: current.aliases,
  });
  if (!renamed.ok) return renamed;

  const existingBlocks = await listBlocksForEntity(supabase, params.entityId);

  await upsertWizardBlock(supabase, {
    entityId: params.entityId,
    existingBlocks,
    blockType: "character",
    label: "Personnage",
    displayOrder: 1000,
    data: params.character,
    shouldCreateIfMissing: true,
    createdBy: params.changedBy,
  });

  await upsertWizardBlock(supabase, {
    entityId: params.entityId,
    existingBlocks,
    blockType: "inventory",
    label: "Inventaire",
    displayOrder: 2000,
    data: params.inventory ?? { __v: 1, items: [], containers: [], currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 } },
    shouldCreateIfMissing: Boolean(params.inventory && params.inventory.items.length > 0),
    createdBy: params.changedBy,
  });

  await upsertWizardBlock(supabase, {
    entityId: params.entityId,
    existingBlocks,
    blockType: "spellcasting",
    label: "Incantation",
    displayOrder: 3000,
    data: params.spellcasting ?? { __v: 1, sources: [], known: [], prepared: [], slot_override: null },
    shouldCreateIfMissing: Boolean(params.spellcasting && params.spellcasting.known.length > 0),
    createdBy: params.changedBy,
  });

  return renamed;
}
