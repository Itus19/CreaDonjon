"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createCharacterFromWizardSchema } from "@/lib/characterCreator/schemas";
import { createCharacterFromWizard } from "@/src/server/services/characterCreator";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { resolveCampaignId, assignCampaignCharacter } from "@/src/server/services/campaigns";
import type { CreateCharacterFromWizardInput } from "@/app/m/[worldSlug]/mj/creation-personnage/actions";

/**
 * "Nouveau PJ" depuis la coquille joueuse (V3.1-10) : crée la fiche PUIS la
 * réclame immédiatement pour l'appelant dans la campagne de ce monde —
 * jamais une fiche flottante que le MJ devrait ensuite attribuer à la main
 * (contrairement à l'écran MJ, `mj/creation-personnage/actions.ts`, qui ne
 * fait que créer). Redirige vers l'onglet Personnage joueur, jamais la
 * fiche MJ.
 */
export async function createAndClaimCharacterAction(
  worldSlug: string,
  input: CreateCharacterFromWizardInput
): Promise<{ error: string } | void> {
  const parsed = createCharacterFromWizardSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Non authentifié." };
  }

  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) {
    return { error: "Monde introuvable." };
  }
  const campaignId = await resolveCampaignId(supabase, world.id);
  if (!campaignId) {
    return { error: "Aucune campagne pour ce monde." };
  }

  const entity = await createCharacterFromWizard(supabase, {
    worldId: parsed.data.worldId,
    createdBy: user.id,
    name: parsed.data.name,
    character: parsed.data.character,
    inventory: parsed.data.inventory,
    spellcasting: parsed.data.spellcasting,
  });

  // Fiche tout juste créée par CET appel : aucune course possible avec un
  // autre visiteur, un simple upsert suffit (contrairement a la reclamation
  // d'un PJ deja existant, `claimOwnOpenCharacter`).
  await assignCampaignCharacter(supabase, { campaignId, entityId: entity.id, userId: user.id, isPc: true });

  revalidatePath(`/m/${worldSlug}`, "layout");
  redirect(`/m/${worldSlug}/joueur`);
}
