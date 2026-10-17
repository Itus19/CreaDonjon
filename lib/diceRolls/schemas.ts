import { z } from "zod";
import { DIE_TYPES, type DieType } from "@/src/core/dice/roll";

/** Jet libre depuis la reserve du volet (V2-M11) — au moins un des` DIE_TYPES` a une quantite positive, jamais un pool vide. */
const poolField = z
  .object(Object.fromEntries(DIE_TYPES.map((type) => [type, z.number().int().min(0).max(20).optional()])) as Record<DieType, z.ZodOptional<z.ZodNumber>>)
  .partial()
  .refine((pool) => Object.values(pool).some((count) => (count ?? 0) > 0), { message: "Choisissez au moins un dé." });

/**
 * V3.1-33 : l'outil de des unique. Le client decrit le jet, jamais son
 * resultat (regle 8). Avantage / desavantage : un seul d20 dans la reserve
 * (sinon on ne sait pas lequel doubler). `dcPrivate` n'est honore que pour
 * le MJ (checkRolls.ts).
 */
export const freeformRollSchema = z
  .object({
    pool: poolField,
    hidden: z.boolean(),
    modifier: z.number().int().min(-99).max(99).default(0),
    advantage: z.enum(["normal", "advantage", "disadvantage"]).default("normal"),
    label: z.string().trim().max(80).nullable().default(null),
    dc: z.number().int().min(1).max(50).nullable().default(null),
    dcPrivate: z.boolean().default(false),
  })
  .strict()
  .refine((roll) => roll.advantage === "normal" || roll.pool.d20 === 1, {
    message: "L'avantage demande un seul d20.",
    path: ["advantage"],
  });
