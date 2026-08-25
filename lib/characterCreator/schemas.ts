import { z } from "zod";
import { zCharacterBlockData } from "@/src/core/schemas/blocks/character";
import { zInventoryBlockData } from "@/src/core/schemas/blocks/inventory";
import { zSpellcastingBlockData } from "@/src/core/schemas/blocks/spellcasting";

/**
 * Sortie de l'assistant de creation de personnage (specs/wiki-liens-et-
 * personnages.md §B8) — appelee depuis une server action (`actions.ts`), pas
 * une route API, donc validee ici plutot que par `createBlockSchema` /
 * `createBlankEntitySchema` qui couvrent chacun un seul appel plus simple.
 */
export const createCharacterFromWizardSchema = z.object({
  worldId: z.guid(),
  name: z.string().trim().min(1, "Le nom est requis.").max(200, "200 caracteres maximum."),
  character: zCharacterBlockData,
  inventory: zInventoryBlockData.optional(),
  spellcasting: zSpellcastingBlockData.optional(),
});

/**
 * Meme sortie d'assistant, mais pour ECRASER une entite EXISTANTE plutot que
 * d'en creer une (retour utilisateur : "Assistant de creation" lance depuis
 * une fiche) — `entityId`/`expectedVersion` remplacent `worldId`, memes
 * verrous de concurrence optimiste que `EditEntityForm.tsx`/`EntityBlocks.tsx`.
 */
export const overwriteCharacterFromWizardSchema = z.object({
  entityId: z.guid(),
  expectedVersion: z.number().int().nonnegative(),
  name: z.string().trim().min(1, "Le nom est requis.").max(200, "200 caracteres maximum."),
  character: zCharacterBlockData,
  inventory: zInventoryBlockData.optional(),
  spellcasting: zSpellcastingBlockData.optional(),
});
