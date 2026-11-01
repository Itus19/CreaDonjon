"use server";

import { createClient } from "@/lib/supabase/server";
import { resetPlayerTitleTiers, savePlayerTitleTiers, type PlayerTitleTiersWriteError } from "@/src/server/services/playerTitleTiersWrite";
import type { PlayerTitleTier } from "@/src/core/stats/titleTiers";

export type TitresActionState = { error: string } | { ok: true; tiers: PlayerTitleTier[] };

const ERREURS: Record<PlayerTitleTiersWriteError, string> = {
  forbidden: "Réservé au superadmin.",
  invalid: "Paliers invalides.",
};

/**
 * V3.1-92 — Enregistre les paliers des titres des joueurs (Administration ›
 * Titres des joueurs). L'entrée est validée par Zod dans le service
 * (`zPlayerTitleTierSet`) : une icône ou une couleur hors liste est refusée.
 * Superadmin vérifié par le service ET par la RLS. Le volet « Je joue » relit
 * les paliers à chaque chargement : rien à invalider.
 */
export async function savePlayerTitleTiersAction(tiers: unknown): Promise<TitresActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };
  const result = await savePlayerTitleTiers(supabase, { userId: user.id, tiers });
  if (!result.ok) return { error: result.message ? `${ERREURS[result.reason]} ${result.message}` : ERREURS[result.reason] };
  return { ok: true, tiers: result.tiers };
}

/** « Rétablir les titres par défaut » (confirmé à l'écran). */
export async function resetPlayerTitleTiersAction(): Promise<TitresActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée, reconnectez-vous." };
  const result = await resetPlayerTitleTiers(supabase, user.id);
  if (!result.ok) return { error: ERREURS[result.reason] };
  return { ok: true, tiers: result.tiers };
}
