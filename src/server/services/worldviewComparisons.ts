import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { zWorldviewBlockData } from "@/src/core/schemas/blocks/worldview";
import type { WorldviewPoleKey } from "@/src/core/psyche/keys";
import { listBlocksByTypeForEntities } from "@/src/server/repos/blocks";
import { filtrerBlocsVisibles } from "@/src/server/services/blocks";
import { searchEntities } from "@/src/server/services/entities";
import { listVisibleRelations } from "@/src/server/services/relations";
import { buildViewerForWorld } from "@/src/server/services/visibility";

type TypedClient = SupabaseClient<Database>;

/**
 * V3.1-70 — « Comparer avec » du bloc Convictions : les fiches dont on peut
 * poser les convictions à côté de celles de la fiche ouverte.
 *
 * Règle 5 : les valeurs d'une faction ne partent que si SON bloc Convictions
 * est visible du lecteur — le filtre est celui de tous les blocs
 * (`filtrerBlocsVisibles`), appliqué ici avant l'envoi. Une fiche sans bloc
 * visible n'est pas proposée du tout.
 */

/** Les relations qui rattachent une fiche à une faction, dans un sens ou dans l'autre (la relation est stockée une fois, son inverse se lit par la direction). */
const RELATIONS_DE_FACTION = new Set(["member_of", "serves", "leads"]);

export interface WorldviewComparison {
  entityId: string;
  name: string;
  slug: string;
  poles: { key: WorldviewPoleKey; value: number }[];
}

/** Les convictions visibles du lecteur pour ces fiches ; celles qui n'en ont pas de visible disparaissent. */
async function convictionsVisibles(
  supabase: TypedClient,
  params: { worldId: string; userId: string; candidates: { id: string; name: string; slug: string }[] }
): Promise<WorldviewComparison[]> {
  if (params.candidates.length === 0) return [];
  const [rows, viewer] = await Promise.all([
    listBlocksByTypeForEntities(
      supabase,
      params.candidates.map((c) => c.id),
      "worldview"
    ),
    buildViewerForWorld(supabase, params.worldId, params.userId),
  ]);
  const parBloc = new Map<string, WorldviewComparison["poles"]>();
  for (const row of filtrerBlocsVisibles(rows, viewer)) {
    const parsed = zWorldviewBlockData.safeParse(row.data);
    if (parsed.success) parBloc.set(row.entity_id, parsed.data.poles.map(({ key, value }) => ({ key, value })));
  }
  return params.candidates
    .filter((c) => parBloc.has(c.id))
    .map((c) => ({ entityId: c.id, name: c.name, slug: c.slug, poles: parBloc.get(c.id)! }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/** Les factions reliées à la fiche (membre de, sert, dirige — et leurs inverses), qui ont des convictions visibles du lecteur, triées par nom. */
export async function listLinkedWorldviewComparisons(
  supabase: TypedClient,
  params: { worldId: string; entityId: string; userId: string }
): Promise<WorldviewComparison[]> {
  const relations = await listVisibleRelations(supabase, params.worldId, params.entityId, params.userId);
  const vues = new Map<string, { id: string; name: string; slug: string }>();
  for (const r of relations) {
    if (!RELATIONS_DE_FACTION.has(r.relationType) || r.other.id === params.entityId) continue;
    vues.set(r.other.id, { id: r.other.id, name: r.other.name, slug: r.other.slug });
  }
  return convictionsVisibles(supabase, { worldId: params.worldId, userId: params.userId, candidates: [...vues.values()] });
}

/** « Autre… » : la recherche parmi les fiches visibles du lecteur (`searchEntities`) qui ont des convictions visibles. */
export async function searchWorldviewComparisons(
  supabase: TypedClient,
  params: { worldId: string; entityId: string; userId: string; query: string }
): Promise<WorldviewComparison[]> {
  const trouvees = (await searchEntities(supabase, params.worldId, params.query, params.userId)).filter((e) => e.id !== params.entityId);
  return convictionsVisibles(supabase, {
    worldId: params.worldId,
    userId: params.userId,
    candidates: trouvees.slice(0, 20).map((e) => ({ id: e.id, name: e.name, slug: e.slug })),
  });
}
