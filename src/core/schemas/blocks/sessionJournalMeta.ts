import { z } from "zod";
import { zGameDate } from "@/src/core/schemas/calendar";

/**
 * Bloc `session_journal_meta` (V2.1-3 suite, retour utilisateur) : les
 * quatre champs fixes d'une entrée du Livre de sessions (date ingame,
 * autrice, date IRL de rédaction, séance réelle correspondante) — jamais
 * un `infobox` générique, dont les libellés sont éditables un par un et
 * dont les valeurs restent du texte libre. Ce bloc n'est JAMAIS proposé
 * via "+ Ajouter un bloc" (EntityBlocks.tsx) : posé une seule fois par
 * `submitJournalEntry` au moment où l'autrice commence à écrire.
 *
 * `writtenBy`/`realSession` portent un instantané (id + libellé déjà
 * résolu), pas seulement une référence — délibéré, contrairement au
 * renvoi vers une fiche épinglée (règle absolue n°16 par analogie,
 * `notebook.ts`) : une entrée de journal documente un fait historique
 * ("rédigé par X, pour la séance du Y"), jamais une fiche vivante qui
 * doit refléter un état actuel. Re-choisir dans la liste déroulante
 * rafraîchit l'instantané ; rien ne le fait dériver tout seul.
 */
export const zSessionJournalMetaBlockData = z.object({
  __v: z.literal(1),
  ingameDate: zGameDate,
  writtenBy: z.object({ userId: z.string(), name: z.string() }).nullable().default(null),
  /** ISO 8601, IRL — posé automatiquement à la soumission, corrigible seulement par le MJ (retour utilisateur : "je peux voir quand elles ont écrit IRL"). */
  writtenAt: z.string().nullable().default(null),
  realSession: z.object({ id: z.string(), label: z.string() }).nullable().default(null),
});
export type SessionJournalMetaBlockData = z.infer<typeof zSessionJournalMetaBlockData>;
