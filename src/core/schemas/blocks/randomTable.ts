import { z } from "zod";
import { zBlockReference } from "./reference";
import { CURRENCY_ORDER } from "../../rules/currency";
import type { RandomTableData, TableEntry, TableEntryPrice, TableEntryRange } from "../../tables/types";

/**
 * Bloc `random_table` (layout: table, V1-E1, specs/outils-mj.md §2) — miroir
 * Zod exact des types purs de `src/core/tables/types.ts`, meme convention
 * que `zFormulaNode`/`FormulaNode`. `__v: 1` : comme tous les blocs de wiki
 * (contrairement aux blocs de regle, jamais versionnes de cette maniere).
 */

const zTableEntryRange: z.ZodType<TableEntryRange> = z.object({
  min: z.number().int(),
  max: z.number().int(),
});

const zTableEntryPrice: z.ZodType<TableEntryPrice> = z.object({
  amount: z.number().min(0),
  coin: z.enum(CURRENCY_ORDER),
});

const zTableEntry: z.ZodType<TableEntry> = z.object({
  range: zTableEntryRange,
  weight: z.number().positive(),
  text: z.string().min(1),
  price: zTableEntryPrice.optional(),
  refs: z.array(zBlockReference).optional(),
});

export const zRandomTableBlockData: z.ZodType<RandomTableData & { __v: 1 }> = z.object({
  __v: z.literal(1),
  key: z.string().min(1),
  die: z.string().regex(/^d\d+$/, "Notation de dé attendue, ex. \"d20\"."),
  entries: z.array(zTableEntry).min(1),
  unique_draws: z.boolean(),
  attribution: z.string().optional(),
});
export type RandomTableBlockData = z.infer<typeof zRandomTableBlockData>;
