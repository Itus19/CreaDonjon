import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { KnowledgeFact, KnowledgeSource } from "@/src/core/rules/npcKnowledge";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.2-80 (ADR 0122) — Ce que ces PNJ savent de ce personnage, dans cette
 * partie. Une seule requête pour tous les présents. La RLS réserve la table
 * au MJ : pour quiconque d'autre, elle rend une liste vide.
 */
export async function listNpcKnowledge(
  supabase: TypedClient,
  params: { campaignId: string; subjectId: string; knowerIds: string[] }
): Promise<KnowledgeFact[]> {
  if (params.knowerIds.length === 0) return [];
  const { data, error } = await supabase
    .from("npc_knowledge")
    .select("knower_entity_id, facet, claim, is_true, source, told_by_entity_id")
    .eq("campaign_id", params.campaignId)
    .eq("subject_entity_id", params.subjectId)
    .in("knower_entity_id", params.knowerIds)
    .order("learned_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data.map((r) => ({
    knowerId: r.knower_entity_id,
    facet: r.facet,
    claim: r.claim,
    isTrue: r.is_true,
    source: r.source as KnowledgeSource,
    toldById: r.told_by_entity_id,
  }));
}

/** Ajoute des faits déjà validés par l'appelant (`src/core/rules/npcKnowledge.ts`). Un doublon de facette concurrent reste refusé par l'index unique. */
export async function insertNpcKnowledge(
  supabase: TypedClient,
  params: { campaignId: string; subjectId: string; facts: readonly KnowledgeFact[]; sourceEventId: string | null }
): Promise<void> {
  if (params.facts.length === 0) return;
  const { error } = await supabase.from("npc_knowledge").insert(
    params.facts.map((f) => ({
      campaign_id: params.campaignId,
      knower_entity_id: f.knowerId,
      subject_entity_id: params.subjectId,
      facet: f.facet,
      claim: f.claim,
      is_true: f.isTrue,
      source: f.source,
      told_by_entity_id: f.toldById,
      source_event_id: params.sourceEventId,
    }))
  );
  if (error) throw new Error(error.message);
}

/** V3.2-83 — « Annuler ce tour » : ce que les PNJ ont appris pendant ces événements s'oublie. Rend le nombre de lignes retirées. */
export async function deleteNpcKnowledgeBySourceEvents(supabase: TypedClient, params: { campaignId: string; eventIds: readonly string[] }): Promise<number> {
  if (params.eventIds.length === 0) return 0;
  const { data, error } = await supabase
    .from("npc_knowledge")
    .delete()
    .eq("campaign_id", params.campaignId)
    .in("source_event_id", [...params.eventIds])
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}
