import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { zGeneratedWorldBlockData, type GeneratedWorldBlockData } from "@/src/core/schemas/blocks/generatedWorld";
import { defaultBlockDisplay } from "@/src/core/schemas/blocks/registry";
import { WORLD_TIMELINE_KIND } from "@/src/core/timeline/worldTimeline";
import { sitesToReveal } from "@/src/core/worldgen/reveal";
import { listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
import { getEntityById, listEntitiesByKinds } from "@/src/server/repos/entities";
import { insertImportedBlocks, insertImportedRelations } from "@/src/server/repos/worldExport";
import { updateBlockContent } from "@/src/server/services/blocks";
import { createImportedEntities } from "@/src/server/services/entities";
import { isWorldAdmin } from "@/src/server/services/permissions";

type TypedClient = SupabaseClient<Database>;

/** Au plus tant de villes par geste : une poignée de pages, jamais une région entière d'un coup (docs/QUOTAS.md). */
export const REVEAL_MAX_PLACES = 30;

export type RevealResult =
  | { ok: true; created: { id: string; slug: string; name: string }[] }
  | { ok: false; reason: "forbidden" | "not_found" | "no_map" | "not_on_map" | "conflict" };

/**
 * G-7b — fait naître les pages des villes autour d'un lieu, depuis la carte
 * gardée à la création du monde (bloc `generated_world`, choix de l'auteur du
 * 26 novembre 2026). Réservé au MJ du monde ; en attendant que le tour solo
 * le fasse seul (G-4).
 *
 * Chaque ville reçoit sa page masquée, son bloc Ville réservé au MJ (mêmes
 * agrégats, même graine : elle est la même qu'à l'import) et son rattachement
 * à son État. La carte retient ensuite qu'elle a sa page : un second geste ne
 * la double pas. Si la carte a changé entre-temps (deux gestes à la fois), la
 * mise à jour est refusée par la version du bloc.
 */
export async function revealPlacesAround(
  supabase: TypedClient,
  params: { worldId: string; userId: string; entityId: string; radiusKm: number }
): Promise<RevealResult> {
  // Refusé avant introuvable (SECURITE.md §2) : rien ne se lit sans être MJ de ce monde.
  if (!(await isWorldAdmin(supabase, { worldId: params.worldId, userId: params.userId }))) return { ok: false, reason: "forbidden" };
  const entity = await getEntityById(supabase, params.entityId);
  if (!entity || entity.world_id !== params.worldId) return { ok: false, reason: "not_found" };

  const [timeline] = await listEntitiesByKinds(supabase, params.worldId, [WORLD_TIMELINE_KIND]);
  if (!timeline) return { ok: false, reason: "no_map" };
  const [block] = await listBlocksByTypeForEntities(supabase, [timeline.id], "generated_world");
  if (!block) return { ok: false, reason: "no_map" };
  const map: GeneratedWorldBlockData = zGeneratedWorldBlockData.parse(block.data);

  const origin = map.places.find((p) => p.entity.id === entity.id);
  if (!origin) return { ok: false, reason: "not_on_map" };

  const placed = new Set(map.places.map((p) => p.siteId));
  const siteIds = sitesToReveal(map.world, origin.siteId, { radiusKm: params.radiusKm, placed, max: REVEAL_MAX_PLACES });
  if (siteIds.length === 0) return { ok: true, created: [] };

  const siteById = new Map(map.world.sites.map((s) => [s.id, s]));
  const sites = siteIds.map((id) => siteById.get(id)).filter((s) => s !== undefined);
  const created = await createImportedEntities(supabase, {
    worldId: params.worldId,
    createdBy: params.userId,
    items: sites.map((s) => ({ entityKind: "location", name: s.name, aliases: [] })),
    freshWorld: false,
  });

  await insertImportedBlocks(
    supabase,
    sites.map((s, k) => ({
      entityId: created[k].id,
      blockType: "settlement",
      display: defaultBlockDisplay("settlement", "Ville") as unknown as Json,
      data: { ...s.settlement, siteId: s.id } as unknown as Json,
      displayOrder: 0,
      visibilityLevel: "gm",
      createdBy: params.userId,
    }))
  );

  const factionOf = new Map(map.factions.map((f) => [f.stateId, f.entity.id]));
  await insertImportedRelations(
    supabase,
    sites.flatMap((s, k) => {
      const factionId = s.stateId === null ? undefined : factionOf.get(s.stateId);
      return factionId
        ? [{ worldId: params.worldId, sourceEntityId: created[k].id, targetEntityId: factionId, relationType: "part_of", visibilityLevel: "gm", createdBy: params.userId }]
        : [];
    })
  );

  // Les pages existent : la carte doit le retenir. Si un autre geste l'a
  // modifiée entre-temps, on relit et on ajoute à sa version, deux fois au plus.
  const newPlaces = sites.map((s, k) => ({ siteId: s.id, entity: { kind: "entity" as const, id: created[k].id } }));
  let current = block;
  for (let attempt = 0; attempt < 3; attempt++) {
    const base = attempt === 0 ? map : zGeneratedWorldBlockData.parse(current.data);
    const known = new Set(base.places.map((p) => p.siteId));
    const next: GeneratedWorldBlockData = { ...base, places: [...base.places, ...newPlaces.filter((p) => !known.has(p.siteId))] };
    const saved = await updateBlockContent(supabase, {
      id: current.id,
      expectedVersion: current.version,
      display: current.display,
      data: next,
      visibilityLevel: current.visibility_level,
      visibilityScopeId: current.visibility_scope_id,
      changedBy: params.userId,
    });
    if (saved.ok) return { ok: true, created: created.map((e) => ({ id: e.id, slug: e.slug, name: e.name })) };
    if (saved.reason !== "conflict") return { ok: false, reason: saved.reason === "not_found" ? "no_map" : "forbidden" };
    const [reread] = await listBlocksByTypeForEntities(supabase, [timeline.id], "generated_world");
    if (!reread) return { ok: false, reason: "no_map" };
    current = reread;
  }
  return { ok: false, reason: "conflict" };
}
