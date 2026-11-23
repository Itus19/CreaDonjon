import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { getClaimedCharacterEntityId } from "@/src/server/repos/campaigns";
import { getEntityNames } from "@/src/server/repos/remotePlay";
import { loadSceneView } from "@/src/server/services/soloScene";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { buildWikiColumn, buildQuestColumn } from "@/src/server/services/soloWorldColumn";
import { loadRemoteTable } from "@/src/server/services/remotePlay";
import EmptyState from "@/components/shell/EmptyState";
import ColonneMonde, { ColonneMondeTelephone } from "@/components/solo/ColonneMonde";
import QuetesTelephone from "@/components/solo/QuetesTelephone";
import FicheJouableSolo from "@/components/solo/FicheJouableSolo";
import SoloShell from "@/components/solo/SoloShell";
import { TableADistanceProvider } from "@/components/distance/TableADistanceContexte";
import JeuJoueurDistance from "@/components/distance/JeuJoueurDistance";
import ColonneFicheJoueur from "@/components/distance/ColonneFicheJoueur";
import type { Locale } from "@/src/i18n/request";

/**
 * Le jeu à distance, côté joueur (ADR 0103, variante 2) : la coquille du
 * solo (`SoloShell`), dont seul le centre change — le fil commun au lieu de
 * la barre d'intention — et la colonne droite, qui gagne l'onglet
 * « MJ, en privé ». Tout ce qu'affiche l'écran arrive avec la page (C1) ;
 * le fil se relit ensuite par le temps réel.
 */
export default async function JoueurDistancePage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();
  const user = await getAuthUser(supabase);
  if (!user) notFound();

  const campaign = (await listCampaigns(supabase, world.id))[0] ?? null;
  if (!campaign) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState title="Aucune campagne" description="Ce monde n'a pas encore de campagne à jouer." />
      </div>
    );
  }

  const locale = (await getLocale()) as Locale;
  const [table, entityId] = await Promise.all([
    loadRemoteTable(supabase, { campaignId: campaign.id, userId: user.id, locale }),
    getClaimedCharacterEntityId(supabase, { campaignId: campaign.id, userId: user.id }),
  ]);
  if (!table.ok) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title="Pas de jeu à distance ici"
          description={
            table.reason === "not_remote"
              ? "Cette campagne se joue à table. Le MJ peut choisir « À distance » ou « Les deux » dans Gestion de campagne."
              : "Cet écran est réservé aux joueurs de la campagne."
          }
        />
      </div>
    );
  }

  const viewer = await buildViewerForWorld(supabase, world.id, user.id);
  const t = await getTranslations("shell");
  const [scene, wiki, quests, noms] = await Promise.all([
    loadSceneView(supabase, { campaignId: campaign.id, worldId: world.id }),
    entityId ? buildWikiColumn(supabase, world.id, user.id, viewer, t.raw("kindLabels") as Record<string, string>, campaign.id, entityId) : Promise.resolve([]),
    buildQuestColumn(supabase, world.id, viewer),
    entityId ? getEntityNames(supabase, [entityId]) : Promise.resolve(new Map<string, string>()),
  ]);

  const fiche = entityId ? (
    <FicheJouableSolo worldSlug={worldSlug} entityId={entityId} campaignId={campaign.id} entityName={noms.get(entityId) ?? ""} sonder={false} />
  ) : (
    <EmptyState title="Aucun personnage" description="Réclame une fiche depuis l'onglet Personnage pour l'avoir sous la main ici." />
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TableADistanceProvider initial={table.view}>
        <SoloShell
          worldSlug={worldSlug}
          entete={
            <span className="flex min-w-0 items-center gap-2">
              <strong className="truncate font-semibold text-ink">{scene?.locationName ?? campaign.name}</strong>
              <span className="text-xs text-ink-muted">Jeu à distance</span>
            </span>
          }
          monde={<ColonneMonde worldSlug={worldSlug} campaignId={campaign.id} wiki={wiki} quests={quests} present={scene?.present ?? []} sketches={scene?.sketches ?? []} />}
          mondeTelephone={<ColonneMondeTelephone worldSlug={worldSlug} campaignId={campaign.id} wiki={wiki} present={scene?.present ?? []} sketches={scene?.sketches ?? []} />}
          quetes={<QuetesTelephone quests={quests} />}
          jeu={<JeuJoueurDistance />}
          fiche={<ColonneFicheJoueur campaignId={campaign.id} fiche={fiche} />}
        />
      </TableADistanceProvider>
    </div>
  );
}
