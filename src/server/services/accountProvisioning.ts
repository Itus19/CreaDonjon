import "server-only";
import { createAccountProvisioningServiceClient } from "@/lib/supabase/serviceAccountProvisioning";
import type { ResolvedCampaignInvite } from "@/src/server/repos/campaignInvites";

/**
 * Seul fichier ou `createAccountProvisioningServiceClient` est construit et
 * utilise — verifie mecaniquement par une regle ESLint (eslint.config.mjs),
 * meme discipline que `publicShare.ts` pour le premier trou (CLAUDE.md
 * regle 4 ter, docs/adr/0015-provisioning-comptes-invites.md).
 *
 * Un compte invite (V2-M4) n'a JAMAIS de mot de passe : cree avec
 * `email_confirm: true` et rien d'autre, puis connecte uniquement via un
 * lien de connexion magique genere ici et verifie par l'appelant sur SON
 * propre client lie aux cookies (`lib/supabase/server.ts`) — cette
 * fonction ne pose jamais de session elle-meme, elle ne fait que fournir
 * le `token_hash` que l'appelant echange contre une session reelle.
 */
function syntheticEmailForInvite(inviteId: string): string {
  return `invite-${inviteId}@creadonjon.invite`;
}

export type ProvisionInviteResult =
  | { ok: true; tokenHash: string | null }
  | { ok: false; reason: "role_mismatch" | "missing_entity" | "character_already_taken" | "invite_already_claimed" };

/**
 * Provisionne (au premier passage) ou retrouve (aux suivants) le compte
 * lie a ce jeton, puis renvoie de quoi etablir une session — jamais la
 * session elle-meme, cette fonction n'a pas acces aux cookies de la
 * requete. `tokenHash: null` signifie qu'aucune nouvelle session n'est
 * necessaire : l'appelant a deja la bonne (voir `existingUserId`).
 *
 * `claim` est ignore si `invite.claimedByUserId` est deja renseigne — un
 * lien deja reclame reconnecte toujours le MEME compte, sans jamais
 * redemander le role/nom/personnage (specs/module-joueur-et-solo.md §A1 :
 * "rejoindre exige un compte", pas "rejoindre a chaque fois").
 *
 * `existingUserId` (retour utilisateur 30 aout : "Jeremy MJ dans un monde
 * ET joueur dans un autre") : si l'appelant a DEJA une session valide
 * quand il ouvre un lien pas encore reclame, ce nouveau role/personnage
 * s'ajoute a CE compte plutot que d'en creer un nouveau — un compte, tous
 * les mondes/personnages de la personne, jamais un compte par lien.
 */
export async function provisionInviteSession(params: {
  invite: ResolvedCampaignInvite;
  claim?: { role: "gm" | "player"; name: string; entityId?: string };
  existingUserId?: string;
}): Promise<ProvisionInviteResult> {
  const admin = createAccountProvisioningServiceClient();
  const email = syntheticEmailForInvite(params.invite.id);

  if (params.invite.claimedByUserId) {
    // Deja reclame : si la session courante EST deja ce compte, rien a
    // refaire — sinon un lien magique la fait basculer dessus.
    if (params.existingUserId === params.invite.claimedByUserId) {
      return { ok: true, tokenHash: null };
    }
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
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

  let userId: string;
  let mintedFreshAccount = false;
  if (params.existingUserId) {
    userId = params.existingUserId;
  } else {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: claim.name },
    });
    if (createError) {
      // Course entre deux visiteurs SANS SESSION du MEME lien non encore
      // reclame : le second arrive ici avec la MEME adresse synthetique
      // (derivee de `invite.id`) — la seule cause possible d'un echec de
      // creation sur cette adresse est qu'un autre appel vient de gagner
      // la course une fraction de seconde plus tot.
      return { ok: false, reason: "invite_already_claimed" };
    }
    if (!created.user) throw new Error("creation de compte echouee");
    userId = created.user.id;
    mintedFreshAccount = true;
  }

  // Marque l'invitation comme reclamee — course-safe : n'ecrit QUE si
  // encore libre (`is("claimed_by_user_id", null)`), jamais un simple
  // update inconditionnel qui ecraserait le gagnant d'une course
  // concurrente entre deux comptes DEJA existants (`existingUserId`),
  // cas que l'unicite d'email de GoTrue ne protege plus.
  const { data: claimedInviteRows, error: claimInviteError } = await admin
    .from("campaign_invites")
    .update({ claimed_by_user_id: userId, claimed_name: claim.name })
    .eq("id", params.invite.id)
    .is("claimed_by_user_id", null)
    .select("id");
  if (claimInviteError) throw new Error(claimInviteError.message);
  if (claimedInviteRows.length === 0) {
    if (mintedFreshAccount) await admin.auth.admin.deleteUser(userId);
    return { ok: false, reason: "invite_already_claimed" };
  }

  if (claim.role === "player" && claim.entityId && params.invite.campaignId) {
    // Course-safe : ne reclame QUE si la ligne est encore libre —
    // "personne d'autre ne peut la prendre en double" (critere du
    // ticket) doit tenir meme si deux amis ouvrent le meme lien
    // ouvert au meme instant.
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
      // L'invitation vient d'etre marquee reclamee par CE compte
      // ci-dessus, mais le personnage vise est parti entre-temps :
      // annule les deux plutot que de laisser une invitation "reclamee"
      // sans personnage associe.
      await admin.from("campaign_invites").update({ claimed_by_user_id: null, claimed_name: null }).eq("id", params.invite.id);
      if (mintedFreshAccount) await admin.auth.admin.deleteUser(userId);
      return { ok: false, reason: "character_already_taken" };
    }
    const { error: memberError } = await admin
      .from("campaign_members")
      .upsert({ campaign_id: params.invite.campaignId, user_id: userId, role: "player" }, { onConflict: "campaign_id,user_id" });
    if (memberError) throw new Error(memberError.message);
  }

  if (claim.role === "gm") {
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
  }

  if (params.existingUserId) {
    return { ok: true, tokenHash: null };
  }
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError) throw new Error(linkError.message);
  return { ok: true, tokenHash: linkData.properties.hashed_token };
}
