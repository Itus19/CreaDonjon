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
