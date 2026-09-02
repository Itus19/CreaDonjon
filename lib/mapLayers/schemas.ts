import { z } from "zod";
import { zVisibilityInput } from "@/lib/visibility/schemas";

export const createMapLayerSchema = z.object({
  name: z.string().trim().max(100, "100 caracteres maximum.").default(""),
  visibility: zVisibilityInput,
});

export const updateMapLayerSchema = z.object({
  name: z.string().trim().max(100, "100 caracteres maximum.").optional(),
  displayOrder: z.number().optional(),
  visibility: zVisibilityInput.optional(),
});
