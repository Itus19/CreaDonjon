import { z } from "zod";

/** Fil MJ/joueur (V2-M13) — meme borne que la contrainte `check` de `campaign_chat_messages.body`, jamais divergente. `relatedEntityId` : "Demande de modif au MJ" depuis une fiche (retour utilisateur), jamais utilise pour filtrer/securiser, juste un contexte affiche cote MJ. */
export const chatMessageInputSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  relatedEntityId: z.string().uuid().nullable().optional(),
});
