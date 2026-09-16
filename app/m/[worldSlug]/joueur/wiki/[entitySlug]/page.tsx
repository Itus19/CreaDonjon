import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getEntityBySlug } from "@/src/server/repos/entities";
import { canUserEditEntity } from "@/src/server/services/permissions";
import { getEntityWindowData } from "@/src/server/services/entityWindow";
import { getPlayerEntityDetail } from "@/src/server/services/playerEntityDetail";
import type { Locale } from "@/src/i18n/request";
import PublicEntityBody from "@/components/entities/public/PublicEntityBody";
import { WikiBackgroundRegistrar } from "@/components/entities/public/WikiBackgroundProvider";
import WikiBackgroundPreload from "@/components/entities/public/WikiBackgroundPreload";
import EditEntityForm from "../../../(monde)/f/[entitySlug]/EditEntityForm";

/**
 * Fiche du Wiki (V2-M7b, coquille joueur) — lecture seule PAR DEFAUT
 * (`getPlayerEntityDetail` + `PublicEntityBody`, le meme corps de fiche que
 * l'apercu MJ et le partage anonyme, jamais d'affordance d'edition),
 * SAUF si `canEditEntity` autorise ce viewer sur CETTE fiche precise
 * (retour utilisateur : "le joueur a toujours le droit d'edition sur sa
 * propre fiche" — deja vrai via canEditEntity cas 3 — "et sur une fiche de
 * lore accordee par le MJ" — cas 4, `entity_grants`). Sans ce test, la
 * seule facon d'editer sa propre fiche restait l'onglet Fiche, et une
 * fiche de lore accordee via le panneau MJ (V2-M7, "Octrois d'edition")
 * n'etait JAMAIS editable depuis la coquille joueur — aucun autre chemin
 * n'y menait.
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

  const canEdit = await canUserEditEntity(supabase, { worldId: world.id, entityId: entity.id, userId: user.id });

  if (canEdit) {
    const data = await getEntityWindowData(supabase, worldSlug, entitySlug);
    if (!data) notFound();
    return (
      <EditEntityForm
        entity={data.entity}
        worldSlug={data.worldSlug}
        initialBlocks={data.blocks}
        initialRelations={data.relations}
        otherEntities={data.otherEntities}
        worldCustomKinds={data.worldCustomKinds}
        campaignId={data.campaignId}
        initialIsPc={data.isPc}
        campaignCharacterUserId={data.campaignCharacterUserId}
        initialPortraitLayout={data.portraitLayout}
        playerRestricted
      />
    );
  }

  const detail = await getPlayerEntityDetail(supabase, { worldId: world.id, entitySlug, userId: user.id, locale: (await getLocale()) as Locale });
  if (!detail) notFound();

  return (
    <>
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
