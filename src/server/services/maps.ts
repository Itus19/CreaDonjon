import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { filterBlocks, type Viewer, type VisibilityLevel } from "@/src/core/visibility";
import { zMapBlockData, type MapBlockData } from "@/src/core/schemas/blocks/map";
import { listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
import { listEntitiesForWorld } from "@/src/server/repos/entities";

type TypedClient = SupabaseClient<Database>;

export interface WorldMapSummary {
  blockId: string;
  version: number;
  visibilityLevel: string;
  visibilityScopeId: string | null;
  entityId: string;
  entityName: string;
  entitySlug: string;
  label: string;
  data: MapBlockData;
}

/**
 * Vue "Cartes" du monde (Lot I, retour utilisateur : "un endroit où je
 * puisse travailler et où [je] pourrai voir la/les cartes en grand") —
 * agrege tous les blocs `map` du monde, meme motif que `getWorldTimeline`
 * (`timeline.ts`) pour la Chronologie : une seule requete groupee par type
 * de bloc, jamais une par entite.
 */
export async function getWorldMaps(supabase: TypedClient, worldId: string, viewer: Viewer): Promise<WorldMapSummary[]> {
  const entities = await listEntitiesForWorld(supabase, worldId);
  const entityById = new Map(entities.map((e) => [e.id, e]));
  const blocks = await listBlocksByTypeForEntities(
    supabase,
    entities.map((e) => e.id),
    "map"
  );

  const visible = filterBlocks(
    blocks.map((b) => ({
      ...b,
      visibility: { level: b.visibility_level as VisibilityLevel, scopeId: b.visibility_scope_id, createdBy: b.created_by },
    })),
    viewer
  );

  const result: WorldMapSummary[] = [];
  for (const block of visible) {
    const entity = entityById.get(block.entity_id);
    if (!entity) continue;
    const parsed = zMapBlockData.safeParse(block.data);
    if (!parsed.success) continue;
    const display = block.display as { label?: unknown } | null;
    result.push({
      blockId: block.id,
      version: block.version,
      visibilityLevel: block.visibility_level,
      visibilityScopeId: block.visibility_scope_id,
      entityId: entity.id,
      entityName: entity.name,
      entitySlug: entity.slug,
      label: typeof display?.label === "string" ? display.label : "Carte",
      data: parsed.data,
    });
  }
  return result;
}
