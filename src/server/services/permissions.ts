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

/**
 * "Cette personne administre-t-elle ce monde" (V2-M7, Lot M) : proprietaire/
 * editeur du monde, ou MJ humain d'une campagne de ce monde — memes deux
 * premiers cas que `canEditEntity` (`src/core/permissions/canEditEntity.ts`)
 * et miroir de `app.is_world_admin` (SQL, meme nom). Troisieme copie
 * deliberee de la meme regle plutot qu'une abstraction partagee entre les
 * trois couches : RLS ne peut pas executer du TypeScript, et le noyau pur
 * (`canEditEntity`) ne doit pas dependre d'un acces base pour resoudre le
 * `Viewer` lui-meme. Sert a gater le panneau MJ (journal filtre au monde,
 * octroi d'edition, revocation de fiche PJ) : jamais une simple fiche
 * precise (voir `canUserEditEntity` ci-dessus pour ce cas plus fin).
 */
export async function isWorldAdmin(supabase: TypedClient, params: { worldId: string; userId: string }): Promise<boolean> {
  const viewer = await buildViewerForWorld(supabase, params.worldId, params.userId);
  if (viewer.kind === "anonymous") return false;
  return (
    viewer.worldRole === "owner" ||
    viewer.worldRole === "editor" ||
    Object.values(viewer.campaignRoles).includes("gm")
  );
}
