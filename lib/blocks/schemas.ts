import { z } from "zod";
import { BLOCK_TYPES } from "@/src/core/schemas/blocks/registry";
import { zBlockDisplay } from "@/src/core/schemas/blocks/envelope";
import { zVisibilityInput } from "@/lib/visibility/schemas";

export const createBlockSchema = z.object({
  entityId: z.guid(),
  blockType: z.enum(BLOCK_TYPES),
  label: z.string().trim().min(1, "Le titre est requis.").max(100, "100 caracteres maximum."),
  visibility: zVisibilityInput,
});

export const updateBlockSchema = z.object({
  version: z.number().int().positive(),
  display: zBlockDisplay,
  data: z.unknown(),
  visibility: zVisibilityInput,
});

export const reorderBlockSchema = z.object({
  version: z.number().int().positive(),
  displayOrder: z.number(),
});

/** Tirage sur un bloc random_table (V1-E1) — un seul champ optionnel, jamais plus que le nombre d'entrees distinctes d'une table (verifie cote pur, src/core/tables/roll.ts). */
export const drawTableSchema = z.object({
  count: z.number().int().min(1).max(20).default(1),
});

/** Assistance redactionnelle (V1-F3) — instruction libre envoyee au modele, jamais un identifiant : le bloc cible vient de la route, pas du corps. */
export const writingAssistSchema = z.object({
  instruction: z.string().trim().min(1).max(500),
});

/** Bascule d'un objectif de quete (V2-H4) — jamais la donnee entiere du bloc : un seul objectif, par id, pour rester journalisable sans ambiguite sur ce qui a change. */
export const toggleQuestObjectiveSchema = z.object({
  version: z.number().int().positive(),
  objectiveId: z.string().min(1),
  done: z.boolean(),
});
