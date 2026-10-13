import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface AppIdentityRow {
  name: string;
  tagline: string;
  logo_key: string;
  logo_storage_path: string | null;
  updated_at: string;
}

const COLUMNS = "name, tagline, logo_key, logo_storage_path, updated_at";

/** La ligne unique, ou `null` si le superadmin n'a jamais rien enregistré. Lisible par tous, `anon` compris (RLS `app_identity_select`). */
export async function getAppIdentityRow(supabase: TypedClient): Promise<AppIdentityRow | null> {
  const { data, error } = await supabase.from("app_identity").select(COLUMNS).maybeSingle();
  if (error) throw new Error(`app_identity : ${error.message}`);
  return data;
}

/** Écrit la ligne unique (création ou remplacement). RLS : superadmin seul. */
export async function upsertAppIdentityRow(
  supabase: TypedClient,
  row: { name: string; tagline: string; logo_key: string; logo_storage_path: string | null; updated_by: string }
): Promise<AppIdentityRow> {
  const { data, error } = await supabase
    .from("app_identity")
    .upsert({ id: true, ...row, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(`app_identity : ${error.message}`);
  return data;
}

/** « Rétablir » : supprime la ligne, les valeurs par défaut reprennent. RLS : superadmin seul. */
export async function deleteAppIdentityRow(supabase: TypedClient): Promise<void> {
  const { error } = await supabase.from("app_identity").delete().eq("id", true);
  if (error) throw new Error(`app_identity : ${error.message}`);
}
