import "server-only";
import { createAccountProvisioningServiceClient } from "@/lib/supabase/serviceAccountProvisioning";
import type { ResolvedCampaignInvite } from "@/src/server/repos/campaignInvites";

/**
 * Seul fichier ou `createAccountProvisioningServiceClient` est construit et
 * utilise — verifie mecaniquement par une regle ESLint (eslint.config.mjs),
 * meme discipline que `publicShare.ts` pour le premier trou (CLAUDE.md
 * regle 4 ter, docs/adr/0015-provisioning-comptes-invites.md).
 *
 * Depuis V3.1-10 (ADR 0031) : ce module n'ouvre plus de compte lui-meme —
 * un compte "tag" (mot de passe choisi par la personne, jamais de lien
 * magique) est cree AVANT cet appel par `src/server/services/accountAuth.ts`,
 * pour un lien joueur (reutilisable) comme pour la toute premiere
 * reclamation d'un lien MJ. Ce qui reste ici : attacher role/campagne/
 * personnage a un compte DEJA authentifie (`existingUserId`, desormais
 * obligatoire pour reclamer), et reconnecter un lien MJ deja reclame par
 * lien magique — seul usage de lien magique restant, avec "voir comme"
 * (ADR 0031 decision 2).
 */
export type ProvisionInviteResult =
  | { ok: true; tokenHash: string | null }
  | { ok: false; reason: "role_mismatch" | "missing_entity" | "character_already_taken" | "invite_already_claimed" };

/**
 * Attache (au premier passage) ou reconnecte (aux suivants, lien MJ
 * seulement) le compte lie a ce jeton, puis renvoie de quoi etablir une
 * session — jamais la session elle-meme, cette fonction n'a pas acces aux
 * cookies de la requete. `tokenHash: null` signifie qu'aucune nouvelle
 * session n'est necessaire : l'appelant a deja la bonne (soit parce qu'il
 * vient de se connecter avec le mot de passe qu'il a choisi, soit parce que
 * `existingUserId` est deja le bon compte).
 *
 * Lien MJ (`invite.claimedByUserId` deja pose) : reste nominatif et a usage
 * unique (ADR 0031) — un lien magique fait basculer sur CE compte si le
 * navigateur n'a pas deja sa session.
 *
 * Lien joueur reutilisable (V3.1-10) : `invite.claimedByUserId` n'est plus
 * la source de verite (`campaign_members` l'est) — chaque visiteur sans
 * session encore membre de cette campagne passe par la branche
 * "reclamation", jamais par la reconnexion ci-dessus.
 *
 * `existingUserId` est desormais TOUJOURS fourni pour reclamer (le compte
 * existe deja, cree par l'appelant via `accountAuth.createTagAccount` s'il
 * s'agit d'un nouveau visiteur, ou issu de la session courante s'il s'agit
 * d'un compte deja connecte qui ajoute un role — retour utilisateur "Jeremy
 * MJ dans un monde ET joueur dans un autre").
 */
export async function provisionInviteSession(params: {
  invite: ResolvedCampaignInvite;
  claim?: { role: "gm" | "player"; name: string; entityId?: string };
  existingUserId?: string;
}): Promise<ProvisionInviteResult> {
  const admin = createAccountProvisioningServiceClient();

  // Le role importe : un lien JOUEUR reutilisable peut porter un
  // claimed_by_user_id herite d'AVANT V3.1-10 (reclame sous l'ancien regime
  // a usage unique) — un nouveau visiteur ne doit surtout pas etre
  // reconnecte sur ce premier compte, campaign_members fait foi desormais
  // (ADR 0031). Seuls MJ (nominatif, toujours a usage unique) et les liens
  // heretes sans role fixe passent par la reconnexion.
  if (params.invite.claimedByUserId && params.invite.intendedRole !== "player") {
    if (params.existingUserId === params.invite.claimedByUserId) {
      return { ok: true, tokenHash: null };
    }
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(params.invite.claimedByUserId);
    if (userError || !userData.user?.email) {
      throw new Error("Compte reclame introuvable (invariant interne).");
    }
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email,
    });
    if (linkError) throw new Error(linkError.message);
    return { ok: true, tokenHash: linkData.properties.hashed_token };
  }

  const claim = params.claim;
  if (!claim) throw new Error("Un lien non reclame exige role/nom (invariant appelant).");
  if (params.invite.intendedRole && params.invite.intendedRole !== claim.role) {
    return { ok: false, reason: "role_mismatch" };
  }
  if (claim.role === "player" && !claim.entityId) {
    return { ok: false, reason: "missing_entity" };
  }
  if (!params.existingUserId) {
    throw new Error("Le compte doit deja exister avant d'attacher un role (invariant appelant, V3.1-10).");
  }
  const userId = params.existingUserId;

  if (claim.role === "gm") {
    // Lien MJ : nominatif, usage unique (ADR 0031) — le jeton lui-meme fait
    // toujours foi. Reclame ICI, avant toute ecriture d'acces, course-safe
    // (`is("claimed_by_user_id", null)`) : sinon deux visiteurs sans session
    // du meme lien pourraient tous deux recevoir l'acces avant qu'un seul
    // gagne la course sur le jeton.
    const { data: claimedInviteRows, error: claimInviteError } = await admin
      .from("campaign_invites")
      .update({ claimed_by_user_id: userId, claimed_name: claim.name })
      .eq("id", params.invite.id)
      .is("claimed_by_user_id", null)
      .select("id");
    if (claimInviteError) throw new Error(claimInviteError.message);
    if (claimedInviteRows.length === 0) {
      // Le compte de CE visiteur existe deja (accountAuth, avant cet appel)
      // et reste utilisable ailleurs — rien a annuler, juste refuser cette
      // tentative-ci (contrairement a l'ancienne version : plus de compte a
      // supprimer, ce n'est plus cette fonction qui en cree).
      return { ok: false, reason: "invite_already_claimed" };
    }

    if (params.invite.campaignId) {
      const { error: memberError } = await admin
        .from("campaign_members")
        .upsert({ campaign_id: params.invite.campaignId, user_id: userId, role: "gm" }, { onConflict: "campaign_id,user_id" });
      if (memberError) throw new Error(memberError.message);
    }
    if (params.invite.worldId) {
      const { error: worldMemberError } = await admin
        .from("world_members")
        .upsert({ world_id: params.invite.worldId, user_id: userId, role: "editor" }, { onConflict: "world_id,user_id" });
      if (worldMemberError) throw new Error(worldMemberError.message);
    }
    return { ok: true, tokenHash: null };
  }

  // Lien joueur (reutilisable, V3.1-10) : jamais de claimed_by_user_id —
  // campaign_members fait foi de qui a rejoint (ADR 0031). Course-safe sur
  // le PERSONNAGE seul (`is("user_id", null)`), jamais sur le lien.
  if (claim.entityId && params.invite.campaignId) {
    const { data: claimedRows, error: claimError } = await admin
      .from("campaign_characters")
      .update({ user_id: userId })
      .eq("campaign_id", params.invite.campaignId)
      .eq("entity_id", claim.entityId)
      .eq("is_pc", true)
      .is("user_id", null)
      .select("entity_id");
    if (claimError) throw new Error(claimError.message);
    if (claimedRows.length === 0) {
      return { ok: false, reason: "character_already_taken" };
    }
    const { error: memberError } = await admin
      .from("campaign_members")
      .upsert({ campaign_id: params.invite.campaignId, user_id: userId, role: "player" }, { onConflict: "campaign_id,user_id" });
    if (memberError) throw new Error(memberError.message);
  }

  return { ok: true, tokenHash: null };
}

export type MintSessionResult = { ok: true; tokenHash: string } | { ok: false; reason: "not_found" | "not_an_invited_account" };

/**
 * Genere un lien de connexion pour un compte EXISTANT, par id (retour
 * utilisateur : "voir l'interface du point de vue de..."). Garde-fou :
 * refuse un compte jamais issu d'un lien d'invitation — ce mecanisme sert
 * a voir comme un profil invite, jamais a se reconnecter comme n'importe
 * quel compte au hasard (la suppression generalisee, elle, n'a plus ce
 * garde-fou depuis V3.1-10 : `src/server/services/accountAuth.ts`).
 * L'autorisation ("qui a le droit d'appeler ceci") est verifiee par
 * l'appelant (`src/server/services/viewAs.ts`), pas ici.
 */
export async function mintSessionForInvitedAccount(userId: string): Promise<MintSessionResult> {
  const admin = createAccountProvisioningServiceClient();

  const { data: ownInvites, error: ownInvitesError } = await admin
    .from("campaign_invites")
    .select("id")
    .eq("claimed_by_user_id", userId)
    .limit(1);
  if (ownInvitesError) throw new Error(ownInvitesError.message);
  if (ownInvites.length === 0) return { ok: false, reason: "not_an_invited_account" };

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !userData.user?.email) return { ok: false, reason: "not_found" };

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: userData.user.email });
  if (linkError) throw new Error(linkError.message);
  return { ok: true, tokenHash: linkData.properties.hashed_token };
}

/**
 * Genere un lien de connexion pour retrouver SON PROPRE compte apres
 * "voir comme" (retour utilisateur) — jamais pour un compte invite (aucun
 * garde-fou `campaign_invites` ici, contrairement a `mintSessionForInvitedAccount`
 * ci-dessus) : c'est le chemin de retour vers le superadmin, pas une variante
 * du meme mecanisme. L'autorisation ("cet id est-il vraiment superadmin")
 * est verifiee par l'appelant (`src/server/services/viewAs.ts`), via une
 * lecture service_role — la session courante au moment de l'appel est celle
 * du compte IMPERSONNE, jamais celle du superadmin, RLS ne peut donc pas
 * servir de garde ici.
 */
export async function mintSessionForOwnAccount(userId: string): Promise<MintSessionResult> {
  const admin = createAccountProvisioningServiceClient();
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !userData.user?.email) return { ok: false, reason: "not_found" };
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: userData.user.email });
  if (linkError) throw new Error(linkError.message);
  return { ok: true, tokenHash: linkData.properties.hashed_token };
}

/**
 * "Cet id est-il superadmin" via service_role, jamais via la RLS de la
 * session courante — necessaire pour le retour de "voir comme" : au moment
 * de l'appel, la session active est celle du compte IMPERSONNE (pas le
 * superadmin), `profiles_select` ne garantit pas qu'il puisse lire le profil
 * du superadmin (seulement s'ils partagent un monde, `app.shares_world_with`).
 * Lecture d'un seul booleen, jamais de donnee sensible — meme perimetre
 * restreint que le reste de ce module.
 */
export async function isSuperadminByIdViaServiceRole(userId: string): Promise<boolean> {
  const admin = createAccountProvisioningServiceClient();
  const { data, error } = await admin.from("profiles").select("account_role").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.account_role === "superadmin";
}
