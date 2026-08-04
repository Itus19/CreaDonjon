import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { BlockRow } from "@/src/server/repos/blocks";

type TypedClient = SupabaseClient<Database>;

export interface RevisionSummaryRow {
  id: string;
  revision_number: number;
  change_source: "user" | "ai" | "import" | "system";
  change_note: string | null;
  created_at: string;
}

export interface RevisionRow extends RevisionSummaryRow {
  snapshot: Json;
}

/**
 * Tous les blocs de l'entite, y compris ceux hors de la visibilite propre
 * de l'appelant (migration 20260804160001) : un instantane d'historique
 * doit etre complet, jamais tronque par la RLS fine de V1-C2.
 */
export async function fetchAllBlocksForEntity(supabase: TypedClient, entityId: string): Promise<BlockRow[]> {
  const { data, error } = await supabase.rpc("entity_blocks_full", { p_entity_id: entityId });
  if (error) throw new Error(error.message);
  return data as BlockRow[];
}

export async function nextRevisionNumber(supabase: TypedClient, entityId: string): Promise<number> {
  const { data, error } = await supabase
    .from("entity_revisions")
    .select("revision_number")
    .eq("entity_id", entityId)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.revision_number ?? 0) + 1;
}

export async function insertEntityRevision(
  supabase: TypedClient,
  params: {
    entityId: string;
    revisionNumber: number;
    snapshot: Json;
    changeSource: "user" | "ai" | "import" | "system";
    changeNote?: string;
    changedBy: string;
  }
): Promise<void> {
  const { error } = await supabase.from("entity_revisions").insert({
    entity_id: params.entityId,
    revision_number: params.revisionNumber,
    snapshot: params.snapshot,
    change_source: params.changeSource,
    change_note: params.changeNote ?? null,
    changed_by: params.changedBy,
  });
  if (error) throw new Error(error.message);
}

export async function listEntityRevisionSummaries(
  supabase: TypedClient,
  entityId: string
): Promise<RevisionSummaryRow[]> {
  const { data, error } = await supabase
    .from("entity_revisions")
    .select("id, revision_number, change_source, change_note, created_at")
    .eq("entity_id", entityId)
    .order("revision_number", { ascending: false });
  if (error) throw new Error(error.message);
  return data as RevisionSummaryRow[];
}

export async function getEntityRevisionByNumber(
  supabase: TypedClient,
  entityId: string,
  revisionNumber: number
): Promise<RevisionRow | null> {
  const { data, error } = await supabase
    .from("entity_revisions")
    .select("id, revision_number, change_source, change_note, created_at, snapshot")
    .eq("entity_id", entityId)
    .eq("revision_number", revisionNumber)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as RevisionRow | null;
}
