"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { resolveCampaignId, claimOwnOpenCharacter } from "@/src/server/services/campaigns";

export type ClaimCharacterState = { error: string } | null;

/**
 * Ecran "Choisis ton personnage" (V3.1-10) : une joueuse déjà membre d'un
 * monde mais sans PJ assigné (ajoutée par email, ou personnage réinitialisé)
 * choisit parmi les PJ ouverts — jamais imposé à la création du compte.
 */
export async function claimCharacterAction(worldSlug: string, entityId: string): Promise<ClaimCharacterState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) return { error: "Monde introuvable." };
  const campaignId = await resolveCampaignId(supabase, world.id);
  if (!campaignId) return { error: "Aucune campagne pour ce monde." };

  const result = await claimOwnOpenCharacter(supabase, { campaignId, entityId, userId: user.id });
  if (!result.ok) return { error: "Ce personnage vient d'être pris par quelqu'un d'autre — choisis-en un autre." };

  redirect(`/m/${worldSlug}/joueur`);
}
