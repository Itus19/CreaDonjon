import { z } from "zod";

export const resolveRulesetSchema = z.object({
  species: z.string().min(1).optional(),
  background: z.string().min(1).optional(),
  classes: z.array(z.object({ key: z.string().min(1), level: z.number().int().positive() })).max(20),
  equipmentKeys: z.array(z.string().min(1)).max(50).optional(),
});
