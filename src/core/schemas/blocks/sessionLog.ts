import { z } from "zod";

/**
 * Bloc `session_log` (V2-H4, specs/wiki-blocs.md §5) : compte rendu d'UNE
 * seance, relie aux `session_events`. Le resume redactionnel n'est PAS
 * duplique ici — il vit dans `sessions.summary` (docs/SCHEMA.md §12,
 * "reinjecte dans le contexte IA"), une seule source de verite ; ce bloc
 * n'en est qu'une vue epinglee a une fiche. `sessionId` se resout tout
 * seul a la creation (route `session-log/attach`, meme session que
 * `getOrOpenSessionForCampaign`) — pas de vrai selecteur de seance,
 * aucune interface de gestion de seance n'existe encore ailleurs dans
 * l'application (`src/server/services/sessions.ts`).
 */
export const zSessionLogBlockData = z.object({
  __v: z.literal(1),
  sessionId: z.string().nullable().default(null),
});
export type SessionLogBlockData = z.infer<typeof zSessionLogBlockData>;
