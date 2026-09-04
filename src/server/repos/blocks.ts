import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface BlockRow {
  id: string;
  entity_id: string;
  block_type: string;
  display: Json;
  data: Json;
  display_order: number;
  version: number;
  visibility_level: string;
  visibility_scope_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const BLOCK_COLUMNS =
  "id, entity_id, block_type, display, data, display_order, version, visibility_level, visibility_scope_id, created_by, created_at, updated_at";

export async function listBlocksForEntity(supabase: TypedClient, entityId: string): Promise<BlockRow[]> {
  const { data, error } = await supabase
    .from("blocks")
    .select(BLOCK_COLUMNS)
    .eq("entity_id", entityId)
    .order("display_order");
  if (error) throw new Error(error.message);
  return data as BlockRow[];
}

/** Vue generale du monde (V2-H2) : tous les blocs d'un type donne parmi une liste d'entites — pas de `world_id` sur `blocks`, l'appelant fournit deja les entites du monde (`listEntitiesForWorld`) plutot qu'une jointure ici. */
export async function listBlocksByTypeForEntities(
  supabase: TypedClient,
  entityIds: string[],
  blockType: string
): Promise<BlockRow[]> {
  if (entityIds.length === 0) return [];
  const { data, error } = await supabase
    .from("blocks")
    .select(BLOCK_COLUMNS)
    .in("entity_id", entityIds)
    .eq("block_type", blockType);
  if (error) throw new Error(error.message);
  return data as BlockRow[];
}

export interface BlockVisibilityRow {
  entity_id: string;
  visibility_level: string;
  visibility_scope_id: string | null;
  created_by: string | null;
}

/**
 * Retour utilisateur : des fiches censees etre invisibles a un joueur
 * apparaissaient quand meme (liste "lien vers une fiche", sommaire du
 * wiki joueur) — `otherEntities`/l'arborescence ne filtraient jusqu'ici
 * QUE par appartenance au monde, jamais par visibilite (les entites
 * elles-memes n'ont pas de niveau de visibilite propre, seuls leurs
 * blocs en ont un). Une seule requete pour tout le monde (meme motif que
 * `listBlocksByTypeForEntities` : l'appelant fournit deja les entites du
 * monde, jamais une jointure sur `blocks` qui n'a pas de `world_id`) —
 * l'appelant determine ensuite, par entite, si AU MOINS un bloc est
 * visible a ce viewer (`canSee`), la definition retenue de "fiche
 * visible a un joueur" en l'absence de visibilite propre a l'entite.
 */
export async function listBlockVisibilityForEntities(supabase: TypedClient, entityIds: string[]): Promise<BlockVisibilityRow[]> {
  if (entityIds.length === 0) return [];
  const { data, error } = await supabase
    .from("blocks")
    .select("entity_id, visibility_level, visibility_scope_id, created_by")
    .in("entity_id", entityIds);
  if (error) throw new Error(error.message);
  return data;
}

export async function getBlockById(supabase: TypedClient, id: string): Promise<BlockRow | null> {
  const { data, error } = await supabase
    .from("blocks")
    .select(BLOCK_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as BlockRow | null;
}

/** Le plus grand `display_order` actuel de l'entite, pour ajouter un bloc en fin de liste. */
export async function maxDisplayOrder(supabase: TypedClient, entityId: string): Promise<number> {
  const { data, error } = await supabase
    .from("blocks")
    .select("display_order")
    .eq("entity_id", entityId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.display_order ?? 0;
}

export async function insertBlock(
  supabase: TypedClient,
  params: {
    entityId: string;
    blockType: string;
    display: Json;
    data: Json;
    displayOrder: number;
    visibilityLevel: string;
    visibilityScopeId: string | null;
    createdBy: string;
  }
): Promise<BlockRow> {
  const { data, error } = await supabase
    .from("blocks")
    .insert({
      entity_id: params.entityId,
      block_type: params.blockType,
      display: params.display,
      data: params.data,
      display_order: params.displayOrder,
      visibility_level: params.visibilityLevel,
      visibility_scope_id: params.visibilityScopeId,
      created_by: params.createdBy,
    })
    .select(BLOCK_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as BlockRow;
}

/**
 * Insere un bloc `generator` de section, silencieux si un autre appel
 * concurrent l'a deja cree entre-temps (V2-J9) — `ensureGeneratorToolsEntity`
 * (src/server/services/entities.ts) relit les cles existantes puis boucle
 * sur les sections manquantes ; deux appels presque simultanes peuvent lire
 * le meme etat avant que l'un des deux n'ecrive, d'ou une vraie collision
 * possible malgre l'idempotence apparente du code applicatif. L'index
 * unique `blocks_generator_section_key_uniq` (migration
 * 20260904150000) est le seul garde-fou fiable ; ce repo se contente de
 * ne pas transformer sa violation (23505) en erreur — le bloc existe deja,
 * c'est exactement le resultat voulu.
 */
export async function insertGeneratorSectionBlockIfMissing(
  supabase: TypedClient,
  params: {
    entityId: string;
    display: Json;
    data: Json;
    displayOrder: number;
    visibilityLevel: string;
    visibilityScopeId: string | null;
    createdBy: string;
  }
): Promise<void> {
  const { error } = await supabase.from("blocks").insert({
    entity_id: params.entityId,
    block_type: "generator",
    display: params.display,
    data: params.data,
    display_order: params.displayOrder,
    visibility_level: params.visibilityLevel,
    visibility_scope_id: params.visibilityScopeId,
    created_by: params.createdBy,
  });
  if (error && error.code !== "23505") throw new Error(error.message);
}

/** `null` en retour signifie version perimee (concurrence optimiste), pas une erreur. */
export async function updateBlockWithVersionCheck(
  supabase: TypedClient,
  params: {
    id: string;
    expectedVersion: number;
    display: Json;
    data: Json;
    visibilityLevel: string;
    visibilityScopeId: string | null;
  }
): Promise<BlockRow | null> {
  const { data, error } = await supabase
    .from("blocks")
    .update({
      display: params.display,
      data: params.data,
      visibility_level: params.visibilityLevel,
      visibility_scope_id: params.visibilityScopeId,
      version: params.expectedVersion + 1,
    })
    .eq("id", params.id)
    .eq("version", params.expectedVersion)
    .select(BLOCK_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as BlockRow | null;
}

/**
 * Reordonnancement : une seule colonne, une seule ligne (docs/BACKLOG.md
 * V0-04). `display_order` est un `numeric` : inserer entre le 3e et le 4e
 * bloc s'ecrit 3.5, jamais une reecriture de toute la liste.
 */
export async function updateBlockDisplayOrder(
  supabase: TypedClient,
  params: { id: string; expectedVersion: number; displayOrder: number }
): Promise<BlockRow | null> {
  const { data, error } = await supabase
    .from("blocks")
    .update({ display_order: params.displayOrder, version: params.expectedVersion + 1 })
    .eq("id", params.id)
    .eq("version", params.expectedVersion)
    .select(BLOCK_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as BlockRow | null;
}

export async function deleteBlock(supabase: TypedClient, id: string): Promise<void> {
  const { error } = await supabase.from("blocks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
