import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

const JOURNAL_LIMIT = 100;

export interface EntityRevisionJournalRow {
  entity_id: string;
  entity_name: string;
  entity_slug: string;
  revision_number: number;
  change_source: string;
  changed_by: string | null;
  created_at: string;
}

/**
 * V2-M6 (Lot M) — toutes les revisions des entites d'UN monde, triees
 * recemment d'abord, plafonnees a 100 (un journal, pas un export complet).
 * `entities!inner` filtre par la relation plutot qu'une sous-requete
 * separee : une seule requete, jamais N+1 par entite.
 */
export async function listEntityRevisionsForWorld(supabase: TypedClient, worldId: string): Promise<EntityRevisionJournalRow[]> {
  const { data, error } = await supabase
    .from("entity_revisions")
    .select("revision_number, change_source, changed_by, created_at, entities!inner(id, name, slug, world_id)")
    .eq("entities.world_id", worldId)
    .order("created_at", { ascending: false })
    .limit(JOURNAL_LIMIT);
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    entity_id: row.entities.id,
    entity_name: row.entities.name,
    entity_slug: row.entities.slug,
    revision_number: row.revision_number,
    change_source: row.change_source,
    changed_by: row.changed_by,
    created_at: row.created_at,
  }));
}

/**
 * Meme forme que `listEntityRevisionsForWorld` (V2-M6) mais filtree a un
 * ENSEMBLE d'entites precises plutot qu'un monde entier — sert au journal
 * cote joueur (ecran d'accueil, retour utilisateur), restreint aux fiches
 * PJ de sa campagne (jamais les fiches PNJ/lieux, qui pourraient reveler un
 * secret de MJ). `entities!inner` reste necessaire pour le nom/slug affiches,
 * plus de filtre par world_id ici puisque les entityIds le sont deja.
 */
export async function listEntityRevisionsForEntities(supabase: TypedClient, entityIds: string[]): Promise<EntityRevisionJournalRow[]> {
  if (entityIds.length === 0) return [];
  const { data, error } = await supabase
    .from("entity_revisions")
    .select("revision_number, change_source, changed_by, created_at, entities!inner(id, name, slug)")
    .in("entity_id", entityIds)
    .order("created_at", { ascending: false })
    .limit(JOURNAL_LIMIT);
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    entity_id: row.entities.id,
    entity_name: row.entities.name,
    entity_slug: row.entities.slug,
    revision_number: row.revision_number,
    change_source: row.change_source,
    changed_by: row.changed_by,
    created_at: row.created_at,
  }));
}

export interface SessionEventJournalRow {
  id: string;
  kind: string;
  actor: string;
  actor_user_id: string | null;
  created_at: string;
}

/**
 * V2-M6 (Lot M) — tous les evenements de jeu des sessions d'UN monde. En
 * deux temps (campagnes du monde, puis sessions de ces campagnes) plutot
 * qu'un filtre PostgREST imbrique sur deux niveaux de relation
 * (`sessions.campaigns.world_id`), dont le support est incertain — un
 * monde compte en pratique quelques campagnes/sessions, pas des milliers.
 */
export async function listSessionEventsForWorld(supabase: TypedClient, worldId: string): Promise<SessionEventJournalRow[]> {
  const { data: campaigns, error: campaignsError } = await supabase.from("campaigns").select("id").eq("world_id", worldId);
  if (campaignsError) throw new Error(campaignsError.message);
  const campaignIds = campaigns.map((c) => c.id);
  if (campaignIds.length === 0) return [];

  const { data: sessions, error: sessionsError } = await supabase.from("sessions").select("id").in("campaign_id", campaignIds);
  if (sessionsError) throw new Error(sessionsError.message);
  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length === 0) return [];

  const { data, error } = await supabase
    .from("session_events")
    .select("id, kind, actor, actor_user_id, created_at")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: false })
    .limit(JOURNAL_LIMIT);
  if (error) throw new Error(error.message);
  return data;
}

/** Noms affiches pour un ensemble de comptes (V2-M6) — une seule requete groupee, jamais une par ligne de journal. */
export async function getDisplayNamesForUsers(supabase: TypedClient, userIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("profiles").select("id, display_name").in("id", uniqueIds);
  if (error) throw new Error(error.message);
  return new Map(data.map((p) => [p.id, p.display_name]));
}
