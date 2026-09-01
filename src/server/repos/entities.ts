import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface EntitySummary {
  id: string;
  world_id: string;
  slug: string;
  name: string;
  entity_kind: string;
  aliases: string[];
  version: number;
  display_order: number;
  created_at: string;
  updated_at: string;
  /** Visibilite generale de la fiche (V2, retour utilisateur point 2) — bascule binaire, jamais les 6 niveaux de `visibility_level`. */
  is_public: boolean;
  /** V2-M7b (Lot M) : necessaire pour reconnaitre sa propre fiche de notes privee (`canEditEntity`) et pour la masquer de la sidebar des autres comptes (`getEntityTree`). */
  created_by: string | null;
}

const ENTITY_COLUMNS =
  "id, world_id, slug, name, entity_kind, aliases, version, display_order, created_at, updated_at, is_public, created_by";

export async function listEntitiesForWorld(
  supabase: TypedClient,
  worldId: string
): Promise<EntitySummary[]> {
  const { data, error } = await supabase
    .from("entities")
    .select(ENTITY_COLUMNS)
    .eq("world_id", worldId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as EntitySummary[];
}

/** Plusieurs entites par id, en un seul aller-retour (resolution de references de bloc, V1-B2). Silencieusement absentes du resultat si supprimees ou hors du monde attendu — au caller de filtrer par world_id. */
export async function listEntitiesByIds(supabase: TypedClient, ids: string[]): Promise<EntitySummary[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("entities")
    .select(ENTITY_COLUMNS)
    .in("id", ids)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return data as EntitySummary[];
}

/** V2-M7b (Lot M) : retrouve la fiche de notes privee d'un compte (au plus une par monde, jamais applique aux autres `entity_kind`). */
export async function findEntityByCreatorAndKind(
  supabase: TypedClient,
  params: { worldId: string; createdBy: string; entityKind: string }
): Promise<EntitySummary | null> {
  const { data, error } = await supabase
    .from("entities")
    .select(ENTITY_COLUMNS)
    .eq("world_id", params.worldId)
    .eq("created_by", params.createdBy)
    .eq("entity_kind", params.entityKind)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as EntitySummary | null;
}

export async function getEntityBySlug(
  supabase: TypedClient,
  worldId: string,
  slug: string
): Promise<EntitySummary | null> {
  const { data, error } = await supabase
    .from("entities")
    .select(ENTITY_COLUMNS)
    .eq("world_id", worldId)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as EntitySummary | null;
}

/** Slugs bruts d'un monde, pour calculer le prochain slug numerique (src/core/slug). */
export async function listEntitySlugsForWorld(supabase: TypedClient, worldId: string): Promise<string[]> {
  const { data, error } = await supabase.from("entities").select("slug").eq("world_id", worldId);
  if (error) throw new Error(error.message);
  return data.map((row) => row.slug);
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

/** Rang de glisser-depose (V2-G9) pour une nouvelle fiche de ce type : en dessous de la derniere, jamais 0 (qui la ferait apparaitre en tete apres le premier reordonnancement du groupe). */
export async function maxEntityDisplayOrderForKind(
  supabase: TypedClient,
  worldId: string,
  entityKind: string
): Promise<number> {
  const { data, error } = await supabase
    .from("entities")
    .select("display_order")
    .eq("world_id", worldId)
    .eq("entity_kind", entityKind)
    .is("deleted_at", null)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.display_order ?? 0;
}

export async function insertEntity(
  supabase: TypedClient,
  params: {
    worldId: string;
    createdBy: string;
    slug: string;
    name: string;
    entityKind: string;
    aliases: string[];
    displayOrder: number;
    isPublic: boolean;
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
      aliases: params.aliases,
      display_order: params.displayOrder,
      is_public: params.isPublic,
    })
    .select(ENTITY_COLUMNS)
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
    .select(ENTITY_COLUMNS)
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
    aliases: string[];
    isPublic: boolean;
  }
): Promise<EntitySummary | null> {
  const { data, error } = await supabase
    .from("entities")
    .update({
      name: params.name,
      entity_kind: params.entityKind,
      aliases: params.aliases,
      is_public: params.isPublic,
      version: params.expectedVersion + 1,
    })
    .eq("id", params.id)
    .eq("version", params.expectedVersion)
    .select(ENTITY_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as EntitySummary | null;
}

/**
 * Idempotent : supprimer une entite deja supprimee ne change rien (pas d'erreur), meme convention que revokeShareLink.
 *
 * Pas de `.select()` ici : la policy `entities_select` exige `deleted_at is
 * null`, donc la ligne qu'on vient de marquer supprimee echouerait la
 * verification appliquee par Postgres au `RETURNING` d'un update sous RLS,
 * ce qui leve "new row violates row-level security policy" au lieu de
 * simplement renvoyer 0 ligne. `count: "exact"` donne le meme booleen via
 * `Content-Range`, sans relire la ligne.
 */
export async function softDeleteEntity(supabase: TypedClient, id: string): Promise<{ deleted: boolean }> {
  const { count, error } = await supabase
    .from("entities")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return { deleted: (count ?? 0) > 0 };
}

const FIXED_ENTITY_KINDS = ["character", "location", "faction", "item", "creature", "quest", "event", "other"];

/** Categories personnalisees deja utilisees dans ce monde (V2-G7) : pour qu'une deuxieme fiche puisse rejoindre la meme categorie plutot que d'en recreer une a chaque fois. */
export async function listCustomEntityKindsForWorld(supabase: TypedClient, worldId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("entities")
    .select("entity_kind")
    .eq("world_id", worldId)
    .is("deleted_at", null)
    .not("entity_kind", "in", `(${FIXED_ENTITY_KINDS.join(",")})`);
  if (error) throw new Error(error.message);
  return [...new Set(data.map((row) => row.entity_kind))].sort((a, b) => a.localeCompare(b));
}

export interface EntitySearchResult {
  id: string;
  name: string;
  slug: string;
  entity_kind: string;
}

/**
 * Recherche via `search_fr` (nom, alias, resume — docs/BACKLOG.md V0-06).
 * `search_entities` est `security invoker` : la RLS de `entities`
 * s'applique normalement, aucune entite hors des mondes de l'appelant
 * n'est jamais renvoyee (migration 20260801110001).
 */
export async function searchEntitiesInWorld(
  supabase: TypedClient,
  worldId: string,
  query: string
): Promise<EntitySearchResult[]> {
  const { data, error } = await supabase.rpc("search_entities", {
    p_world_id: worldId,
    p_query: query,
  });
  if (error) throw new Error(error.message);
  return data;
}
