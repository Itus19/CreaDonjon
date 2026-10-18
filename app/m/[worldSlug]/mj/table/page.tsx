import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { getTableParty } from "@/src/server/services/tableParty";
import { listConditionNames } from "@/src/server/services/combats";
import type { Locale } from "@/src/i18n/request";
import OutilTable from "@/components/shell/OutilTable";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";

/**
 * L'outil Table du MJ (V3.1-34) : tous les PJ de la campagne, avec les
 * commandes de leur fiche. Rendue côté serveur comme les autres outils (les
 * données arrivent déjà calculées, aucun chargement après l'affichage) ; la
 * section MJ est réservée au MJ du monde par son `layout.tsx`. Mêmes appels
 * que la route des fenêtres d'outil (`/api/worlds/[worldSlug]/mj/table/window`).
 * « Un monde = une campagne » : la première campagne du monde.
 */
export default async function MjTablePage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const locale = (await getLocale()) as Locale;
  const campaigns = await listCampaigns(supabase, world.id);
  const selected = campaigns[0] ?? null;
  const [party, conditions] = selected
    ? await Promise.all([
        getTableParty(supabase, { worldId: world.id, campaignId: selected.id, locale }),
        listConditionNames(supabase, selected.rulesetId, locale),
      ])
    : [[], []];

  return (
    <>
      <RegisterPrimaryWindow windowRef={{ kind: "mj", key: "table" }} name="Table" badge="" homeHref={`/m/${worldSlug}/mj/table`} />
      <OutilTable worldSlug={worldSlug} campaignId={selected?.id ?? null} party={party} conditions={conditions} />
    </>
  );
}
