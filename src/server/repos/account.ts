import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface ProfileRow {
  id: string;
  display_name: string;
  locale: string;
  account_role: string;
}

export async function getOwnProfile(supabase: TypedClient, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, locale, account_role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Demandes "mot de passe oublié" en attente (V3.1-10) — lecture groupée pour un panneau MJ/superadmin, jamais un aller-retour par membre. RLS (`profiles_select`, `app.shares_world_with`) borne déjà aux profils partageant un monde avec l'appelant. */
export async function getPasswordResetRequestsForUsers(supabase: TypedClient, userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  const { data, error } = await supabase
    .from("profiles")
    .select("id, password_reset_requested_at")
    .in("id", userIds)
    .not("password_reset_requested_at", "is", null);
  if (error) throw new Error(error.message);
  return Object.fromEntries(data.map((row) => [row.id, row.password_reset_requested_at as string]));
}

export async function updateOwnProfile(
  supabase: TypedClient,
  userId: string,
  params: { displayName?: string; locale?: string }
): Promise<void> {
  const patch: { display_name?: string; locale?: string } = {};
  if (params.displayName !== undefined) patch.display_name = params.displayName;
  if (params.locale !== undefined) patch.locale = params.locale;
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw new Error(error.message);
}

/**
 * Suppression du compte de l'appelant (app.delete_own_account, security
 * definer) : jamais de client service-role ici, la fonction SQL fait
 * elle-meme le travail sous ses propres privileges, confinee au strict
 * necessaire (voir la migration pour la portee exacte et ses limites).
 */
export async function deleteOwnAccount(supabase: TypedClient): Promise<void> {
  const { error } = await supabase.rpc("delete_own_account");
  if (error) throw new Error(error.message);
}
