import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { getPartyCheckLines } from "@/src/server/services/partyProbabilities";
import type { Locale } from "@/src/i18n/request";
import PartyProbabilityTable from "@/components/shell/PartyProbabilityTable";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";

/**
 * Page dediee du Compagnon MJ (V1-E5, specs/arbitrage-modifications.md §3.6) :
 * un tableau MJ groupant tous les PJ d'une campagne, deplace hors de l'onglet
 * Campagnes a la demande de l'utilisateur — c'est un outil qu'on consulte en
 * jeu, pas un detail de gestion de campagne. Entierement rendue cote serveur
 * (donnees deja calculees a l'ouverture, campagne choisie par le sélecteur, qui navigue vers `?campagne=`)
 * : pas de fetch client, la navigation elle-meme est le rechargement.
 */
export default async function MjProbabilitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ campagne?: string }>;
}) {
  const { worldSlug } = await params;
  const { campagne } = await searchParams;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const campaigns = await listCampaigns(supabase, world.id);
  const selected = campaigns.find((c) => c.id === campagne) ?? campaigns[0] ?? null;

  const locale = (await getLocale()) as Locale;
  const party = selected ? await getPartyCheckLines(supabase, selected.id, locale) : [];

  return (
    <div className="flex flex-col gap-4">
      <RegisterPrimaryWindow windowRef={{ kind: "mj", key: "probabilites" }} name="Probabilités" badge="" homeHref={`/m/${worldSlug}/mj/probabilites`} />
      <PartyProbabilityTable
        party={party}
        hasCampaign={campaigns.length > 0}
        campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
        selectedCampaignId={selected?.id}
        worldSlug={worldSlug}
      />
    </div>
  );
}
