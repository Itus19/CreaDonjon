import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/src/types/database";
import { isSuperadmin } from "@/src/server/services/account";
import { mintSessionForInvitedAccount } from "@/src/server/services/accountProvisioning";
import { decideMemberAccountAction } from "@/src/server/services/campaigns";
import { getCampaignById } from "@/src/server/repos/campaigns";

type TypedClient = SupabaseClient<Database>;

export type ViewAsResult =
  | { ok: true; tokenHash: string }
  | { ok: false; reason: "self" | "not_authorized" | "not_found" | "not_a_member" | "ordinary_account" };

/**
 * "Voir l'interface du point de vue de..." (retour utilisateur, section
 * Administration) — changement de session REEL, pas une simple
 * superposition d'affichage : l'appelant se connecte litteralement comme
 * le compte cible, avec ses vraies permissions. Choix delibere malgre le
 * risque (voir `returnFromViewAs` ci-dessous pour le filet de securite qui
 * en decoule) : l'utilisateur a prefere ce mode, plus proche de ce qu'un
 * ami voit vraiment, a une vue en lecture seule reconstruite en parallele.
 *
 * V3.1-12 (ADR 0052) : depuis Gestion de campagne, `campaignId` fourni, un
 * MJ peut aussi le faire, sur un compte « tag » membre de CETTE campagne.
 * Sans `campaignId` (Administration), superadmin seulement. Jamais sur un
 * compte ordinaire, quel que soit l'appelant — verifie ici ET par
 * `mintSessionForInvitedAccount`.
 */
export async function startViewAs(
  supabase: TypedClient,
  params: { callerId: string; targetUserId: string; campaignId?: string }
): Promise<ViewAsResult> {
  // Sur soi-même, le geste n'a pas de sens, et le retour fermerait sa propre session.
  if (params.targetUserId === params.callerId) return { ok: false, reason: "self" };
  if (params.campaignId) {
    const campaign = await getCampaignById(supabase, params.campaignId);
    if (!campaign) return { ok: false, reason: "not_found" };
    const decision = await decideMemberAccountAction(supabase, {
      action: "view_as",
      campaign,
      callerId: params.callerId,
      targetUserId: params.targetUserId,
    });
    if (decision === "not_found") return { ok: false, reason: "not_found" };
    if (!decision.allowed) return { ok: false, reason: decision.reason };
  } else if (!(await isSuperadmin(supabase, params.callerId))) {
    return { ok: false, reason: "not_authorized" };
  }
  return mintSessionForInvitedAccount(params.targetUserId);
}

/**
 * Cookie httpOnly du retour (ADR 0051). Il porte le jeton de rafraichissement
 * de la PROPRE session de l'appelant, jamais un identifiant : un identifiant
 * se forge (n'importe qui peut envoyer n'importe quel cookie), un jeton de
 * rafraichissement non. Le posseder EST la preuve, sans service_role.
 */
export const VIEW_AS_RETURN_COOKIE = "view_as_return";
/**
 * Identifiant de la session d'origine, mis de côté avec son jeton. Il ne
 * prouve rien (le jeton reste la preuve) : il sert seulement, au retour, à
 * reconnaître que la session courante EST déjà celle d'origine — la
 * confirmation de « voir comme » a été abandonnée — pour ne pas la fermer.
 */
export const VIEW_AS_RETURN_SESSION_COOKIE = "view_as_return_session";
/** Ancien cookie (identifiant en clair) : efface au retour, jamais relu. */
export const LEGACY_VIEW_AS_COOKIE = "view_as_admin_uid";

const zSessionClaims = z.object({ session_id: z.string().min(1) });

/** L'identifiant de session porté par un jeton d'accès que le serveur d'authentification vient de rendre. */
function sessionIdOf(accessToken: string): string | null {
  const charge = accessToken.split(".")[1];
  if (!charge) return null;
  try {
    const parsed = zSessionClaims.safeParse(JSON.parse(Buffer.from(charge, "base64url").toString("utf8")));
    return parsed.success ? parsed.data.session_id : null;
  } catch (error) {
    console.warn(`Voir comme : jeton d'accès illisible (${error instanceof Error ? error.message : String(error)}).`);
    return null;
  }
}

/**
 * Au depart de « voir comme » : renouvelle la session de l'appelant et rend
 * son jeton de rafraichissement, a mettre de cote, avec l'identifiant de
 * cette session. Renouveler d'abord donne un jeton d'acces frais : le
 * middleware n'a alors aucune raison de rafraichir l'ancienne session
 * pendant la bascule, ce qui consommerait le jeton mis de cote. `null` si
 * la session ne peut pas etre renouvelee.
 */
export async function captureReturnSession(supabase: TypedClient): Promise<{ refreshToken: string; sessionId: string | null } | null> {
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) return null;
  return { refreshToken: data.session.refresh_token, sessionId: sessionIdOf(data.session.access_token) };
}

export type ReturnFromViewAsResult = { ok: true } | { ok: false; reason: "expired" };

/**
 * Retour : ferme la session empruntee (revoquee cote serveur, pas seulement
 * oubliee par le navigateur), puis reprend la session mise de cote. Aucune
 * condition de role : seul celui qui a demarre « voir comme » detient ce
 * jeton, qu'il soit superadmin ou MJ (V3.1-12).
 *
 * Si la session courante EST la session d'origine (confirmation abandonnee,
 * 19 octobre), il n'y a rien a fermer ni a reprendre : la fermer revoquerait
 * justement le jeton mis de cote, et deconnecterait. Un `sessionId` absent
 * (cookie pose avant ce correctif) garde le comportement d'origine.
 */
export async function returnFromViewAs(
  supabase: TypedClient,
  saved: { refreshToken: string; sessionId: string | null }
): Promise<ReturnFromViewAsResult> {
  if (saved.sessionId) {
    const { data: current } = await supabase.auth.getClaims();
    if (current?.claims.session_id === saved.sessionId) return { ok: true };
  }
  const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
  // Une session empruntee deja expiree ne bloque pas le retour : on reprend
  // quand meme la sienne. L'erreur est rendue visible au journal serveur.
  if (signOutError) console.warn(`Voir comme : fermeture de la session empruntee en echec (${signOutError.message}).`);
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: saved.refreshToken });
  if (error || !data.session) return { ok: false, reason: "expired" };
  return { ok: true };
}
