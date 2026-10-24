import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { chargerReglesActives } from "@/src/server/services/reglesActives";
import { lancerFicheAvecPage } from "@/src/server/services/ficheAvecPage";
import type { Locale } from "@/src/i18n/request";
import ReglesActivesPanel from "@/components/rules/ReglesActivesPanel";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";

/**
 * Règles actives (V3.1-57) : le ruleset à gauche, la table à droite. Tout
 * arrive avec la page (docs/CABLAGE.md C1) : les rulesets, les interrupteurs de
 * la campagne, et la fiche d'un PJ pour l'aperçu, lancée en promesse avec la page.
 */
export default async function MjReglesActivesPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();
  const user = await getAuthUser(supabase);
  if (!user) notFound();

  const [data, locale] = await Promise.all([chargerReglesActives(supabase, world, user.id), getLocale()]);
  const ficheAvecPage =
    data.campaign && data.apercu
      ? lancerFicheAvecPage(supabase, {
          worldId: world.id,
          entityId: data.apercu.entityId,
          userId: user.id,
          campaignId: data.campaign.id,
          locale: locale as Locale,
          blocks: data.apercu.blocks,
        })
      : null;

  return (
    <>
      <RegisterPrimaryWindow windowRef={{ kind: "mj", key: "regles-actives" }} name="Règles actives" badge="" homeHref={`/m/${worldSlug}/mj/regles-actives`} />
      <ReglesActivesPanel worldSlug={worldSlug} data={data} ficheAvecPage={ficheAvecPage} />
    </>
  );
}
