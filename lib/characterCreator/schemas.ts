import { z } from "zod";
import { zCharacterBlockData } from "@/src/core/schemas/blocks/character";
import { zInventoryBlockData } from "@/src/core/schemas/blocks/inventory";

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
});
