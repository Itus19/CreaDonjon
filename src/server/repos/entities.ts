import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface EntitySummary {
  id: string;
  world_id: string;
  slug: string;
  name: string;
  entity_kind: string;
  aliases: string[];
  version: number;
  created_at: string;
  updated_at: string;
}

export async function listEntitiesForWorld(
  supabase: TypedClient,
  worldId: string
): Promise<EntitySummary[]> {
  const { data, error } = await supabase
    .from("entities")
    .select("id, world_id, slug, name, entity_kind, aliases, version, created_at, updated_at")
    .eq("world_id", worldId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as EntitySummary[];
}

export async function getEntityBySlug(
  supabase: TypedClient,
  worldId: string,
  slug: string
): Promise<EntitySummary | null> {
  const { data, error } = await supabase
    .from("entities")
    .select("id, world_id, slug, name, entity_kind, aliases, version, created_at, updated_at")
    .eq("world_id", worldId)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as EntitySummary | null;
}

/** Slugs bruts d'un monde, pour calculer le prochain slug numerique (src/core/slug). */
export async function listEntitySlugsForWorld(supabase: TypedClient, worldId: string): Promise<string[]> {
  const { data, error } = await supabase.from("entities").select("slug").eq("world_id", worldId);
  if (error) throw new Error(error.message);
  return data.map((row) => row.slug);
}

export async function worldHasSlug(
  supabase: TypedClient,
  worldId: string,
  slug: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("entities")
    .select("id")
    .eq("world_id", worldId)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

export async function insertEntity(
  supabase: TypedClient,
  params: {
    worldId: string;
    createdBy: string;
    slug: string;
    name: string;
    entityKind: string;
    aliases: string[];
  }
): Promise<EntitySummary> {
  const { data, error } = await supabase
    .from("entities")
    .insert({
      world_id: params.worldId,
      created_by: params.createdBy,
      slug: params.slug,
      name: params.name,
      entity_kind: params.entityKind,
      aliases: params.aliases,
    })
    .select("id, world_id, slug, name, entity_kind, aliases, version, created_at, updated_at")
    .single();
  if (error) throw new Error(error.message);
  return data as EntitySummary;
}

export async function getEntityById(
  supabase: TypedClient,
  id: string
): Promise<EntitySummary | null> {
  const { data, error } = await supabase
    .from("entities")
    .select("id, world_id, slug, name, entity_kind, aliases, version, created_at, updated_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as EntitySummary | null;
}

/**
 * Met a jour uniquement si la version fournie correspond encore a celle en
 * base (concurrence optimiste) ; jamais le slug, qui reste stable apres
 * renommage. `null` en retour signifie version perimee, pas une erreur.
 */
export async function updateEntityWithVersionCheck(
  supabase: TypedClient,
  params: {
    id: string;
    expectedVersion: number;
    name: string;
    entityKind: string;
    aliases: string[];
  }
): Promise<EntitySummary | null> {
  const { data, error } = await supabase
    .from("entities")
    .update({
      name: params.name,
      entity_kind: params.entityKind,
      aliases: params.aliases,
      version: params.expectedVersion + 1,
    })
    .eq("id", params.id)
    .eq("version", params.expectedVersion)
    .select("id, world_id, slug, name, entity_kind, aliases, version, created_at, updated_at")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as EntitySummary | null;
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
    changedBy: string;
  }
): Promise<void> {
  const { error } = await supabase.from("entity_revisions").insert({
    entity_id: params.entityId,
    revision_number: params.revisionNumber,
    snapshot: params.snapshot,
    change_source: params.changeSource,
    changed_by: params.changedBy,
  });
  if (error) throw new Error(error.message);
}

export interface EntitySearchResult {
  id: string;
  name: string;
  slug: string;
  entity_kind: string;
}

/**
 * Recherche via `search_fr` (nom, alias, resume — docs/BACKLOG.md V0-06).
 * `search_entities` est `security invoker` : la RLS de `entities`
 * s'applique normalement, aucune entite hors des mondes de l'appelant
 * n'est jamais renvoyee (migration 20260801110001).
 */
export async function searchEntitiesInWorld(
  supabase: TypedClient,
  worldId: string,
  query: string
): Promise<EntitySearchResult[]> {
  const { data, error } = await supabase.rpc("search_entities", {
    p_world_id: worldId,
    p_query: query,
  });
  if (error) throw new Error(error.message);
  return data;
}
