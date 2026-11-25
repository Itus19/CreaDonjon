import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-224 (ADR 0103), ADR 0108 — les fournisseurs d'IA déclarés par un
 * compte, et le couple (fournisseur, modèle) qui sert.
 *
 * La RLS fait tout le travail d'autorisation : chaque politique de
 * `ai_providers` et `ai_provider_choices` exige `user_id = auth.uid()`, et un
 * choix ne peut pointer que vers un fournisseur de son compte. Ces fonctions
 * filtrent par `user_id` pour la lisibilité, pas pour la sécurité.
 *
 * `secret` est la clé **déjà chiffrée** (`src/server/ai/secrets.ts`). Elle ne
 * sort de la couche serveur sous aucune forme : la route qui répond à l'écran
 * ne renvoie que des métadonnées.
 */

export interface AiProviderRow {
  id: string;
  user_id: string;
  label: string;
  base_url: string;
  models: string[];
  secret: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiProviderChoiceRow {
  provider_id: string;
  model: string;
}

const COLONNES = "id, user_id, label, base_url, models, secret, created_at, updated_at";

/** Au plus dix par compte (ADR 0108) : la route le vérifie avant d'en créer un. */
export const MAX_FOURNISSEURS_PAR_COMPTE = 10;

/**
 * Les fournisseurs du compte ET son choix, en **une seule lecture** : le
 * choix est embarqué depuis chaque fournisseur (clé étrangère
 * `ai_provider_choices.provider_id`). Coût (docs/QUOTAS.md) : une requête par
 * appel d'IA, comme avant l'ADR 0108.
 */
export async function listAiProvidersWithChoice(
  supabase: TypedClient,
  userId: string,
): Promise<{ providers: AiProviderRow[]; choice: AiProviderChoiceRow | null }> {
  const { data, error } = await supabase
    .from("ai_providers")
    .select(`${COLONNES}, ai_provider_choices(provider_id, model)`)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  let choice: AiProviderChoiceRow | null = null;
  const providers = (data ?? []).map(({ ai_provider_choices: choix, ...ligne }) => {
    if (choix && choix.length > 0) choice = { provider_id: choix[0]!.provider_id, model: choix[0]!.model };
    return ligne;
  });
  return { providers, choice };
}

export async function countAiProviders(supabase: TypedClient, userId: string): Promise<number> {
  const { count, error } = await supabase.from("ai_providers").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getAiProviderById(supabase: TypedClient, userId: string, id: string): Promise<AiProviderRow | null> {
  const { data, error } = await supabase.from("ai_providers").select(COLONNES).eq("user_id", userId).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function insertAiProvider(
  supabase: TypedClient,
  params: { userId: string; label: string; baseUrl: string; models: string[]; secret: string | null },
): Promise<AiProviderRow> {
  const { data, error } = await supabase
    .from("ai_providers")
    .insert({ user_id: params.userId, label: params.label, base_url: params.baseUrl, models: params.models, secret: params.secret })
    .select(COLONNES)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** `secret: undefined` garde la clé en place ; `null` la retire. */
export async function updateAiProvider(
  supabase: TypedClient,
  params: { userId: string; id: string; label: string; baseUrl: string; models: string[]; secret?: string | null },
): Promise<AiProviderRow | null> {
  const base = { label: params.label, base_url: params.baseUrl, models: params.models, updated_at: new Date().toISOString() };
  const ligne = params.secret === undefined ? base : { ...base, secret: params.secret };
  const { data, error } = await supabase.from("ai_providers").update(ligne).eq("user_id", params.userId).eq("id", params.id).select(COLONNES).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Le choix qui pointait vers lui part avec lui (`on delete cascade`). */
export async function deleteAiProvider(supabase: TypedClient, userId: string, id: string): Promise<void> {
  const { error } = await supabase.from("ai_providers").delete().eq("user_id", userId).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Pose le couple qui sert. La RLS refuse un fournisseur qui n'est pas au compte. */
export async function setAiProviderChoice(supabase: TypedClient, params: { userId: string; providerId: string; model: string }): Promise<void> {
  const { error } = await supabase
    .from("ai_provider_choices")
    .upsert({ user_id: params.userId, provider_id: params.providerId, model: params.model, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}
