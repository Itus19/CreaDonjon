"use server";

import { createClient } from "@/lib/supabase/server";
import { updateWikiWelcomeMessageSchema } from "@/lib/worlds/schemas";
import { updateWikiWelcomeMessage } from "@/src/server/services/worlds";

export type UpdateWikiWelcomeMessageState = { error: string } | { ok: true } | null;

/**
 * Message d'accueil personnalisable du wiki public (V2-G2, extension sur
 * retour utilisateur) — `worlds_write` (RLS) restreint deja l'ecriture au
 * seul proprietaire du monde, meme garde que `setWorldDefaultRuleset`.
 */
export async function updateWikiWelcomeMessageAction(
  _prevState: UpdateWikiWelcomeMessageState,
  formData: FormData,
): Promise<UpdateWikiWelcomeMessageState> {
  const parsed = updateWikiWelcomeMessageSchema.safeParse({
    worldId: formData.get("worldId"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const { updated } = await updateWikiWelcomeMessage(supabase, parsed.data.worldId, parsed.data.message ?? "");
  if (!updated) return { error: "Modification refusée." };

  return { ok: true };
}
