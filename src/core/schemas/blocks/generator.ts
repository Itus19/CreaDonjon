import { z } from "zod";
import type { GeneratorData, GeneratorProseSlot, GeneratorSlot, GeneratorTableSlot } from "../../generators/types";

/**
 * Bloc `generator` (layout: prose, V1-E2/V2-J1, specs/outils-mj.md §3) —
 * miroir Zod exact de `src/core/generators/types.ts`, meme convention que
 * `zRandomTableBlockData`. `__v: 1` : comme tous les blocs de wiki.
 */

const zGeneratorTableSlot: z.ZodType<GeneratorTableSlot> = z.object({
  key: z.string().min(1),
  table: z.string().min(1),
  /** V2-J9 — meme borne que `drawTableSchema` (src/core/tables, tirage direct sur un bloc random_table). */
  count: z.number().int().min(1).max(20).optional(),
});

const zGeneratorProseSlot: z.ZodType<GeneratorProseSlot> = z.object({
  key: z.string().min(1),
  prose: z.string().min(1),
});

const zGeneratorSlot: z.ZodType<GeneratorSlot> = z.union([zGeneratorTableSlot, zGeneratorProseSlot]);

export const zGeneratorBlockData: z.ZodType<GeneratorData & { __v: 1 }> = z.object({
  __v: z.literal(1),
  key: z.string().min(1).optional(),
  slots: z.array(zGeneratorSlot).min(1),
  template: z.string().min(1),
});
export type GeneratorBlockData = z.infer<typeof zGeneratorBlockData>;
