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
  | { ok: true; tokenHash: string }
  | { ok: false; reason: "role_mismatch" | "missing_entity" | "character_already_taken" | "invite_already_claimed" };

/**
 * Provisionne (au premier passage) ou retrouve (aux suivants) le compte
 * lie a ce jeton, puis renvoie de quoi etablir une session — jamais la
 * session elle-meme, cette fonction n'a pas acces aux cookies de la
 * requete.
 *
 * `claim` est ignore si `invite.claimedByUserId` est deja renseigne — un
 * lien deja reclame reconnecte toujours le MEME compte, sans jamais
 * redemander le role/nom/personnage (specs/module-joueur-et-solo.md §A1 :
 * "rejoindre exige un compte", pas "rejoindre a chaque fois").
 */
export async function provisionInviteSession(params: {
  invite: ResolvedCampaignInvite;
  claim?: { role: "gm" | "player"; name: string; entityId?: string };
}): Promise<ProvisionInviteResult> {
  const admin = createAccountProvisioningServiceClient();
  const email = syntheticEmailForInvite(params.invite.id);

  if (!params.invite.claimedByUserId) {
    const claim = params.claim;
    if (!claim) throw new Error("Un lien non reclame exige role/nom (invariant appelant).");
    if (params.invite.intendedRole && params.invite.intendedRole !== claim.role) {
      return { ok: false, reason: "role_mismatch" };
    }
    if (claim.role === "player" && !claim.entityId) {
      return { ok: false, reason: "missing_entity" };
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: claim.name },
    });
    if (createError) {
      // Course entre deux visiteurs du MEME lien non encore reclame : le
      // second arrive ici avec la MEME adresse synthetique (derivee de
      // `invite.id`, pas du visiteur, et jamais utilisee ailleurs) — la
      // SEULE cause possible d'un echec de creation sur cette adresse est
      // qu'un autre appel vient de gagner la course une fraction de
      // seconde plus tot. GoTrue renvoie parfois une erreur propre
      // (`email_exists`), parfois une violation de contrainte 500 brute
      // selon le moment exact de la collision — peu importe la forme, la
      // cause est la meme ici.
      return { ok: false, reason: "invite_already_claimed" };
    }
    if (!created.user) throw new Error("creation de compte echouee");
    const userId = created.user.id;

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
        // Course perdue entre la lecture de la liste (page) et cet appel :
        // le compte cree n'aurait jamais servi a rien, on le retire plutot
        // que de laisser un compte orphelin derriere une erreur.
        await admin.auth.admin.deleteUser(userId);
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

    const { error: inviteError } = await admin
      .from("campaign_invites")
      .update({ claimed_by_user_id: userId, claimed_name: claim.name })
      .eq("id", params.invite.id);
    if (inviteError) throw new Error(inviteError.message);
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError) throw new Error(linkError.message);
  return { ok: true, tokenHash: linkData.properties.hashed_token };
}
