import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { isSuperadmin } from "@/src/server/services/account";
import { mintSessionForInvitedAccount } from "@/src/server/services/accountProvisioning";

type TypedClient = SupabaseClient<Database>;

export type ViewAsResult = { ok: true; tokenHash: string } | { ok: false; reason: "not_superadmin" | "not_found" | "not_an_invited_account" };

/**
 * "Voir l'interface du point de vue de..." (retour utilisateur, section
 * Administration) — changement de session REEL, pas une simple
 * superposition d'affichage : le superadmin se connecte litteralement comme
 * le compte cible, avec ses vraies permissions. Choix delibere malgre le
 * risque (voir `returnFromViewAs` ci-dessous pour le filet de securite qui
 * en decoule) : l'utilisateur a prefere ce mode, plus proche de ce qu'un
 * ami voit vraiment, a une vue en lecture seule reconstruite en parallele.
 */
export async function startViewAs(
  supabase: TypedClient,
  params: { callerId: string; targetUserId: string }
): Promise<ViewAsResult> {
  if (!(await isSuperadmin(supabase, params.callerId))) return { ok: false, reason: "not_superadmin" };
  return mintSessionForInvitedAccount(params.targetUserId);
}

/**
 * Cookie httpOnly du retour (ADR 0051). Il porte le jeton de rafraichissement
 * de la PROPRE session de l'appelant, jamais un identifiant : un identifiant
 * se forge (n'importe qui peut envoyer n'importe quel cookie), un jeton de
 * rafraichissement non. Le posseder EST la preuve, sans service_role.
 */
export const VIEW_AS_RETURN_COOKIE = "view_as_return";
/** Ancien cookie (identifiant en clair) : efface au retour, jamais relu. */
export const LEGACY_VIEW_AS_COOKIE = "view_as_admin_uid";

/**
 * Au depart de « voir comme » : renouvelle la session de l'appelant et rend
 * son jeton de rafraichissement, a mettre de cote. Renouveler d'abord donne
 * un jeton d'acces frais : le middleware n'a alors aucune raison de
 * rafraichir l'ancienne session pendant la bascule, ce qui consommerait le
 * jeton mis de cote. `null` si la session ne peut pas etre renouvelee.
 */
export async function captureReturnSession(supabase: TypedClient): Promise<string | null> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) return null;
  return data.session.refresh_token;
}

export type ReturnFromViewAsResult = { ok: true } | { ok: false; reason: "expired" };

/**
 * Retour : ferme la session empruntee (revoquee cote serveur, pas seulement
 * oubliee par le navigateur), puis reprend la session mise de cote. Aucune
 * condition de role : seul celui qui a demarre « voir comme » detient ce
 * jeton, qu'il soit superadmin ou MJ (V3.1-12).
 */
export async function returnFromViewAs(supabase: TypedClient, refreshToken: string): Promise<ReturnFromViewAsResult> {
  const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
  // Une session empruntee deja expiree ne bloque pas le retour : on reprend
  // quand meme la sienne. L'erreur est rendue visible au journal serveur.
  if (signOutError) console.warn(`Voir comme : fermeture de la session empruntee en echec (${signOutError.message}).`);
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return { ok: false, reason: "expired" };
  return { ok: true };
}
