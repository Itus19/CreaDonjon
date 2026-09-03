import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import { getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import {
  getEntityBySlug,
  listCustomEntityKindsForWorld,
  listEntitiesForWorld,
  type EntitySummary,
} from "@/src/server/repos/entities";
import { listVisibleBlocks, type VisibleBlock } from "@/src/server/services/blocks";
import { listVisibleRelations, type VisibleRelation } from "@/src/server/services/relations";
import { getCampaignCharacters, listCampaigns } from "@/src/server/services/campaigns";
import { getPortraitLayout } from "@/src/server/services/entityPortraits";
import type { EntityPortraitLayout } from "@/src/server/repos/entityPortraits";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { listPlayerVisibleEntityIds } from "@/src/server/services/entities";

type TypedClient = SupabaseClient<Database>;

export interface EntityWindowData {
  entity: EntitySummary;
  worldSlug: string;
  blocks: VisibleBlock[];
  relations: VisibleRelation[];
  otherEntities: { id: string; name: string; slug: string; entity_kind: string }[];
  /** Categories personnalisees deja utilisees dans ce monde (V2-G7) — pour le selecteur de type. */
  worldCustomKinds: string[];
  /**
   * Statut PJ/PNJ (V2-G10, specs/arbitrage-modifications.md §3.1) : jamais
   * un `entity_kind`, toujours derive de `campaign_characters.is_pc` — porte
   * ici pour que le selecteur de type propose PJ/PNJ a la place de
   * "Personnage" pour une fiche de type `character`. `campaignId` null si le
   * monde n'a pas encore de campagne (ne devrait plus arriver depuis "un
   * monde = une campagne", migration 20260826100001, mais des mondes
   * anterieurs peuvent en manquer) — le statut n'a alors pas de sens.
   */
  campaignId: string | null;
  isPc: boolean;
  /** Compte joueur deja attribue (panneau MJ, CampaignDetail.tsx) — jamais efface par un simple changement PJ/PNJ depuis la fiche. */
  campaignCharacterUserId: string | null;
  /** Taille/alignement du portrait dans le wiki (V2-G11) — valeurs par defaut si aucun portrait n'a encore ete televerse. */
  portraitLayout: EntityPortraitLayout;
}

/**
 * Donnees d'une fiche pour une fenetre (ADR-0006) : la meme forme que ce
 * qu'attend `<EditEntityForm>`, qu'elle vienne du rendu serveur de la
 * fenetre primaire ou d'une recuperation client pour une fenetre `?avec=`.
 * `null` si le monde, la fiche ou l'utilisateur sont introuvables —
 * chaque appelant traduit ça dans son propre format (404 Next.js pour la
 * page, reponse JSON 404 pour la route API).
 *
 * `getAuthUser` en parallele du lookup de monde (audit de performance,
 * retour utilisateur) : elle ne depend ni de `worldSlug` ni de `entity`
 * (juste de la session), mais revalide aupres du serveur d'authentification
 * a CHAQUE appel (`supabase.auth.getUser()`, jamais une simple lecture
 * locale — voir le commentaire sur `getAuthUser`, lib/supabase/server.ts) :
 * un vrai aller-retour reseau, attendu ici en SERIE apres deux autres,
 * alors que rien ne l'y oblige. Chemin le plus emprunte de toute l'appli
 * (chaque ouverture de fiche) : economiser un aller-retour ici compte.
 */
export async function getEntityWindowData(
  supabase: TypedClient,
  worldSlug: string,
  entitySlug: string
): Promise<EntityWindowData | null> {
  const [world, user] = await Promise.all([getWorldBySlug(supabase, worldSlug), getAuthUser(supabase)]);
  if (!world || !user) return null;

  const entity = await getEntityBySlug(supabase, world.id, entitySlug);
  if (!entity) return null;

  const [blocks, relations, allEntities, worldCustomKinds, campaigns, portraitLayout, admin] = await Promise.all([
    listVisibleBlocks(supabase, world.id, entity.id, user.id),
    listVisibleRelations(supabase, world.id, entity.id, user.id),
    listEntitiesForWorld(supabase, world.id),
    listCustomEntityKindsForWorld(supabase, world.id),
    listCampaigns(supabase, world.id),
    getPortraitLayout(supabase, entity.id),
    isWorldAdmin(supabase, { worldId: world.id, userId: user.id }),
  ]);

  // Retour utilisateur : une fiche masquee aux joueurs (aucun bloc visible)
  // apparaissait quand meme dans "lien vers une fiche"/le "+" du bloc
  // genealogie — `otherEntities` ne filtrait jusqu'ici que par monde, jamais
  // par visibilite. Jamais pour le MJ (`isWorldAdmin`) : lui doit continuer
  // a lier n'importe quelle fiche, y compris une entierement vide.
  let othersInWorld = allEntities.filter((e) => e.id !== entity.id);
  if (!admin) {
    const visibleIds = await listPlayerVisibleEntityIds(supabase, world.id, othersInWorld.map((e) => e.id), user.id);
    othersInWorld = othersInWorld.filter((e) => visibleIds.has(e.id));
  }
  const otherEntities = othersInWorld.map((e) => ({ id: e.id, name: e.name, slug: e.slug, entity_kind: e.entity_kind }));

  // "Un monde = une campagne" (migration 20260826100001) : au plus une ligne.
  const campaign = campaigns[0] ?? null;
  const campaignCharacter = campaign
    ? (await getCampaignCharacters(supabase, campaign.id)).find((c) => c.entity_id === entity.id)
    : undefined;

  return {
    entity,
    worldSlug,
    blocks,
    relations,
    otherEntities,
    worldCustomKinds,
    campaignId: campaign?.id ?? null,
    isPc: campaignCharacter?.is_pc ?? false,
    campaignCharacterUserId: campaignCharacter?.user_id ?? null,
    portraitLayout,
  };
}
