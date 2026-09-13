import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { listMentionsTargetingEntity } from "@/src/server/repos/entityMentions";
import { listEntitiesByIds } from "@/src/server/repos/entities";

type TypedClient = SupabaseClient<Database>;

export interface MentionedInEntry {
  id: string;
  name: string;
  slug: string;
}

/**
 * Fiches qui mentionnent CETTE fiche (V2.1-1, panneau "Mentionné dans",
 * specs/wiki-liens-et-personnages.md §A2) — `listMentionsTargetingEntity`
 * est déjà filtrée par visibilité pour l'appelant via la RLS de
 * `entity_mentions` (`entity_mentions_select`), donc ce qui reste ici est
 * déjà ce que CE viewer a le droit de voir. Ne renvoie que des fiches
 * elles-mêmes encore existantes/visibles (`listEntitiesByIds`, filtre déjà
 * les fiches supprimées) — une source devenue invisible/supprimée
 * disparaît simplement de la liste, jamais un id brut ou un lien mort ici
 * (ce panneau montre QUI mentionne cette fiche, pas les liens sortants
 * cassés — voir le rendu de `ref` lui-même pour ce cas).
 */
export async function listMentionedInEntities(supabase: TypedClient, targetEntityId: string): Promise<MentionedInEntry[]> {
  const rows = await listMentionsTargetingEntity(supabase, targetEntityId);
  const sourceIds = [...new Set(rows.map((r) => r.sourceEntityId))].filter((id) => id !== targetEntityId);
  if (sourceIds.length === 0) return [];
  const entities = await listEntitiesByIds(supabase, sourceIds);
  return entities.map((e) => ({ id: e.id, name: e.name, slug: e.slug }));
}
