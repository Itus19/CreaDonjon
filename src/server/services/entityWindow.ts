import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
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
}

/**
 * Donnees d'une fiche pour une fenetre (ADR-0006) : la meme forme que ce
 * qu'attend `<EditEntityForm>`, qu'elle vienne du rendu serveur de la
 * fenetre primaire ou d'une recuperation client pour une fenetre `?avec=`.
 * `null` si le monde, la fiche ou l'utilisateur sont introuvables —
 * chaque appelant traduit ça dans son propre format (404 Next.js pour la
 * page, reponse JSON 404 pour la route API).
 */
export async function getEntityWindowData(
  supabase: TypedClient,
  worldSlug: string,
  entitySlug: string
): Promise<EntityWindowData | null> {
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) return null;

  const entity = await getEntityBySlug(supabase, world.id, entitySlug);
  if (!entity) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [blocks, relations, allEntities, worldCustomKinds, campaigns] = await Promise.all([
    listVisibleBlocks(supabase, world.id, entity.id, user.id),
    listVisibleRelations(supabase, world.id, entity.id, user.id),
    listEntitiesForWorld(supabase, world.id),
    listCustomEntityKindsForWorld(supabase, world.id),
    listCampaigns(supabase, world.id),
  ]);

  const otherEntities = allEntities
    .filter((e) => e.id !== entity.id)
    .map((e) => ({ id: e.id, name: e.name, slug: e.slug, entity_kind: e.entity_kind }));

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
  };
}
