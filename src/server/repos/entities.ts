import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { ENTITY_KINDS } from "@/lib/entities/schemas";

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

/** Singleton par monde pour un `entity_kind` donne (V2-J1 Phase 2, "Générateurs de MJ") — contrairement a `findEntityByCreatorAndKind`, jamais filtre par createur : un seul MJ reel par monde (Lot M), mais peu importe quel compte admin l'a creee la premiere fois. */
export async function findEntityByKind(supabase: TypedClient, worldId: string, entityKind: string): Promise<EntitySummary | null> {
  const { data, error } = await supabase
    .from("entities")
    .select(ENTITY_COLUMNS)
    .eq("world_id", worldId)
    .eq("entity_kind", entityKind)
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

/**
 * `public.world_has_slug` (RPC, row_security off) plutot qu'un `.from()`
 * normal — bug reel trouve en testant le retablissement d'une fiche
 * supprimee : `entities_select` masque les lignes `deleted_at is not
 * null`, donc un `.from("entities")` classique ne voit jamais le slug
 * d'une fiche supprimee comme "pris", alors que la contrainte d'unicite
 * Postgres (`entities_world_id_slug_key`) ne filtre jamais par
 * `deleted_at` — une fiche supprimee garde son slug pour toujours (ADR
 * 0019, necessaire pour la retablir). `generateUniqueEntitySlug`
 * proposait donc parfois un slug deja pris par une fiche supprimee,
 * echouant en 500 brut a l'ecriture au lieu d'en proposer un autre.
 */
export async function worldHasSlug(
  supabase: TypedClient,
  worldId: string,
  slug: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("world_has_slug", { p_world_id: worldId, p_slug: slug });
  if (error) throw new Error(error.message);
  return data === true;
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
 * Passe par la fonction Postgres `app.soft_delete_entity` (RPC) plutot
 * qu'un `.update()` direct — retour utilisateur, "certaines fiches" ne se
 * supprimaient jamais (500 "new row violates row-level security policy").
 * Cause reelle, trouvee en isolant chaque hypothese en direct : poser
 * `deleted_at = now()` rend la ligne invisible pour `entities_select`
 * (`deleted_at is null AND is_world_member(...)`) — Postgres exige,
 * pour un UPDATE, que la ligne PROPOSEE satisfasse aussi la politique
 * SELECT de la table, en plus de la politique UPDATE elle-meme (confirme
 * en rendant `entities_update` totalement permissif sans que ca change
 * quoi que ce soit, puis en desactivant entierement la RLS sur `entities`,
 * ce qui la seule chose qui a resolu le probleme). Un conflit structurel :
 * une politique SELECT qui masque les lignes supprimees entre TOUJOURS en
 * conflit avec une suppression douce faite par un simple UPDATE, quelle
 * que soit la politique UPDATE — jamais reparable en ajustant `.select()`
 * ou `count` cote client, contrairement a ce qu'un premier correctif
 * (a718877) avait suppose. `app.soft_delete_entity` contourne ce conflit
 * via `set row_security = off`, en verifiant le droit d'edition
 * explicitement a l'interieur (`app.can_edit_entity`, jamais relache).
 */
export async function softDeleteEntity(supabase: TypedClient, id: string): Promise<{ deleted: boolean }> {
  const { data, error } = await supabase.rpc("soft_delete_entity", { p_entity_id: id });
  if (error) throw new Error(error.message);
  return { deleted: data === true };
}

export interface DeletedEntitySummary {
  id: string;
  name: string;
  slug: string;
  entityKind: string;
  deletedAt: string;
}

/** Retour utilisateur (Journal d'historique, "rétablir une fiche supprimée") — `public.list_deleted_entities` (RPC, row_security off) : `entities_select` masque justement les lignes `deleted_at is not null`, un `.from("entities")` normal n'en verrait jamais aucune. Reserve au MJ du monde (verifie a l'interieur de la fonction, `app.is_world_admin`). */
export async function listDeletedEntities(supabase: TypedClient, worldId: string): Promise<DeletedEntitySummary[]> {
  const { data, error } = await supabase.rpc("list_deleted_entities", { p_world_id: worldId });
  if (error) throw new Error(error.message);
  return data.map((row) => ({ id: row.id, name: row.name, slug: row.slug, entityKind: row.entity_kind, deletedAt: row.deleted_at }));
}

/**
 * Symetrique de `softDeleteEntity` — meme patron RPC, mais son "forbidden"
 * interne (`app.can_edit_entity`) est ICI la vraie barriere (pas une
 * defense en profondeur redondante) : contrairement a `deleteEntity`,
 * impossible de pre-verifier via `getEntityById` avant coup, la fiche
 * etant justement invisible sous RLS tant qu'elle reste supprimee.
 * "slug_conflict" (Postgres 23505) : une autre fiche a repris le meme
 * slug pendant que celle-ci etait supprimee — la contrainte d'unicite
 * `entities(world_id, slug)` ne filtre jamais par `deleted_at`.
 */
export async function restoreEntity(
  supabase: TypedClient,
  id: string
): Promise<{ ok: true; restored: boolean } | { ok: false; reason: "forbidden" | "slug_conflict" }> {
  const { data, error } = await supabase.rpc("restore_entity", { p_entity_id: id });
  if (error) {
    if (error.code === "23505") return { ok: false, reason: "slug_conflict" };
    if (error.code === "42501") return { ok: false, reason: "forbidden" };
    throw new Error(error.message);
  }
  return { ok: true, restored: data === true };
}

/** Categories personnalisees deja utilisees dans ce monde (V2-G7) : pour qu'une deuxieme fiche puisse rejoindre la meme categorie plutot que d'en recreer une a chaque fois. */
export async function listCustomEntityKindsForWorld(supabase: TypedClient, worldId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("entities")
    .select("entity_kind")
    .eq("world_id", worldId)
    .is("deleted_at", null)
    .not("entity_kind", "in", `(${ENTITY_KINDS.join(",")})`);
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
