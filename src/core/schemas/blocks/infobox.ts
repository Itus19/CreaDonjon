import { z } from "zod";

/** Bloc `infobox` (layout: key_values, specs/wiki-blocs.md §1) : l'encadre classique. */
export const zInfoboxEntry = z.object({
  label: z.string().min(1),
  value: z.string(),
});
export type InfoboxEntry = z.infer<typeof zInfoboxEntry>;

export const zInfoboxBlockData = z.object({
  __v: z.literal(1),
  entries: z.array(zInfoboxEntry),
});
export type InfoboxBlockData = z.infer<typeof zInfoboxBlockData>;
