import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-224 (ADR 0103) — le fournisseur d'IA déclaré par un compte.
 *
 * La RLS fait tout le travail d'autorisation : chaque politique de
 * `ai_providers` exige `user_id = auth.uid()`. Ces fonctions n'ajoutent donc
 * aucun filtre — elles ne pourraient pas lire la ligne d'un autre même en le
 * demandant.
 *
 * `secret` est la clé **déjà chiffrée** (`src/server/ai/secrets.ts`). Elle ne
 * sort de la couche serveur sous aucune forme : le service qui répond à
 * l'écran ne renvoie que des métadonnées (`AiProviderView`).
 */

export interface AiProviderRow {
  user_id: string;
  label: string;
  base_url: string;
  model: string;
  secret: string | null;
  created_at: string;
  updated_at: string;
}

const COLONNES = "user_id, label, base_url, model, secret, created_at, updated_at";

export async function getAiProvider(supabase: TypedClient, userId: string): Promise<AiProviderRow | null> {
  const { data, error } = await supabase.from("ai_providers").select(COLONNES).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Pose ou remplace le fournisseur de l'appelant. `secret: undefined` garde celui qui est déjà en place. */
export async function upsertAiProvider(
  supabase: TypedClient,
  params: { userId: string; label: string; baseUrl: string; model: string; secret?: string | null },
): Promise<AiProviderRow> {
  const base = { user_id: params.userId, label: params.label, base_url: params.baseUrl, model: params.model, updated_at: new Date().toISOString() };
  const ligne = params.secret === undefined ? base : { ...base, secret: params.secret };
  const { data, error } = await supabase.from("ai_providers").upsert(ligne, { onConflict: "user_id" }).select(COLONNES).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteAiProvider(supabase: TypedClient, userId: string): Promise<void> {
  const { error } = await supabase.from("ai_providers").delete().eq("user_id", userId);
  if (error) throw new Error(error.message);
}
