import { z } from "zod";
import type { GeneratorData, GeneratorSlot } from "../../generators/types";

/**
 * Bloc `generator` (layout: prose, V1-E2, specs/outils-mj.md §3) — miroir
 * Zod exact de `src/core/generators/types.ts`, meme convention que
 * `zRandomTableBlockData`. `__v: 1` : comme tous les blocs de wiki.
 */

const zGeneratorSlot: z.ZodType<GeneratorSlot> = z.object({
  key: z.string().min(1),
  table: z.string().min(1),
});

export const zGeneratorBlockData: z.ZodType<GeneratorData & { __v: 1 }> = z.object({
  __v: z.literal(1),
  slots: z.array(zGeneratorSlot).min(1),
  template: z.string().min(1),
});
export type GeneratorBlockData = z.infer<typeof zGeneratorBlockData>;
