"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { joinCampaignInviteSchema } from "@/lib/campaignInvites/schemas";
import { claimInvite, resolveDestinationForInvitedUser, resolveInviteForJoin } from "@/src/server/services/campaignInvites";
import { createTagAccount } from "@/src/server/services/accountAuth";
import { hasVerifiedInvitePassword } from "./passwordActions";

export type JoinInviteState = { error: string } | null;

/**
 * Rejoindre via un lien (V2-M4, Lot M) : ne fait jamais confiance a un
 * `campaignId`/`worldId` transmis par le formulaire — tout part du jeton,
 * revalide ici cote serveur, jamais du contenu cache par l'ecran precedent.
 *
 * V3.1-10 : un visiteur SANS session ouvre desormais un compte "tag" avec
 * le mot de passe qu'il vient de choisir (`accountAuth.createTagAccount`),
 * puis se connecte directement dessus — jamais de lien magique pour cette
 * toute premiere reclamation (ADR 0031, decision 2).
 */
export async function joinInviteAction(_prevState: JoinInviteState, formData: FormData): Promise<JoinInviteState> {
  const parsed = joinCampaignInviteSchema.safeParse({
    token: formData.get("token"),
    role: formData.get("role"),
    name: formData.get("name"),
    entityId: formData.get("entityId") || undefined,
    accountPassword: formData.get("accountPassword") || undefined,
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

  let existingUserId = currentUser?.id;

  // Lien MJ deja reclame par un AUTRE compte que celui-ci (ou aucune
  // session) : reconnexion par lien magique, geree par `claimInvite` sans
  // qu'aucun compte ne soit cree ici (page.tsx redirige normalement vers
  // /entrer avant ce formulaire pour ce cas — garde de defense en
  // profondeur si atteint directement).
  const isReconnect = resolved.invite.claimedByUserId !== null && resolved.invite.intendedRole !== "player";

  if (!isReconnect && !existingUserId) {
    if (!parsed.data.accountPassword) {
      return { error: "Choisis un mot de passe." };
    }
    const created = await createTagAccount({ handleName: parsed.data.name, password: parsed.data.accountPassword });
    if (!created.ok) {
      return { error: "Impossible de créer le compte, réessaie." };
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: created.email,
      password: parsed.data.accountPassword,
    });
    if (signInError) {
      return { error: "Compte créé, mais la connexion a échoué — réessaie." };
    }
    existingUserId = created.userId;
  }

  const result = await claimInvite({
    invite: resolved.invite,
    claim: { role: parsed.data.role, name: parsed.data.name, entityId: parsed.data.entityId },
    existingUserId,
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

  let userId = existingUserId;
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
  if (!userId) throw new Error("Session introuvable après réclamation (invariant interne).");

  redirect(await resolveDestinationForInvitedUser(supabase, resolved.invite, userId));
}
