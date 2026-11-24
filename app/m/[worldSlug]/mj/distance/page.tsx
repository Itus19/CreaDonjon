import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { loadSceneView } from "@/src/server/services/soloScene";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { buildQuestColumn } from "@/src/server/services/soloWorldColumn";
import { loadRemoteTable } from "@/src/server/services/remotePlay";
import EmptyState from "@/components/shell/EmptyState";
import SoloShell from "@/components/solo/SoloShell";
import { TableADistanceProvider } from "@/components/distance/TableADistanceContexte";
import JeuMjDistance from "@/components/distance/JeuMjDistance";
import ColonneTableMj from "@/components/distance/ColonneTableMj";
import ColonneSceneMj from "@/components/distance/ColonneSceneMj";
import BarreVuesMj from "@/components/distance/BarreVuesMj";
import type { Locale } from "@/src/i18n/request";

/**
 * Le jeu à distance, côté MJ (ADR 0103, option A avec la saisie de l'option
 * B) : la scène à gauche, le fil et ses outils au centre, la table et les
 * fils privés à droite. Même coquille que le solo (`SoloShell`) ; sous
 * 768 px, une barre de vues (Jeu, Scène, Table) remplace les colonnes.
 * Le layout `mj/` a déjà vérifié que l'appelant administre ce monde.
 */
export default async function MjDistancePage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();
  const user = await getAuthUser(supabase);
  if (!user) notFound();

  const campaign = (await listCampaigns(supabase, world.id))[0] ?? null;
  if (!campaign) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <EmptyState title="Aucune campagne" description="Ce monde n'a pas encore de campagne à mener." />
      </div>
    );
  }

  const locale = (await getLocale()) as Locale;
  const viewer = await buildViewerForWorld(supabase, world.id, user.id);
  const [table, scene, quests] = await Promise.all([
    loadRemoteTable(supabase, { campaignId: campaign.id, userId: user.id, locale }),
    loadSceneView(supabase, { campaignId: campaign.id, worldId: world.id }),
    buildQuestColumn(supabase, world.id, viewer),
  ]);
  if (!table.ok) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-3 p-6">
        <EmptyState
          title="Le jeu à distance n'est pas ouvert"
          description={
            table.reason === "not_remote"
              ? "Cette campagne se joue à table. Choisis « À distance » ou « Les deux » dans Gestion de campagne pour ouvrir cet écran."
              : "Cet écran n'a pas pu se charger."
          }
        />
        <Link href={`/m/${worldSlug}/mj/gestion-campagne`} className="self-center rounded-full border border-edge px-4 py-2 text-sm text-ink transition-colors hover:bg-panel-raised">
          Gestion de campagne
        </Link>
      </div>
    );
  }

  const colonneScene = <ColonneSceneMj scene={scene} quests={quests} />;

  return (
    <div className="flex h-full min-h-0 w-full flex-col p-3">
      <TableADistanceProvider initial={table.view}>
        <BarreVuesMj />
        <SoloShell
          worldSlug={`${worldSlug}:mj-distance`}
          entete={
            <span className="flex min-w-0 items-center gap-2">
              <strong className="truncate font-semibold text-ink">{scene?.locationName ?? campaign.name}</strong>
              <span className="text-xs text-ink-muted">Jeu à distance · MJ</span>
            </span>
          }
          monde={colonneScene}
          mondeTelephone={colonneScene}
          quetes={null}
          jeu={<JeuMjDistance />}
          fiche={<ColonneTableMj campaignId={campaign.id} />}
        />
      </TableADistanceProvider>
    </div>
  );
}
