"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createCharacterFromWizardSchema, overwriteCharacterFromWizardSchema } from "@/lib/characterCreator/schemas";
import { createCharacterFromWizard } from "@/src/server/services/characterCreator";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { resolveCampaignId } from "@/src/server/services/campaigns";
import { reclamerEtCreerFiche } from "@/src/server/services/choixPersonnage";
import type { CreateCharacterFromWizardInput } from "@/app/m/[worldSlug]/mj/creation-personnage/actions";
import type { OverwriteCharacterFromWizardInput } from "@/app/m/[worldSlug]/(monde)/f/[entitySlug]/actions";

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

  await createCharacterFromWizard(supabase, {
    worldId: parsed.data.worldId,
    createdBy: user.id,
    name: parsed.data.name,
    character: parsed.data.character,
    inventory: parsed.data.inventory,
    spellcasting: parsed.data.spellcasting,
    // V3.1-100 : réclamée par `claim_campaign_character` (la joueuse n'écrit
    // plus directement dans `campaign_characters`), avant les blocs.
    claimInCampaignId: campaignId,
  });

  revalidatePath(`/m/${worldSlug}`, "layout");
  redirect(`/m/${worldSlug}/joueur`);
}

/**
 * V3.1-83 : un PJ ouvert sans fiche, choisi dans le carrousel. La joueuse le
 * réclame ICI, à la fin de l'assistant, puis la fiche s'écrit
 * (`reclamerEtCreerFiche`) : annuler l'assistant ne laisse rien derrière.
 */
export async function reclamerEtCreerFicheAction(
  worldSlug: string,
  input: OverwriteCharacterFromWizardInput
): Promise<{ error: string } | void> {
  const parsed = overwriteCharacterFromWizardSchema.safeParse(input);
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

  const result = await reclamerEtCreerFiche(supabase, {
    campaignId,
    userId: user.id,
    entityId: parsed.data.entityId,
    expectedVersion: parsed.data.expectedVersion,
    name: parsed.data.name,
    character: parsed.data.character,
    inventory: parsed.data.inventory,
    spellcasting: parsed.data.spellcasting,
  });
  if (!result.ok) {
    const messages = {
      already_taken: "Ce personnage vient d'être pris par quelqu'un d'autre — reviens au choix pour en prendre un autre.",
      conflict: "Ton MJ vient de modifier cette fiche. Reviens au choix et rouvre-la avant de réessayer.",
      forbidden: "Tu n'as pas le droit d'écrire cette fiche.",
      not_found: "Fiche introuvable.",
    };
    return { error: messages[result.reason] };
  }

  revalidatePath(`/m/${worldSlug}`, "layout");
  redirect(`/m/${worldSlug}/joueur?reclame=1`);
}
