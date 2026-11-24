import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { zEquippableBlockData, type EquippableBlockData } from "@/src/core/schemas/blocks/equippable";
import { listEquippableBlocksForEntities } from "@/src/server/repos/blocks";

type TypedClient = SupabaseClient<Database>;

/** AG-19 : par identifiant de fiche, le nom de l'artéfact et son bloc « Objet équipable ». */
export type ArtefactsEquipables = Record<string, { name: string; data: EquippableBlockData }>;

/**
 * AG-19 (ADR 0107) — les artéfacts d'un sac qui agissent sur la fiche : une
 * requête, seulement s'il y a des objets qui pointent vers une fiche du wiki.
 * Un bloc mal formé est écarté et journalisé, jamais compté à moitié.
 */
export async function chargerArtefacts(supabase: TypedClient, entityIds: readonly string[]): Promise<ArtefactsEquipables> {
  const ids = [...new Set(entityIds)].slice(0, 50);
  const rows = await listEquippableBlocksForEntities(supabase, ids);
  const artefacts: ArtefactsEquipables = {};
  for (const row of rows) {
    if (artefacts[row.entityId]) continue;
    const parsed = zEquippableBlockData.safeParse(row.data);
    if (!parsed.success) {
      console.error("Bloc « Objet équipable » mal formé, ignoré", row.entityId, parsed.error.issues);
      continue;
    }
    artefacts[row.entityId] = { name: row.name, data: parsed.data };
  }
  return artefacts;
}
