import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface ProfileRow {
  id: string;
  display_name: string;
  locale: string;
}

export async function getOwnProfile(supabase: TypedClient, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, locale")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
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
