import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * V3.2-49 (ADR 0118) — Les facettes découvertes de ces entités dans cette
 * partie : ce que toute la table sait, et ce que `userId` sait seul. Une
 * seule requête pour tous les présents d'une scène.
 */
export async function listFacetDiscoveries(
  supabase: TypedClient,
  params: { campaignId: string; entityIds: string[]; userId: string | null }
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  if (params.entityIds.length === 0) return result;
  // L'identifiant entre dans un filtre `or` en texte : un UUID, ou rien.
  if (params.userId !== null && !UUID.test(params.userId)) throw new Error("Identifiant de personne invalide");
  let query = supabase
    .from("entity_facet_discoveries")
    .select("entity_id, facet")
    .eq("campaign_id", params.campaignId)
    .in("entity_id", params.entityIds);
  query = params.userId ? query.or(`user_id.is.null,user_id.eq.${params.userId}`) : query.is("user_id", null);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  for (const row of data) {
    const set = result.get(row.entity_id) ?? new Set<string>();
    set.add(row.facet);
    result.set(row.entity_id, set);
  }
  return result;
}

/** Ajoute des facettes (déjà validées par l'appelant). L'appelant n'envoie que les nouvelles ; un doublon concurrent reste refusé par l'index unique. */
export async function insertFacetDiscoveries(
  supabase: TypedClient,
  rows: { campaignId: string; entityId: string; facet: string; userId: string | null; sourceEventId: string | null }[]
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("entity_facet_discoveries").insert(
    rows.map((r) => ({ campaign_id: r.campaignId, entity_id: r.entityId, facet: r.facet, user_id: r.userId, source_event_id: r.sourceEventId }))
  );
  if (error) throw new Error(error.message);
}
