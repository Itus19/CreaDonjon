import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { getClaimedCharacterEntityId } from "@/src/server/repos/campaigns";
import { buildIntentBarData } from "@/src/server/services/turnIntent";
import { listSceneChoices, loadSceneView } from "@/src/server/services/soloScene";
import EmptyState from "@/components/shell/EmptyState";
import SoloScreen from "@/components/solo/SoloScreen";
import type { Locale } from "@/src/i18n/request";

/**
 * V3-B1 — L'ecran solo, reduit a ce que le ticket demande : une barre
 * d'intention et le fil des tours.
 *
 * Ce n'est pas encore le lot D (la coquille a trois colonnes) et il ne faut
 * pas l'y confondre : il n'y a ici ni colonne du monde connu, ni fiche a
 * droite. C'est le toit minimal dont la barre avait besoin pour se jouer
 * vraiment — V3-D4 reprendra le composant tel quel dans sa colonne
 * centrale.
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

  const [scene, choices] = await Promise.all([
    loadSceneView(supabase, campaign.id),
    listSceneChoices(supabase, world.id),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="entity-title">{data.actor.name}</h1>
        <p className="text-sm text-ink-muted">
          {data.targetDetails.length === 0
            ? "Personne d'autre dans la scène pour l'instant."
            : `${data.targetDetails.length} présent${data.targetDetails.length > 1 ? "s" : ""} à portée.`}
        </p>
      </header>

      <SoloScreen
        worldSlug={worldSlug}
        campaignId={campaign.id}
        entityId={entityId}
        data={data}
        scene={scene}
        locations={choices.locations}
        candidates={choices.candidates}
      />
    </div>
  );
}
