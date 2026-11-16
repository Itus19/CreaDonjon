import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getEntityBySlug } from "@/src/server/repos/entities";
import { getPlayerEntityDetail } from "@/src/server/services/playerEntityDetail";
import { listCampaigns } from "@/src/server/services/campaigns";
import { discoverEntity } from "@/src/server/services/discoveries";
import type { Locale } from "@/src/i18n/request";
import PublicEntityBody from "@/components/entities/public/PublicEntityBody";
import { WikiBackgroundRegistrar } from "@/components/entities/public/WikiBackgroundProvider";
import WikiBackgroundPreload from "@/components/entities/public/WikiBackgroundPreload";
import EnregistrerRecent from "@/components/shell/EnregistrerRecent";

/**
 * Fiche du Wiki (V2-M7b, coquille joueur) — TOUJOURS en lecture seule
 * (`getPlayerEntityDetail` + `PublicEntityBody`, le meme corps de fiche que
 * l'apercu MJ et le partage anonyme, jamais d'affordance d'edition).
 *
 * Retour utilisateur (9 novembre 2026) : le Wiki est une visualisation,
 * l'edition vit dans l'onglet Edition (`joueur/fiche`), qui liste deja les
 * memes fiches que `canEditEntity` autorise (personnage revendique et
 * octrois du MJ, `listPlayerEditableEntities`). Avant, une fiche editable
 * s'ouvrait aussi en edition ici : deux chemins pour le meme geste.
 */
export default async function JoueurWikiEntityPage({
  params,
}: {
  params: Promise<{ worldSlug: string; entitySlug: string }>;
}) {
  const { worldSlug, entitySlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();
  const user = await getAuthUser(supabase);
  if (!user) notFound();

  const entity = await getEntityBySlug(supabase, world.id, entitySlug);
  if (!entity) notFound();

  // V3-C4 — ouvrir la fiche entière, c'est la « fréquenter, la fouiller » :
  // le niveau le plus poussé, qu'on l'ouvre en lecture ou en édition — un
  // joueur solo édite sa propre fiche (et souvent celle de ses PNJ, en
  // MJ de son propre monde) au moins autant qu'il ne la lit. Best-effort :
  // une écriture ratée ici ne doit jamais empêcher l'affichage de la fiche.
  const campaigns = await listCampaigns(supabase, world.id);
  if (campaigns[0]) {
    try {
      await discoverEntity(supabase, { campaignId: campaigns[0].id, userId: user.id, entityId: entity.id, level: "detailed" });
    } catch (erreur) {
      // La fiche s'affiche quand même ; l'échec, lui, se voit dans le journal du serveur (pas de catch muet).
      console.error("Découverte de la fiche non enregistrée", erreur);
    }
  }

  const detail = await getPlayerEntityDetail(supabase, { worldId: world.id, entitySlug, userId: user.id, locale: (await getLocale()) as Locale });
  if (!detail) notFound();

  return (
    <>
      <EnregistrerRecent worldSlug={worldSlug} espace="joueur-wiki" titre={entity.name} type={entity.entity_kind} />
      {/* V2.1-12 : la peau vient du layout ; cette page declare le fond de
          CETTE fiche, la seule chose qui change d'une fiche a l'autre. */}
      <WikiBackgroundPreload background={detail.wikiBackground} />
      <WikiBackgroundRegistrar background={detail.wikiBackground} />
      <PublicEntityBody
        {...detail}
        hrefBase={`/m/${worldSlug}/joueur/wiki`}
        ruleHrefBase={`/m/${worldSlug}/joueur/regles`}
      />
    </>
  );
}
