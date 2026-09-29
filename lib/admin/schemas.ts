import { z } from "zod";

export const transferRulesetSchema = z.object({
  newOwnerId: z.string().uuid(),
});
