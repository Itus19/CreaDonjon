import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

/** Ecran de connexion unique (V3.1-10) : emails (toujours synthetiques) de chaque compte "tag" portant ce nom, dans l'ordre de creation. Anon-safe (`app.resolve_login_emails`, security definer) : appele avant toute session. */
export async function resolveLoginEmails(supabase: TypedClient, handleName: string): Promise<string[]> {
  const { data, error } = await supabase.rpc("resolve_login_emails", { p_handle_name: handleName });
  if (error) throw new Error(error.message);
  return data.map((row) => row.email).filter((email): email is string => email !== null);
}

/** Depose une demande "mot de passe oublie" par nom, sans reveler si le nom correspond a un compte (V3.1-10). */
export async function requestPasswordResetByName(supabase: TypedClient, handleName: string): Promise<void> {
  const { error } = await supabase.rpc("request_password_reset_by_name", { p_handle_name: handleName });
  if (error) throw new Error(error.message);
}
