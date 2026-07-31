import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { PartOfEdge } from "@/src/core/entity-tree/build-tree";

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
