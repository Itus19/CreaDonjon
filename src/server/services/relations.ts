import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { filterBlocks, type VisibilityLevel } from "@/src/core/visibility";
import { relationLabel, type RelationType } from "@/src/core/relations/inverses";
import {
  deleteRelation as repoDeleteRelation,
  insertRelation,
  listRelationsForEntity,
  type InsertRelationResult,
  type OtherEntityRef,
} from "@/src/server/repos/relations";
import { buildViewerForWorld } from "@/src/server/services/visibility";

type TypedClient = SupabaseClient<Database>;

export interface VisibleRelation {
  id: string;
  relationType: string;
  label: string;
  other: OtherEntityRef;
}

export async function listVisibleRelations(
  supabase: TypedClient,
  worldId: string,
  entityId: string,
  userId: string
): Promise<VisibleRelation[]> {
  const [rows, viewer] = await Promise.all([
    listRelationsForEntity(supabase, entityId),
    buildViewerForWorld(supabase, worldId, userId),
  ]);

  const visible = filterBlocks(
    rows.map((r) => ({
      ...r,
      visibility: {
        level: r.visibility_level as VisibilityLevel,
        scopeId: r.visibility_scope_id,
        createdBy: r.created_by,
      },
    })),
    viewer
  );

  return visible.map((r) => ({
    id: r.id,
    relationType: r.relation_type,
    label: relationLabel(r.relation_type as RelationType, r.direction),
    other: r.other,
  }));
}

export async function addRelation(
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
): Promise<InsertRelationResult> {
  return insertRelation(supabase, params);
}

export async function removeRelation(supabase: TypedClient, id: string): Promise<void> {
  await repoDeleteRelation(supabase, id);
}
