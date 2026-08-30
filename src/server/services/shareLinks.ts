import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { generateShareToken, hashShareToken } from "@/src/core/shareLinks/token";
import { hashSharePassword } from "@/src/core/shareLinks/password";
import { slugify, nextSlugCandidate } from "@/src/core/slug/slug";
import {
  type ShareLinkRow,
  insertShareLink,
  listActiveShareLinksForWorld,
  revokeShareLink as repoRevokeShareLink,
  shareLinkSlugExists,
} from "@/src/server/repos/shareLinks";
import { resolveCampaignId, getCampaign } from "@/src/server/services/campaigns";

type TypedClient = SupabaseClient<Database>;

const MAX_SLUG_ATTEMPTS = 50;

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
  /** V2-M10 (Lot M) : alias court (nom de campagne slugifie) — `null` pour un lien `players` ou cree avant cette fonctionnalite, l'URL retombe alors sur `token`. */
  slug: string | null;
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
    slug: row.slug,
  };
}

/**
 * Slug court et explicite (retour utilisateur : "le plus court et
 * explicite possible... y mettre le nom de la campagne") — unicite
 * globale (colonne `unique`, pas de partition par monde) puisque l'URL de
 * resolution (`/partage/[token]`) n'est jamais prefixee par le monde.
 * Repli sur "campagne" si le nom se slugifie a vide (ex. nom compose
 * uniquement d'emojis) — jamais une chaine vide, qui casserait l'URL.
 */
async function generateUniqueShareSlug(supabase: TypedClient, campaignName: string): Promise<string> {
  const base = slugify(campaignName);
  const baseSlug = base === "" ? "campagne" : base;

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const candidate = attempt === 0 ? baseSlug : nextSlugCandidate(baseSlug, attempt);
    if (!(await shareLinkSlugExists(supabase, candidate))) {
      return candidate;
    }
  }
  throw new Error("Impossible de generer un alias unique pour ce lien.");
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
 *
 * Alias court (V2-M10, retour utilisateur) genere ici, jamais pour un
 * scope autre que 'public_only' — un lien 'players' exposerait du contenu
 * reserve a la table, un slug devinable (nom de campagne) y serait une
 * vraie regression de securite contrairement a ce cas, deja public.
 */
export async function createShareLink(
  supabase: TypedClient,
  params: { worldId: string; createdBy: string; password?: string },
): Promise<{ token: string; link: ShareLinkRow }> {
  const token = generateShareToken();
  const campaignId = await resolveCampaignId(supabase, params.worldId);
  const campaign = campaignId ? await getCampaign(supabase, campaignId) : null;
  const slug = campaign ? await generateUniqueShareSlug(supabase, campaign.name) : null;
  const link = await insertShareLink(supabase, {
    worldId: params.worldId,
    token,
    tokenHash: hashShareToken(token),
    scope: "public_only",
    createdBy: params.createdBy,
    passwordHash: params.password ? hashSharePassword(params.password) : null,
    slug,
  });
  return { token, link };
}

export async function revokeShareLink(
  supabase: TypedClient,
  params: { id: string; worldId: string },
): Promise<void> {
  await repoRevokeShareLink(supabase, params);
}
