import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { canEditEntity } from "@/src/core/permissions/canEditEntity";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { isOwnCampaignCharacter } from "@/src/server/repos/campaigns";
import { hasEntityGrant } from "@/src/server/repos/entityGrants";
import { getEntityById } from "@/src/server/repos/entities";

type TypedClient = SupabaseClient<Database>;

/**
 * V2-M3 (Lot M) — seul point d'appel de `canEditEntity` cote service :
 * resout les trois faits dont la fonction pure a besoin (`worldRole`,
 * `campaignRoles`, `isOwnCharacter`, `isGranted`) puis l'applique. Jamais un
 * second test ecrit en dur dans `entities.ts`/`blocks.ts`/ailleurs.
 *
 * Verifie ici, cote service (PDD §28 : « la RLS n'est pas la securite,
 * c'est le filet ») — la RLS resserree par la meme migration reste le
 * filet pour tout appelant qui ecrirait directement via un repo sans passer
 * par ce garde (voir `docs/BACKLOG_V2.md`, note V2-M3 sur `characterActions.ts`,
 * volontairement pas encore couvert cote service, deja couvert cote RLS).
 */
export async function canUserEditEntity(
  supabase: TypedClient,
  params: { worldId: string; entityId: string; userId: string }
): Promise<boolean> {
  const [viewer, isOwnCharacter, isGranted] = await Promise.all([
    buildViewerForWorld(supabase, params.worldId, params.userId),
    isOwnCampaignCharacter(supabase, params),
    hasEntityGrant(supabase, params),
  ]);
  return canEditEntity(viewer, { isOwnCharacter, isGranted });
}

/**
 * Variante pour un appelant qui n'a que l'`entityId` sous la main (les
 * services de bloc partent tous d'un bloc/entite, jamais du monde) —
 * resout `worldId` via une lecture supplementaire plutot que d'imposer a
 * chaque appelant de la faire lui-meme. `false` si l'entite n'existe pas
 * (deja supprimee, id invalide) : jamais un throw pour une simple absence.
 */
export async function canUserEditEntityById(
  supabase: TypedClient,
  params: { entityId: string; userId: string }
): Promise<boolean> {
  const entity = await getEntityById(supabase, params.entityId);
  if (!entity) return false;
  return canUserEditEntity(supabase, { worldId: entity.world_id, entityId: params.entityId, userId: params.userId });
}
