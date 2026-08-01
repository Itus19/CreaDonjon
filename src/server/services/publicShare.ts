import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";
import { filterBlocks, filterSegments, type VisibilityLevel } from "@/src/core/visibility";
import type { BlockDisplay } from "@/src/core/schemas/blocks/envelope";
import { zTextBlockData } from "@/src/core/schemas/blocks/text";
import { type BlockRow, listBlocksForEntity } from "@/src/server/repos/blocks";
import { type EntitySummary, getEntityBySlug, listEntitiesForWorld } from "@/src/server/repos/entities";

type TypedClient = SupabaseClient<Database>;

export interface ResolvedShareLink {
  worldId: string;
  worldName: string;
  worldSlug: string;
  scope: string;
}

/**
 * Passe par la fonction `security definer` public.resolve_share_link
 * (migration 20260801140001) : fonctionne meme sans session (le client
 * anon suffit, la fonction est grantee a `anon`). `null` couvre aussi bien
 * "jamais existe" que "expire"/"revoque" — jamais de distinction cote
 * appelant (docs/BACKLOG.md V0-07, ne pas reveler qu'un lien a existe).
 */
export async function resolveShareLink(
  supabase: TypedClient,
  token: string,
): Promise<ResolvedShareLink | null> {
  const { data, error } = await supabase.rpc("resolve_share_link", { p_token: token });
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) return null;
  return { worldId: row.world_id, worldName: row.world_name, worldSlug: row.world_slug, scope: row.scope };
}

/**
 * Les entites elles-memes ne portent pas de visibilite propre (SCHEMA.md
 * §5) — seuls leurs blocs/segments en portent une. Un visiteur anonyme
 * voit donc la meme liste de noms qu'un membre du monde sans droit
 * particulier ; rien de nouveau introduit par le partage, meme
 * comportement que l'existant pour un world_role="viewer".
 */
export async function listPublicEntities(
  supabase: TypedClient,
  worldId: string,
): Promise<EntitySummary[]> {
  return listEntitiesForWorld(supabase, worldId);
}

export interface PublicBlock {
  id: string;
  blockType: string;
  display: BlockDisplay;
  data: Json;
  displayOrder: number;
}

function filterTextBlockSegments(blockType: string, data: Json): Json {
  if (blockType !== "text") return data;
  const parsed = zTextBlockData.safeParse(data);
  if (!parsed.success) return data;
  // Segment.visibility n'a pas de createdBy (aucun segment ne le suit
  // aujourd'hui) : "private" ne peut donc jamais se resoudre a vrai pour
  // personne, deja le cas avant ce ticket — pas une regression introduite
  // ici, juste la premiere fois que filterSegments s'execute pour de vrai.
  const aware = parsed.data.segments.map((segment) => ({
    ...segment,
    visibility: { ...segment.visibility, createdBy: null },
  }));
  const segments = filterSegments(aware, { kind: "anonymous" }).map(({ visibility, ...rest }) => ({
    ...rest,
    visibility: { level: visibility.level, scopeId: visibility.scopeId },
  }));
  return { ...parsed.data, segments } as unknown as Json;
}

function toVisibilityAware(row: BlockRow) {
  return {
    ...row,
    visibility: {
      level: row.visibility_level as VisibilityLevel,
      scopeId: row.visibility_scope_id,
      createdBy: row.created_by,
    },
  };
}

/**
 * Entite + blocs filtres pour un visiteur anonyme (Viewer={kind:"anonymous"},
 * src/core/visibility) : la meme fonction pure canSee que pour tout autre
 * lecteur, jamais reimplementee en SQL — un seul endroit ou une visibilite
 * peut fuir, deja teste exhaustivement.
 */
export async function getPublicEntityDetail(
  supabase: TypedClient,
  worldId: string,
  entitySlug: string,
): Promise<{ entity: EntitySummary; blocks: PublicBlock[] } | null> {
  const entity = await getEntityBySlug(supabase, worldId, entitySlug);
  if (!entity) return null;

  const rows = await listBlocksForEntity(supabase, entity.id);
  const visible = filterBlocks(rows.map(toVisibilityAware), { kind: "anonymous" });
  const blocks: PublicBlock[] = visible
    .map((row) => ({
      id: row.id,
      blockType: row.block_type,
      display: row.display as unknown as BlockDisplay,
      // Un bloc `text` peut lui-meme etre public tout en contenant un
      // segment gm (SCHEMA.md §7.1, exemple Bram) : la visibilite du bloc
      // ne suffit pas, chaque segment est filtre a son tour avant de
      // jamais quitter le serveur.
      data: filterTextBlockSegments(row.block_type, row.data),
      displayOrder: row.display_order,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return { entity, blocks };
}
