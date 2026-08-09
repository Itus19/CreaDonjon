import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { generateShareToken, hashShareToken } from "@/src/core/shareLinks/token";
import { hashSharePassword } from "@/src/core/shareLinks/password";
import {
  type ShareLinkRow,
  insertShareLink,
  listActiveShareLinksForWorld,
  revokeShareLink as repoRevokeShareLink,
} from "@/src/server/repos/shareLinks";

type TypedClient = SupabaseClient<Database>;

/** Forme exposee au client : jamais `password_hash` en clair, seulement le fait qu'un mot de passe existe. */
export interface ShareLinkSummary {
  id: string;
  worldId: string;
  scope: string;
  expiresAt: string | null;
  createdAt: string;
  hasPassword: boolean;
}

function toSummary(row: ShareLinkRow): ShareLinkSummary {
  return {
    id: row.id,
    worldId: row.world_id,
    scope: row.scope,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    hasPassword: row.password_hash !== null,
  };
}

export async function listShareLinks(supabase: TypedClient, worldId: string): Promise<ShareLinkSummary[]> {
  const rows = await listActiveShareLinksForWorld(supabase, worldId);
  return rows.map(toSummary);
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
  params: { worldId: string; createdBy: string; password?: string },
): Promise<{ token: string; link: ShareLinkRow }> {
  const token = generateShareToken();
  const link = await insertShareLink(supabase, {
    worldId: params.worldId,
    tokenHash: hashShareToken(token),
    scope: "public_only",
    createdBy: params.createdBy,
    passwordHash: params.password ? hashSharePassword(params.password) : null,
  });
  return { token, link };
}

export async function revokeShareLink(
  supabase: TypedClient,
  params: { id: string; worldId: string },
): Promise<void> {
  await repoRevokeShareLink(supabase, params);
}
