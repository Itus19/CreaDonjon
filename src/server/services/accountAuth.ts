import "server-only";
import { randomUUID } from "node:crypto";
import { createAccountAuthServiceClient } from "@/lib/supabase/serviceAccountAuth";
import { generateCampaignInviteToken, hashCampaignInviteToken } from "@/src/core/campaignInvites/token";

/**
 * Seul fichier ou `createAccountAuthServiceClient` est construit et utilise
 * — verifie mecaniquement par une regle ESLint (eslint.config.mjs), meme
 * discipline que `publicShare.ts`/`accountProvisioning.ts` (CLAUDE.md
 * regle 4 ter, docs/adr/0031-comptes-tag-et-mots-de-passe-natifs.md §6).
 *
 * Tout ce qui touche un MOT DE PASSE de compte vit ici : creation d'un
 * compte "tag" (libre-service ou via un lien d'invitation), reinitialisation
 * forcee, et les gestes superadmin generalises. Reutilise le jeton des
 * liens d'invitation tel quel (ADR 0031 : "meme primitive, pas une nouvelle
 * mecanique") plutot que d'en dupliquer un troisieme (src/core/campaignInvites/token.ts
 * en a deja deux, "regle des trois" citee dans son propre commentaire).
 */
function syntheticEmailForTagAccount(): string {
  return `tag-${randomUUID()}@creadonjon.tag`;
}

export type CreateTagAccountResult = { ok: true; email: string; userId: string } | { ok: false; reason: "creation_failed" };

/** Compte "tag" (V3.1-10) : mot de passe choisi par la personne elle-meme des la creation, jamais de lien magique. `handle_name`/`handle_tag` sont poses par `app.handle_new_user` (trigger, meme migration) a partir de `user_metadata.display_name`. */
export async function createTagAccount(params: { handleName: string; password: string }): Promise<CreateTagAccountResult> {
  const admin = createAccountAuthServiceClient();
  const email = syntheticEmailForTagAccount();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: params.password,
    email_confirm: true,
    user_metadata: { display_name: params.handleName },
  });
  if (error || !data.user) return { ok: false, reason: "creation_failed" };
  return { ok: true, email, userId: data.user.id };
}

export type ForcePasswordResetResult = { ok: true; token: string } | { ok: false; reason: "not_found" };

/**
 * "Forcer une reinitialisation" (MJ/superadmin, V3.1-10) : genere un jeton
 * a usage unique, jamais un mot de passe temporaire tape a la main (rejete
 * explicitement par le ticket). Un seul jeton valide a la fois par compte —
 * les precedents, jamais consommes, sont invalides des qu'un nouveau est
 * emis, pour ne jamais laisser deux liens actifs en meme temps.
 */
export async function forcePasswordReset(params: { targetUserId: string; actingUserId: string }): Promise<ForcePasswordResetResult> {
  const admin = createAccountAuthServiceClient();
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(params.targetUserId);
  if (userError || !userData.user) return { ok: false, reason: "not_found" };

  await admin.from("account_reset_tokens").update({ used_at: new Date().toISOString() }).eq("user_id", params.targetUserId).is("used_at", null);

  const token = generateCampaignInviteToken();
  const { error: insertError } = await admin.from("account_reset_tokens").insert({
    user_id: params.targetUserId,
    token_hash: hashCampaignInviteToken(token),
    created_by: params.actingUserId,
  });
  if (insertError) throw new Error(insertError.message);

  const { error: flagError } = await admin.from("profiles").update({ must_change_password: true }).eq("id", params.targetUserId);
  if (flagError) throw new Error(flagError.message);

  return { ok: true, token };
}

export type ResolveResetTokenResult = { ok: true; userId: string } | { ok: false };

/** Ecran "choisis ton nouveau mot de passe" (sans session) : verifie que le jeton existe et n'a pas deja servi, sans le consommer. */
export async function resolveResetToken(token: string): Promise<ResolveResetTokenResult> {
  const admin = createAccountAuthServiceClient();
  const { data, error } = await admin
    .from("account_reset_tokens")
    .select("user_id")
    .eq("token_hash", hashCampaignInviteToken(token))
    .is("used_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { ok: false };
  return { ok: true, userId: data.user_id };
}

export type ConsumeResetTokenResult = { ok: true; email: string } | { ok: false; reason: "invalid_token" };

/** Change reellement le mot de passe (admin API, aucune colonne de mot de passe applicatif) et cloture le jeton + les drapeaux de reinitialisation. Renvoie l'email (toujours synthetique pour un compte "tag") pour que l'appelant puisse ouvrir la session lui-meme sur son client lie aux cookies. */
export async function consumeResetToken(params: { token: string; newPassword: string }): Promise<ConsumeResetTokenResult> {
  const admin = createAccountAuthServiceClient();
  const resolved = await resolveResetToken(params.token);
  if (!resolved.ok) return { ok: false, reason: "invalid_token" };

  const { data: userData, error: userError } = await admin.auth.admin.getUserById(resolved.userId);
  if (userError || !userData.user?.email) return { ok: false, reason: "invalid_token" };

  const { error: updateError } = await admin.auth.admin.updateUserById(resolved.userId, { password: params.newPassword });
  if (updateError) throw new Error(updateError.message);

  await admin.from("account_reset_tokens").update({ used_at: new Date().toISOString() }).eq("token_hash", hashCampaignInviteToken(params.token));
  await admin.from("profiles").update({ must_change_password: false, password_reset_requested_at: null }).eq("id", resolved.userId);

  return { ok: true, email: userData.user.email };
}
