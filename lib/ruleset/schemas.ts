import { z } from "zod";

export const setActiveRulesetSchema = z.object({
  rulesetId: z.string().uuid(),
});

export const createRulesetVariantSchema = z.object({
  name: z.string().min(1).max(120),
  parentRulesetId: z.string().uuid(),
});
