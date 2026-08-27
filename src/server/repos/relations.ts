import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { PartOfEdge } from "@/src/core/entity-tree/build-tree";
import { FAMILY_RELATION_TYPES, type FamilyRelationType } from "@/src/core/genealogy/buildFamilyTree";

type TypedClient = SupabaseClient<Database>;

export async function listPartOfRelationsForWorld(
  supabase: TypedClient,
  worldId: string
): Promise<PartOfEdge[]> {
  const { data, error } = await supabase
    .from("relations")
    .select("source_entity_id, target_entity_id")
    .eq("world_id", worldId)
    .eq("relation_type", "part_of");
  if (error) throw new Error(error.message);
  return data;
}

export interface FamilyRelationRow {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relation_type: FamilyRelationType;
  visibility_level: string;
  visibility_scope_id: string | null;
  created_by: string | null;
}

/** Toutes les relations "famille" du monde (V2-H3, bloc genealogy) — un seul aller-retour, la construction de l'arbre se fait ensuite en memoire (src/core/genealogy). */
export async function listFamilyRelationsForWorld(
  supabase: TypedClient,
  worldId: string
): Promise<FamilyRelationRow[]> {
  const { data, error } = await supabase
    .from("relations")
    .select("id, source_entity_id, target_entity_id, relation_type, visibility_level, visibility_scope_id, created_by")
    .eq("world_id", worldId)
    .in("relation_type", FAMILY_RELATION_TYPES);
  if (error) throw new Error(error.message);
  return data as FamilyRelationRow[];
}

export interface OtherEntityRef {
  id: string;
  name: string;
  slug: string;
  entity_kind: string;
}

export interface RelationRow {
  id: string;
  relation_type: string;
  visibility_level: string;
  visibility_scope_id: string | null;
  created_by: string | null;
  direction: "out" | "in";
  other: OtherEntityRef;
}

/** Les deux sens (SCHEMA.md §8) : une relation stockee une fois, navigable des deux entites. */
export async function listRelationsForEntity(
  supabase: TypedClient,
  entityId: string
): Promise<RelationRow[]> {
  const [{ data: outgoing, error: outError }, { data: incoming, error: inError }] = await Promise.all([
    supabase
      .from("relations")
      .select(
        "id, relation_type, visibility_level, visibility_scope_id, created_by, other:target_entity_id(id, name, slug, entity_kind)"
      )
      .eq("source_entity_id", entityId),
    supabase
      .from("relations")
      .select(
        "id, relation_type, visibility_level, visibility_scope_id, created_by, other:source_entity_id(id, name, slug, entity_kind)"
      )
      .eq("target_entity_id", entityId),
  ]);
  if (outError) throw new Error(outError.message);
  if (inError) throw new Error(inError.message);

  return [
    ...outgoing.map((r) => ({ ...r, direction: "out" as const, other: r.other as unknown as OtherEntityRef })),
    ...incoming.map((r) => ({ ...r, direction: "in" as const, other: r.other as unknown as OtherEntityRef })),
  ];
}

export async function insertRelation(
  supabase: TypedClient,
  params: {
    worldId: string;
    sourceEntityId: string;
    targetEntityId: string;
    relationType: string;
    visibilityLevel: string;
    visibilityScopeId: string | null;
    createdBy: string;
  }
): Promise<void> {
  const { error } = await supabase.from("relations").insert({
    world_id: params.worldId,
    source_entity_id: params.sourceEntityId,
    target_entity_id: params.targetEntityId,
    relation_type: params.relationType,
    visibility_level: params.visibilityLevel,
    visibility_scope_id: params.visibilityScopeId,
    created_by: params.createdBy,
  });
  if (error) throw new Error(error.message);
}

export async function deleteRelation(supabase: TypedClient, id: string): Promise<void> {
  const { error } = await supabase.from("relations").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
