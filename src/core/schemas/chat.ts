import { z } from "zod";

/** Fil MJ/joueur ou salon (V2-M13, V3.1-22) — meme borne que la contrainte `check` de `campaign_chat_messages.body`, jamais divergente. Strict : la « Demande de modification » (`relatedEntityId`) est retiree (ADR 0038). */
export const chatMessageInputSchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
  })
  .strict();
