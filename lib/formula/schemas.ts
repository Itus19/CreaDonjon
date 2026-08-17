import { z } from "zod";

export const evaluateFormulaSchema = z.object({
  formula: z.string().min(1).max(500),
  context: z.record(z.string(), z.number()).default({}),
  mode: z.enum(["roll", "average", "min", "max"]).default("roll"),
});
