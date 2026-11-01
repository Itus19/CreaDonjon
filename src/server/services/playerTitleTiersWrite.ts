import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { isSuperadmin } from "@/src/server/services/account";
import { replacePlayerTitleTiers } from "@/src/server/repos/playerTitleTiers";
import { DEFAULT_TITLE_TIERS, TITLE_FAMILIES, zPlayerTitleTier, type PlayerTitleTier } from "@/src/core/stats/titleTiers";
import { z } from "zod";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-92 — Le jeu complet de paliers que l'éditeur envoie : chaque palier
 * validé par `zPlayerTitleTier` (douze icônes, cinq couleurs, variables de
 * texte connues), au moins un palier par famille (l'éditeur ne retire jamais
 * le dernier ; le serveur le revérifie). Les trous et chevauchements
 * (`checkTiers`) ne bloquent pas : c'est un avertissement.
 */
export const zPlayerTitleTierSet = z
  .array(zPlayerTitleTier)
  .min(1)
  .max(80)
  .refine((tiers) => TITLE_FAMILIES.every((f) => tiers.some((t) => t.family === f)), { message: "Chaque famille garde au moins un palier." });

export type PlayerTitleTiersWriteError = "forbidden" | "invalid";

/** Enregistre le jeu de paliers ; superadmin vérifié ici, puis par la RLS. */
export async function savePlayerTitleTiers(
  supabase: TypedClient,
  params: { userId: string; tiers: unknown }
): Promise<{ ok: true; tiers: PlayerTitleTier[] } | { ok: false; reason: PlayerTitleTiersWriteError; message?: string }> {
  if (!(await isSuperadmin(supabase, params.userId))) return { ok: false, reason: "forbidden" };
  const parsed = zPlayerTitleTierSet.safeParse(params.tiers);
  if (!parsed.success) return { ok: false, reason: "invalid", message: parsed.error.issues[0]?.message };
  // Les positions suivent l'ordre reçu, famille par famille.
  const rangs = new Map<string, number>();
  const tiers = parsed.data.map((t) => {
    const position = rangs.get(t.family) ?? 0;
    rangs.set(t.family, position + 1);
    return { ...t, position };
  });
  await replacePlayerTitleTiers(supabase, tiers);
  return { ok: true, tiers };
}

/** « Rétablir les titres par défaut » : les quatorze paliers de V3.1-90. */
export async function resetPlayerTitleTiers(supabase: TypedClient, userId: string) {
  return savePlayerTitleTiers(supabase, { userId, tiers: DEFAULT_TITLE_TIERS });
}
