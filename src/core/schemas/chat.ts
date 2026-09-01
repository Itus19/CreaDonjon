import { z } from "zod";

/** Salon de campagne (V2-M12) — meme borne que la contrainte `check` de `campaign_chat_messages.body`, jamais divergente. */
export const chatMessageInputSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
