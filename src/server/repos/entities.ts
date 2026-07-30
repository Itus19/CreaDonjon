import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import type { NarrativeContent } from "@/src/core/schemas/entities/segments";

type TypedClient = SupabaseClient<Database>;

export interface EntitySummary {
  id: string;
  world_id: string;
  slug: string;
  name: string;
  entity_kind: string;
  summary: string;
  aliases: string[];
  tags: string[];
  narrative_content: NarrativeContent;
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
    .select("id, world_id, slug, name, entity_kind, summary, aliases, tags, narrative_content, version, created_at, updated_at")
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
    .select("id, world_id, slug, name, entity_kind, summary, aliases, tags, narrative_content, version, created_at, updated_at")
    .eq("world_id", worldId)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as EntitySummary | null;
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
    summary: string;
    aliases: string[];
    tags: string[];
    narrativeContent: NarrativeContent;
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
      summary: params.summary,
      aliases: params.aliases,
      tags: params.tags,
      narrative_content: params.narrativeContent,
    })
    .select("id, world_id, slug, name, entity_kind, summary, aliases, tags, narrative_content, version, created_at, updated_at")
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
    .select("id, world_id, slug, name, entity_kind, summary, aliases, tags, narrative_content, version, created_at, updated_at")
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
    summary: string;
    aliases: string[];
    tags: string[];
    narrativeContent: NarrativeContent;
  }
): Promise<EntitySummary | null> {
  const { data, error } = await supabase
    .from("entities")
    .update({
      name: params.name,
      entity_kind: params.entityKind,
      summary: params.summary,
      aliases: params.aliases,
      tags: params.tags,
      narrative_content: params.narrativeContent,
      version: params.expectedVersion + 1,
    })
    .eq("id", params.id)
    .eq("version", params.expectedVersion)
    .select("id, world_id, slug, name, entity_kind, summary, aliases, tags, narrative_content, version, created_at, updated_at")
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
