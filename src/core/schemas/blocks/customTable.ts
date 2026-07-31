import { z } from "zod";

/** Bloc `custom_table` (layout: table, specs/wiki-blocs.md §1) : l'echappatoire, des le premier jour. */
export const zCustomTableBlockData = z.object({
  __v: z.literal(1),
  columns: z.array(z.string().min(1)),
  rows: z.array(z.record(z.string(), z.unknown())),
});
export type CustomTableBlockData = z.infer<typeof zCustomTableBlockData>;
