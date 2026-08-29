import { z } from "zod";
import { zBlockReference } from "./reference";
import { zGameDate } from "@/src/core/schemas/calendar";

/**
 * Bloc `timeline` (V2-H2, specs/wiki-blocs.md §3) : entrées en ligne d'une
 * chronologie — vie d'un personnage, histoire d'un monde, n'importe quelle
 * entité peut en porter un ou plusieurs (specs/wiki-blocs.md §7, réponse
 * "Oui" pour `timeline`).
 *
 * Simplification actée avec le client par rapport au JSON d'exemple de la
 * spec : pas de requête `scope.query` (tags/entité liée) qui aurait pioché
 * automatiquement des entités `event` sans date propre. Chaque entrée porte
 * TOUJOURS sa date complète, que `ref` pointe vers une entité promue ou non
 * — `ref` ne sert qu'a la navigation, jamais de source de date. Ce choix
 * rend la vue générale du monde (agrégation de toutes les entrées visibles
 * de tous les blocs `timeline`, `src/server/services/timeline.ts`) triviale
 * : elle n'a besoin d'interroger aucune entité, seulement de lire les blocs.
 */

/** Genres d'entree, pour l'iconographie et le filtrage (specs/wiki-blocs.md §3). */
export const TIMELINE_ENTRY_KINDS = [
  "birth",
  "death",
  "war",
  "battle",
  "founding",
  "discovery",
  "meeting",
  "oath",
  "betrayal",
  "trauma",
  "disaster",
  "custom",
] as const;
export type TimelineEntryKind = (typeof TIMELINE_ENTRY_KINDS)[number];

/** Meme forme que `zSegmentVisibility`/`zAspirationVisibility` — dupliquee plutot qu'importee (CLAUDE.md regle 14). */
const zTimelineEntryVisibility = z
  .object({
    level: z.enum(["public", "players", "gm", "campaign", "user", "private"]),
    scopeId: z.string().nullable().default(null),
  })
  .refine((v) => (v.level === "campaign" || v.level === "user" ? v.scopeId !== null : v.scopeId === null), {
    message: "campaign/user necessitent un scopeId ; les autres niveaux n'en veulent pas.",
  });

export const zTimelineEntry = z.object({
  id: z.string().min(1),
  date: zGameDate,
  kind: z.enum(TIMELINE_ENTRY_KINDS),
  title: z.string().trim().min(1),
  summary: z.string().default(""),
  /** Present une fois l'entree promue en entite (specs/wiki-blocs.md §3) — navigation seulement, jamais la source de `date`/`title`. */
  ref: zBlockReference.optional(),
  visibility: zTimelineEntryVisibility.default({ level: "public", scopeId: null }),
});
export type TimelineEntry = z.infer<typeof zTimelineEntry>;

export const zTimelineBlockData = z.object({
  __v: z.literal(1),
  entries: z.array(zTimelineEntry).default([]),
  groupBy: z.enum(["none", "era"]).default("none"),
});
export type TimelineBlockData = z.infer<typeof zTimelineBlockData>;
