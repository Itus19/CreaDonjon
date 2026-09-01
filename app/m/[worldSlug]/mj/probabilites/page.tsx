import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { getPartySkillProbabilities } from "@/src/server/services/partyProbabilities";
import type { Locale } from "@/src/i18n/request";
import PartyProbabilityTable from "@/components/shell/PartyProbabilityTable";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";

/**
 * Page dediee du Compagnon MJ (V1-E5, specs/arbitrage-modifications.md §3.6) :
 * un tableau MJ groupant tous les PJ d'une campagne, deplace hors de l'onglet
 * Campagnes a la demande de l'utilisateur — c'est un outil qu'on consulte en
 * jeu, pas un detail de gestion de campagne. Entierement rendue cote serveur
 * (donnees deja calculees a l'ouverture, campagne choisie par lien `?campagne=`)
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
  const party = selected ? await getPartySkillProbabilities(supabase, selected.id, locale) : [];

  return (
    <div className="flex flex-col gap-4">
      <RegisterPrimaryWindow windowRef={{ kind: "mj", key: "probabilites" }} name="Probabilités" badge="" homeHref={`/m/${worldSlug}/mj/probabilites`} />
      <div>
        <h1 className="block-title text-base">Probabilités de réussite</h1>
        <p className="text-xs text-ink-muted">
          Probabilité de réussir un jet de compétence à DD 10, 15 et 20, pour chaque personnage joueur de la
          campagne.
        </p>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-sm italic text-ink-muted">
          Aucune campagne dans ce monde — créez-en une dans l&apos;onglet Campagnes.
        </p>
      ) : (
        <>
          {campaigns.length > 1 && (
            <div className="flex flex-wrap gap-2 border-b border-edge/60 pb-2">
              {campaigns.map((c) => (
                <Link
                  key={c.id}
                  href={`/m/${worldSlug}/mj/probabilites?campagne=${c.id}`}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    selected?.id === c.id
                      ? "border-accent text-accent"
                      : "border-edge text-ink-soft hover:bg-panel-raised"
                  }`}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          )}
          <PartyProbabilityTable party={party} />
        </>
      )}
    </div>
  );
}
