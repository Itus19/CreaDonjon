import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns, getCampaignCharacters } from "@/src/server/services/campaigns";
import { getEntityById } from "@/src/server/repos/entities";
import {
  getActiveCombatForCampaign,
  getCombatDetail,
  listCombatsForCampaign,
  listConditionNames,
} from "@/src/server/services/combats";
import { listMonstersForRuleset } from "@/src/server/services/encounters";
import type { Locale } from "@/src/i18n/request";
import InitiativeTracker from "@/components/shell/InitiativeTracker";

/**
 * Suivi d'initiative (V1-E4, specs/outils-mj.md §5) : outil d'ecran MJ
 * autonome, meme emplacement que Rencontres/Probabilites — retour
 * explicite de l'utilisateur ("cet outil doit etre disponible dans
 * l'onglet MJ pas ailleurs"). Un combat actif par campagne au plus dans
 * l'usage attendu (rien ne l'impose en base) : la page ouvre directement
 * dessus s'il y en a un, sinon propose "Lancer le combat" depuis Rencontres
 * ou de reprendre un combat termine dans "Mes combats".
 */
export default async function MjInitiativePage({
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

  let activeCombat = null;
  let combats: Awaited<ReturnType<typeof listCombatsForCampaign>> = [];
  let pcOptions: { id: string; name: string }[] = [];
  let monsters: Awaited<ReturnType<typeof listMonstersForRuleset>> = [];
  let conditions: string[] = [];

  if (selected) {
    const [active, combatList, characters, monsterList, conditionList] = await Promise.all([
      getActiveCombatForCampaign(supabase, selected.id),
      listCombatsForCampaign(supabase, selected.id),
      getCampaignCharacters(supabase, selected.id),
      listMonstersForRuleset(supabase, selected.rulesetId, locale),
      listConditionNames(supabase, selected.rulesetId, locale),
    ]);
    combats = combatList;
    monsters = monsterList;
    conditions = conditionList;

    const pcs = characters.filter((c) => c.is_pc);
    const entities = await Promise.all(pcs.map((c) => getEntityById(supabase, c.entity_id)));
    pcOptions = entities.filter((e): e is NonNullable<typeof e> => e !== null).map((e) => ({ id: e.id, name: e.name }));

    activeCombat = active ? await getCombatDetail(supabase, active.id) : null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="block-title text-base">Initiative</h1>
        <p className="text-xs text-ink-muted">
          Suivez l&apos;ordre du tour, les points de vie et les conditions d&apos;un combat.
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
                  href={`/m/${worldSlug}/mj/initiative?campagne=${c.id}`}
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
            <InitiativeTracker
              worldSlug={worldSlug}
              campaignId={selected.id}
              initialCombat={activeCombat}
              savedCombats={combats}
              pcOptions={pcOptions}
              monsters={monsters}
              conditions={conditions}
            />
          )}
        </>
      )}
    </div>
  );
}
