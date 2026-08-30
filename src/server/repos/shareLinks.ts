import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";

type TypedClient = SupabaseClient<Database>;

export interface ShareLinkRow {
  id: string;
  world_id: string;
  scope: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  password_hash: string | null;
  token: string | null;
  /** V2-M10 (Lot M) : alias court (nom de campagne slugifie), `public_only` seulement — `null` pour un lien `players` ou cree avant cette fonctionnalite. */
  slug: string | null;
}

const SHARE_LINK_COLUMNS = "id, world_id, scope, expires_at, revoked_at, created_at, password_hash, token, slug";

/** Actifs seulement (ni expires ni revoques) : geres depuis le monde par un membre — RLS share_links_select (is_world_member). */
export async function listActiveShareLinksForWorld(
  supabase: TypedClient,
  worldId: string,
): Promise<ShareLinkRow[]> {
  const { data, error } = await supabase
    .from("share_links")
    .select(SHARE_LINK_COLUMNS)
    .eq("world_id", worldId)
    .is("revoked_at", null)
    .or("expires_at.is.null,expires_at.gt.now()")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as ShareLinkRow[];
}

export async function insertShareLink(
  supabase: TypedClient,
  params: {
    worldId: string;
    token: string;
    tokenHash: string;
    scope: string;
    createdBy: string;
    passwordHash?: string | null;
    slug?: string | null;
  },
): Promise<ShareLinkRow> {
  const { data, error } = await supabase
    .from("share_links")
    .insert({
      world_id: params.worldId,
      token: params.token,
      token_hash: params.tokenHash,
      scope: params.scope,
      created_by: params.createdBy,
      password_hash: params.passwordHash ?? null,
      slug: params.slug ?? null,
    })
    .select(SHARE_LINK_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as ShareLinkRow;
}

/** V2-M10 (Lot M) : unicite globale du slug (colonne `unique`, table non partitionnee par monde) — meme motif que `ownerHasSlug` pour les mondes. */
export async function shareLinkSlugExists(supabase: TypedClient, slug: string): Promise<boolean> {
  const { data, error } = await supabase.from("share_links").select("id").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

/** Idempotent : revoquer un lien deja revoque ne change rien (pas d'erreur). */
export async function revokeShareLink(
  supabase: TypedClient,
  params: { id: string; worldId: string },
): Promise<void> {
  const { error } = await supabase
    .from("share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("world_id", params.worldId);
  if (error) throw new Error(error.message);
}
