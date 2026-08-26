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

/**
 * Forme exposee au client : jamais `password_hash` en clair, seulement le
 * fait qu'un mot de passe existe. `token` : `null` pour un lien cree avant
 * la decision de le conserver en clair (migration 20260826180001) — sinon
 * present, exactement comme au moment de la creation (voir `createShareLink`).
 */
export interface ShareLinkSummary {
  id: string;
  worldId: string;
  scope: string;
  expiresAt: string | null;
  createdAt: string;
  hasPassword: boolean;
  token: string | null;
}

function toSummary(row: ShareLinkRow): ShareLinkSummary {
  return {
    id: row.id,
    worldId: row.world_id,
    scope: row.scope,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    hasPassword: row.password_hash !== null,
    token: row.token,
  };
}

export async function listShareLinks(supabase: TypedClient, worldId: string): Promise<ShareLinkSummary[]> {
  const rows = await listActiveShareLinksForWorld(supabase, worldId);
  return rows.map(toSummary);
}

/**
 * Le jeton en clair est desormais conserve (migration 20260826180001,
 * decision explicite : un lien de partage n'ouvre qu'une vue en lecture
 * seule, pas le meme profil de risque qu'un mot de passe) — recuperable
 * plus tard via `listShareLinks`, pas seulement au moment de cet appel.
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
    token,
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
