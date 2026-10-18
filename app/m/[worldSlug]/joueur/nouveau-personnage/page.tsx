import { getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { listCartesPersonnage } from "@/src/server/services/choixPersonnage";
import { getEntityById } from "@/src/server/repos/entities";
import type { Locale } from "@/src/i18n/request";
import AssistantNouveauPersonnage from "./AssistantNouveauPersonnage";

/**
 * "Nouveau PJ" depuis l'écran "Choisis ton personnage" (V3.1-10) — même
 * assistant que côté MJ (`mj/creation-personnage`), mais la fiche créée est
 * immédiatement réclamée par la joueuse elle-même (`onCreate`) plutôt que
 * laissée flottante pour une attribution manuelle ultérieure.
 *
 * V3.1-83 : avec `?pj=`, l'assistant s'ouvre sur un PJ ouvert SANS fiche,
 * à son nom et à son portrait ; la réclamation se fait à la validation. Le
 * serveur revérifie que ce PJ est réclamable et sans fiche : sinon, retour
 * au carrousel (un lien recopié ne contourne rien).
 */
export default async function JoueurNouveauPersonnagePage({
  params,
  searchParams,
}: {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ pj?: string }>;
}) {
  const { worldSlug } = await params;
  const { pj } = await searchParams;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();
  const user = await getAuthUser(supabase);
  if (!user) notFound();
  const t = await getTranslations("choixPersonnage");

  if (!pj) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <h1 className="block-title text-base">{t("nouveauNom")}</h1>
        <AssistantNouveauPersonnage worldSlug={worldSlug} worldId={world.id} pj={null} />
      </div>
    );
  }

  const campaign = (await listCampaigns(supabase, world.id))[0] ?? null;
  if (!campaign) redirect(`/m/${worldSlug}/joueur`);
  const { cartes } = await listCartesPersonnage(supabase, {
    campaignId: campaign.id,
    rulesetId: campaign.rulesetId,
    worldId: world.id,
    userId: user.id,
    locale: (await getLocale()) as Locale,
  });
  const carte = cartes.find((c) => c.entityId === pj);
  const entity = carte && carte.identite === null ? await getEntityById(supabase, carte.entityId) : null;
  if (!carte || !entity) redirect(`/m/${worldSlug}/joueur`);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-edge bg-panel-sunken">
          {carte.portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- portrait servi par /api/entities/[id]/portrait
            <img src={carte.portraitUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden className="font-display text-2xl font-bold text-ink-muted">
              {(entity.name.trim()[0] ?? "").toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col">
          <h1 className="block-title text-base">{t("assistantTitrePj", { nom: entity.name })}</h1>
          {carte.phrase && <p className="text-xs text-ink-muted">{carte.phrase}</p>}
        </div>
      </div>
      <AssistantNouveauPersonnage
        worldSlug={worldSlug}
        worldId={world.id}
        pj={{ entityId: entity.id, name: entity.name, version: entity.version }}
      />
    </div>
  );
}
