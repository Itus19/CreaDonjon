import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { NomSecret } from "@/src/core/entities/nomPourLaTable";

type TypedClient = SupabaseClient<Database>;

/**
 * AG-12 (ADR 0105) — le vrai nom d'une fiche dont le nom pour la table est
 * rempli. La RLS le réserve au MJ du monde : pour tout autre lecteur, la
 * lecture rend `null`, comme une fiche sans secret.
 */
export async function getTrueName(supabase: TypedClient, entityId: string): Promise<NomSecret | null> {
  const { data, error } = await supabase.from("entity_true_names").select("true_name, true_aliases").eq("entity_id", entityId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { trueName: data.true_name, trueAliases: data.true_aliases } : null;
}

export async function upsertTrueName(supabase: TypedClient, params: { entityId: string; worldId: string; secret: NomSecret }): Promise<void> {
  const { error } = await supabase.from("entity_true_names").upsert({
    entity_id: params.entityId,
    world_id: params.worldId,
    true_name: params.secret.trueName,
    true_aliases: params.secret.trueAliases,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function deleteTrueName(supabase: TypedClient, entityId: string): Promise<void> {
  const { error } = await supabase.from("entity_true_names").delete().eq("entity_id", entityId);
  if (error) throw new Error(error.message);
}

export interface BlocCitant {
  id: string;
  entity_id: string;
  block_type: string;
  data: Json;
  display: Json;
  version: number;
  visibility_level: string;
  visibility_scope_id: string | null;
}

/** Les blocs texte et Encadré du monde qui citent cette fiche (RLS de `blocks` appliquée). */
export async function listBlocksCitingEntity(supabase: TypedClient, worldId: string, entityId: string): Promise<BlocCitant[]> {
  const { data, error } = await supabase.rpc("blocks_citing_entity", { p_world_id: worldId, p_entity_id: entityId });
  if (error) throw new Error(error.message);
  return data;
}

/** V3.2-45 — les vrais noms de plusieurs fiches, en une lecture. Vide pour qui n'est pas MJ du monde (RLS). */
export async function listTrueNamesForEntities(supabase: TypedClient, entityIds: string[]): Promise<{ entityId: string; trueName: string }[]> {
  if (entityIds.length === 0) return [];
  const { data, error } = await supabase.from("entity_true_names").select("entity_id, true_name").in("entity_id", entityIds);
  if (error) throw new Error(error.message);
  return data.map((r) => ({ entityId: r.entity_id, trueName: r.true_name }));
}
