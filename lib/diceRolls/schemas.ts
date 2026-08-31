import { z } from "zod";
import { DIE_TYPES, type DieType } from "@/src/core/dice/roll";

/** Jet libre depuis la reserve du volet (V2-M11) — au moins un des` DIE_TYPES` a une quantite positive, jamais un pool vide. */
const poolField = z
  .object(Object.fromEntries(DIE_TYPES.map((type) => [type, z.number().int().min(0).max(20).optional()])) as Record<DieType, z.ZodOptional<z.ZodNumber>>)
  .partial()
  .refine((pool) => Object.values(pool).some((count) => (count ?? 0) > 0), { message: "Choisissez au moins un de." });

export const freeformRollSchema = z.object({
  pool: poolField,
  hidden: z.boolean(),
});
