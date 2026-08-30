import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { isSuperadmin } from "@/src/server/services/account";
import {
  isSuperadminByIdViaServiceRole,
  mintSessionForInvitedAccount,
  mintSessionForOwnAccount,
} from "@/src/server/services/accountProvisioning";

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
 * Chemin de retour vers le superadmin (retour utilisateur : eviter le piege
 * ou l'on se retrouve connecte comme quelqu'un d'autre sans moyen simple de
 * revenir — vecu en verifiant V2-M7c avec un compte de test cette meme
 * session). `originalAdminUserId` vient d'un cookie pose au moment de
 * `startViewAs` (route API), jamais de la session courante (qui EST le
 * compte impersonne a ce stade) — verifie ici via une lecture service_role
 * (`isSuperadminByIdViaServiceRole`), la RLS de la session courante ne
 * pouvant pas servir de garde puisqu'elle n'est plus celle du superadmin.
 */
export async function returnFromViewAs(originalAdminUserId: string): Promise<ViewAsResult> {
  if (!(await isSuperadminByIdViaServiceRole(originalAdminUserId))) return { ok: false, reason: "not_superadmin" };
  return mintSessionForOwnAccount(originalAdminUserId);
}
