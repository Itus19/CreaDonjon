import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { getEncounterBudgetTableForRuleset, listMonstersForRuleset, listSavedEncounters } from "@/src/server/services/encounters";
import type { Locale } from "@/src/i18n/request";
import EncounterBuilder from "@/components/shell/EncounterBuilder";

/**
 * Page dediee du Compagnon MJ (V1-E3, refonte) : "Générateur de
 * rencontres", outil autonome — jamais attache a une fiche (redirection
 * explicite de l'utilisateur sur les mockups fournis, voir
 * docs/BACKLOG_V1.md). Meme motif que /mj/probabilites : donnees initiales
 * calculees cote serveur, campagne choisie par lien `?campagne=`.
 */
export default async function MjRencontresPage({
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
  const [budgetResolution, monsters, savedEncounters] = selected
    ? await Promise.all([
        getEncounterBudgetTableForRuleset(supabase, selected.rulesetId),
        listMonstersForRuleset(supabase, selected.rulesetId, locale),
        listSavedEncounters(supabase, selected.id),
      ])
    : [null, [], []];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="block-title text-base">Générateur de rencontres</h1>
        <p className="text-xs text-ink-muted">
          Composez une rencontre depuis le catalogue de monstres du ruleset, ou laissez le solveur en proposer une
          pour le budget choisi.
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
                  href={`/m/${worldSlug}/mj/rencontres?campagne=${c.id}`}
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
          {selected && (
            <EncounterBuilder
              campaignId={selected.id}
              budgetTable={budgetResolution?.rows ?? null}
              budgetIsFallback={budgetResolution?.isFallback ?? false}
              monsters={monsters}
              initialSavedEncounters={savedEncounters}
            />
          )}
        </>
      )}
    </div>
  );
}
