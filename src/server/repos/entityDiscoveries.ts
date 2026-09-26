import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { DetailLevel } from "@/src/core/rules/discovery";

type TypedClient = SupabaseClient<Database>;

/**
 * V3-C4 — `entity_discoveries` (SCHEMA.md §13). `user_id` distingue « ce
 * joueur l'a découvert » de `null` (« toute la table le sait » — un usage de
 * campagne, hors périmètre du solo). Le solo écrit toujours pour SON
 * joueur : jamais `null` ici.
 *
 * L'index unique porte sur `(campaign_id, entity_id, coalesce(user_id, ...))`
 * — une expression, pas une liste de colonnes — donc un simple upsert
 * `onConflict` ne le cible pas proprement : ce dépôt lit d'abord la ligne,
 * puis choisit insert ou update, plutôt que de dépendre d'une contrainte
 * que Supabase ne sait pas nommer ici.
 */

export interface EntityDiscoveryRow {
  id: string;
  campaignId: string;
  entityId: string;
  userId: string | null;
  detailLevel: DetailLevel;
  sourceEventId: string | null;
}

function toRow(r: {
  id: string;
  campaign_id: string;
  entity_id: string;
  user_id: string | null;
  detail_level: string;
  source_event_id: string | null;
}): EntityDiscoveryRow {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    entityId: r.entity_id,
    userId: r.user_id,
    detailLevel: r.detail_level as DetailLevel,
    sourceEventId: r.source_event_id,
  };
}

/** Les découvertes de CE joueur pour cette campagne — pour filtrer une colonne wiki, jamais fiche par fiche. */
export async function listDiscoveriesForUser(supabase: TypedClient, campaignId: string, userId: string): Promise<Map<string, DetailLevel>> {
  const { data, error } = await supabase
    .from("entity_discoveries")
    .select("entity_id, detail_level")
    .eq("campaign_id", campaignId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return new Map(data.map((row) => [row.entity_id, row.detail_level as DetailLevel]));
}

export async function getDiscovery(supabase: TypedClient, params: { campaignId: string; entityId: string; userId: string }): Promise<EntityDiscoveryRow | null> {
  const { data, error } = await supabase
    .from("entity_discoveries")
    .select("id, campaign_id, entity_id, user_id, detail_level, source_event_id")
    .eq("campaign_id", params.campaignId)
    .eq("entity_id", params.entityId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toRow(data) : null;
}

export async function upsertDiscovery(
  supabase: TypedClient,
  params: { id?: string; campaignId: string; entityId: string; userId: string; detailLevel: DetailLevel; sourceEventId: string | null }
): Promise<void> {
  if (params.id) {
    const { error } = await supabase
      .from("entity_discoveries")
      .update({ detail_level: params.detailLevel, source_event_id: params.sourceEventId })
      .eq("id", params.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase.from("entity_discoveries").insert({
    campaign_id: params.campaignId,
    entity_id: params.entityId,
    user_id: params.userId,
    detail_level: params.detailLevel,
    source_event_id: params.sourceEventId,
  });
  if (error) throw new Error(error.message);
}
