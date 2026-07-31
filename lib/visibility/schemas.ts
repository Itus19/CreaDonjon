import { z } from "zod";

/**
 * Entree de visibilite partagee par blocs et relations (SCHEMA.md §4.1) :
 * meme contrainte campaign/user <-> scopeId que les segments narratifs.
 */
export const zVisibilityInput = z
  .object({
    level: z.enum(["public", "players", "gm", "campaign", "user", "private"]),
    scopeId: z.string().nullable().default(null),
  })
  .refine(
    (v) => (v.level === "campaign" || v.level === "user" ? v.scopeId !== null : v.scopeId === null),
    { message: "campaign/user necessitent un scopeId ; les autres niveaux n'en veulent pas." }
  );
export type VisibilityInput = z.infer<typeof zVisibilityInput>;
