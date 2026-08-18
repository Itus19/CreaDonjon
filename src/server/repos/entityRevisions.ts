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

/**
 * Calcule le prochain revision_number ET insere en une seule requete SQL
 * (public.insert_entity_revision, migration 20260818100001), serialisee par
 * un verrou consultatif par entite. Ne PAS revenir a un SELECT max()+1 suivi
 * d'un INSERT separes cote TypeScript : deux appels concurrents sur la meme
 * entite (ex. deux blocs sauvegardes a quelques millisecondes d'intervalle)
 * peuvent alors lire le meme max et entrer en collision sur la contrainte
 * unique (entity_id, revision_number) — bug reellement observe en jouant.
 */
export async function insertEntityRevision(
  supabase: TypedClient,
  params: {
    entityId: string;
    snapshot: Json;
    changeSource: "user" | "ai" | "import" | "system";
    changeNote?: string;
    changedBy: string;
  }
): Promise<void> {
  const { error } = await supabase.rpc("insert_entity_revision", {
    p_entity_id: params.entityId,
    p_snapshot: params.snapshot,
    p_change_source: params.changeSource,
    // Le generateur de types de la fonction typent p_change_note en `string`
    // non-nullable alors que la colonne et le parametre Postgres acceptent
    // bien NULL (cf. le meme contournement deja etabli pour p_note dans
    // src/server/repos/rules.ts) : caster plutot que d'inventer une valeur.
    p_change_note: (params.changeNote ?? null) as unknown as string,
    p_changed_by: params.changedBy,
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
