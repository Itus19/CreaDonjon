"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { joinCampaignInviteSchema } from "@/lib/campaignInvites/schemas";
import { claimInvite, resolveDestinationForInvitedUser, resolveInviteForJoin } from "@/src/server/services/campaignInvites";
import { hasVerifiedInvitePassword } from "./passwordActions";

export type JoinInviteState = { error: string } | null;

/**
 * Rejoindre via un lien (V2-M4, Lot M) : ne fait jamais confiance a un
 * `campaignId`/`worldId` transmis par le formulaire — tout part du jeton,
 * revalide ici cote serveur, jamais du contenu cache par l'ecran precedent.
 */
export async function joinInviteAction(_prevState: JoinInviteState, formData: FormData): Promise<JoinInviteState> {
  const parsed = joinCampaignInviteSchema.safeParse({
    token: formData.get("token"),
    role: formData.get("role"),
    name: formData.get("name"),
    entityId: formData.get("entityId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const supabase = await createClient();
  const resolved = await resolveInviteForJoin(supabase, parsed.data.token);
  if (!resolved.ok) {
    return { error: "Ce lien n'est plus valide." };
  }

  // Defense en profondeur : la page n'affiche ce formulaire qu'apres
  // validation du mot de passe, mais cette action reste atteignable
  // directement.
  if (resolved.invite.passwordHash && !(await hasVerifiedInvitePassword(parsed.data.token))) {
    return { error: "Mot de passe requis." };
  }

  // Retour utilisateur 30 aout ("Jeremy MJ dans un monde ET joueur dans un
  // autre") : une session deja ouverte (via un lien precedent) recoit ce
  // nouveau role/personnage sur le MEME compte, jamais un second.
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const result = await claimInvite({
    invite: resolved.invite,
    claim: { role: parsed.data.role, name: parsed.data.name, entityId: parsed.data.entityId },
    existingUserId: currentUser?.id,
  });
  if (!result.ok) {
    const messages = {
      role_mismatch: "Ce lien est réservé à un autre rôle.",
      missing_entity: "Choisis un personnage.",
      character_already_taken: "Ce personnage vient d'être pris par quelqu'un d'autre — choisis-en un autre.",
      invite_already_claimed: "Ce lien vient d'être utilisé par quelqu'un d'autre — demande-en un nouveau.",
    };
    return { error: messages[result.reason] };
  }

  let userId = currentUser?.id;
  if (result.tokenHash) {
    const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: result.tokenHash,
    });
    if (verifyError || !verified.user) {
      return { error: "Connexion impossible, réessaie." };
    }
    userId = verified.user.id;
  }
  if (!userId) throw new Error("Session introuvable apres reclamation (invariant interne).");

  redirect(await resolveDestinationForInvitedUser(supabase, resolved.invite, userId));
}
