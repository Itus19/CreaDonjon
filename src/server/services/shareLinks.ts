import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { generateShareToken, hashShareToken } from "@/src/core/shareLinks/token";
import {
  type ShareLinkRow,
  insertShareLink,
  listActiveShareLinksForWorld,
  revokeShareLink as repoRevokeShareLink,
} from "@/src/server/repos/shareLinks";

type TypedClient = SupabaseClient<Database>;

export async function listShareLinks(supabase: TypedClient, worldId: string): Promise<ShareLinkRow[]> {
  return listActiveShareLinksForWorld(supabase, worldId);
}

/**
 * Retourne le jeton en clair une seule fois — il n'est jamais stocke
 * (SCHEMA.md §18), donc jamais recuperable apres cet appel. Perdu = un
 * nouveau lien a creer, l'ancien reste valide independamment.
 *
 * `scope` fige a 'public_only' (V0-07) : le filtrage anonyme ne sait
 * aujourd'hui montrer que le contenu public (src/core/visibility, canSee),
 * 'players' attendra que ce cas soit reellement implemente.
 */
export async function createShareLink(
  supabase: TypedClient,
  params: { worldId: string; createdBy: string },
): Promise<{ token: string; link: ShareLinkRow }> {
  const token = generateShareToken();
  const link = await insertShareLink(supabase, {
    worldId: params.worldId,
    tokenHash: hashShareToken(token),
    scope: "public_only",
    createdBy: params.createdBy,
  });
  return { token, link };
}

export async function revokeShareLink(
  supabase: TypedClient,
  params: { id: string; worldId: string },
): Promise<void> {
  await repoRevokeShareLink(supabase, params);
}
