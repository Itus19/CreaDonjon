import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { promoteDetailLevel, type DetailLevel } from "@/src/core/rules/discovery";
import { getDiscovery, listDiscoveriesForUser, upsertDiscovery } from "@/src/server/repos/entityDiscoveries";

type TypedClient = SupabaseClient<Database>;

/**
 * V3-C4 — Marque une entité découverte, sans jamais régresser
 * (`promoteDetailLevel`, noyau pur). `sourceEventId` répond à « où ai-je
 * appris ça ? » (docs/BACKLOG_V3.md) — `null` quand le déclencheur n'a
 * lui-même aucun `session_event` (poser une scène, par exemple, ne
 * journalise rien aujourd'hui).
 */
export async function discoverEntity(
  supabase: TypedClient,
  params: { campaignId: string; userId: string; entityId: string; level: DetailLevel; sourceEventId?: string | null }
): Promise<void> {
  const existing = await getDiscovery(supabase, { campaignId: params.campaignId, entityId: params.entityId, userId: params.userId });
  const next = promoteDetailLevel(existing?.detailLevel ?? null, params.level);
  if (existing && next === existing.detailLevel) return;

  await upsertDiscovery(supabase, {
    id: existing?.id,
    campaignId: params.campaignId,
    entityId: params.entityId,
    userId: params.userId,
    detailLevel: next,
    sourceEventId: params.sourceEventId ?? existing?.sourceEventId ?? null,
  });
}

/** Les entités que ce joueur a le droit de voir dans la colonne wiki du solo — jamais fiche par fiche (V3-C4). */
export async function listDiscoveredEntityIds(supabase: TypedClient, campaignId: string, userId: string): Promise<Set<string>> {
  const discoveries = await listDiscoveriesForUser(supabase, campaignId, userId);
  return new Set(discoveries.keys());
}
