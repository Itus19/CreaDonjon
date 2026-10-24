import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/src/types/database";
import type { EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import { publicationBackgroundState, type PublicationBackgroundState } from "@/src/core/theme/worldWikiBackground";
import { listCampaigns } from "@/src/server/services/campaigns";
import { getPublicEntityTree } from "@/src/server/services/publicShare";
import { listShareLinks, type ShareLinkSummary } from "@/src/server/services/shareLinks";
import { memberWorldBackgroundImageBase, readWorldWikiBackground } from "@/src/server/services/worldWikiBackground";

type TypedClient = SupabaseClient<Database>;

/** Tout ce que l'écran Publication montre à sa première vue (V3.1-60, docs/CABLAGE.md C1). */
export interface PublicationData {
  worldId: string;
  links: ShareLinkSummary[];
  wikiWelcomeMessage: string;
  /** Le titre de la page d'accueil quand le message est vide : le nom de la campagne, sinon du monde. */
  campaignName: string;
  /** Le sommaire tel qu'un visiteur le voit (contenu public seulement), pour l'aperçu. */
  publicTree: EntityTreeGroup[];
  /** Le fond par défaut enregistré, ou `null` s'il n'y en a pas. */
  wikiBackground: PublicationBackgroundState | null;
}

/**
 * V3.1-60 — l'écran Publication du MJ, page et fenêtre : les liens, le
 * message d'accueil, le fond par défaut du wiki et le sommaire public de
 * l'aperçu, lus ensemble. Le sommaire vient du même service que le wiki
 * public (`getPublicEntityTree`) : l'aperçu ne peut pas montrer plus que ce
 * qu'un visiteur verrait.
 */
export async function chargerPublication(
  supabase: TypedClient,
  world: { id: string; slug: string; name: string; wiki_welcome_message: string | null }
): Promise<PublicationData> {
  const [links, campaigns, publicTree, setting] = await Promise.all([
    listShareLinks(supabase, world.id),
    listCampaigns(supabase, world.id),
    getPublicEntityTree(world.id),
    readWorldWikiBackground(supabase, world.id),
  ]);
  const imageCopie = setting?.source === "world_asset" ? `${memberWorldBackgroundImageBase(world.slug)}?v=${setting.assetId}` : null;
  return {
    worldId: world.id,
    links,
    wikiWelcomeMessage: world.wiki_welcome_message ?? "",
    campaignName: campaigns[0]?.name ?? world.name,
    publicTree,
    wikiBackground: publicationBackgroundState(setting, imageCopie),
  };
}
