import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug, getCalendar } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { getClaimedCharacterEntityId } from "@/src/server/repos/campaigns";
import { buildIntentBarData } from "@/src/server/services/turnIntent";
import { listSceneChoices, loadSceneView, sceneDateLabel } from "@/src/server/services/soloScene";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { buildWikiColumn, buildQuestColumn } from "@/src/server/services/soloWorldColumn";
import EmptyState from "@/components/shell/EmptyState";
import ColonneMonde from "@/components/solo/ColonneMonde";
import EnTeteEtat from "@/components/solo/EnTeteEtat";
import FicheJouableSolo from "@/components/solo/FicheJouableSolo";
import SoloScreen from "@/components/solo/SoloScreen";
import SoloShell from "@/components/solo/SoloShell";
import type { Locale } from "@/src/i18n/request";

/**
 * L'ecran solo — **V3-D1 : la coquille a trois colonnes**, qui remplace le
 * toit minimal de V3-B1. **V3-D2** pose l'en-tete d'etat dans le bandeau
 * (lieu a gauche, date/heure a droite) — le nom du personnage qui y vivait
 * provisoirement se reinstalle dans la fiche jouable, V3-D5. **V3-D3** pose
 * la colonne gauche (le monde connu) : Wiki, Quetes, Presents, Regles.
 *
 * **V3-D5** pose la colonne droite : la fiche jouable au format etroit
 * (`FicheJouableSolo`, qui se charge elle-meme — voir son propre
 * commentaire pour pourquoi). La colonne centrale porte deja le vrai
 * ecran de jeu (scene + barre d'intention), deplace tel quel depuis
 * V3-B1 — c'est V3-D4 qui le reprendra en fil.
 *
 * Le personnage et la campagne se resolvent exactement comme l'onglet
 * Personnage (`joueur/page.tsx`) : le PJ revendique de la premiere campagne
 * du monde, jamais une seconde regle parallele.
 */
export default async function JoueurSoloPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();
  const user = await getAuthUser(supabase);
  if (!user) notFound();

  const campaigns = await listCampaigns(supabase, world.id);
  const campaign = campaigns[0] ?? null;
  const entityId = campaign ? await getClaimedCharacterEntityId(supabase, { campaignId: campaign.id, userId: user.id }) : null;

  if (!campaign || !entityId) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title="Aucun personnage à jouer"
          description="Le mode solo part du personnage réclamé dans ce monde. Réclame une fiche depuis l'onglet Personnage, et reviens ici."
        />
      </div>
    );
  }

  const locale = (await getLocale()) as Locale;
  const data = await buildIntentBarData(supabase, {
    entityId,
    campaignId: campaign.id,
    world: { id: world.id, slug: world.slug },
    locale,
  });

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          title="Fiche incomplète"
          description="Cette fiche n'a pas encore de bloc personnage, ou aucun système de règles n'est résolvable pour cette campagne — sans quoi aucun jet ne peut être calculé."
        />
      </div>
    );
  }

  const viewer = await buildViewerForWorld(supabase, world.id, user.id);
  const t = await getTranslations("shell");
  const [scene, choices, calendar, wiki, quests] = await Promise.all([
    loadSceneView(supabase, { campaignId: campaign.id, worldId: world.id }),
    listSceneChoices(supabase, world.id),
    getCalendar(supabase, world.id),
    buildWikiColumn(supabase, world.id, user.id, viewer, t.raw("kindLabels") as Record<string, string>),
    buildQuestColumn(supabase, world.id, viewer),
  ]);
  const dateLabel = scene ? sceneDateLabel(scene.time.day, calendar) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SoloShell
        worldSlug={worldSlug}
        entete={<EnTeteEtat worldSlug={worldSlug} scene={scene} dateLabel={dateLabel} />}
        monde={
          <ColonneMonde
            worldSlug={worldSlug}
            campaignId={campaign.id}
            wiki={wiki}
            quests={quests}
            present={scene?.present ?? []}
            sketches={scene?.sketches ?? []}
          />
        }
        jeu={
          <SoloScreen
            worldSlug={worldSlug}
            campaignId={campaign.id}
            entityId={entityId}
            data={data}
            scene={scene}
            locations={choices.locations}
            candidates={choices.candidates}
          />
        }
        fiche={<FicheJouableSolo worldSlug={worldSlug} entityId={entityId} campaignId={campaign.id} entityName={data.actor.name} />}
      />
    </div>
  );
}
