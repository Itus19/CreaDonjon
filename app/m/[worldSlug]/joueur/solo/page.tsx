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
import SoloShell from "@/components/solo/SoloShell";
import type { Locale } from "@/src/i18n/request";

/**
 * L'ecran solo — **V3-D1 : la coquille a trois colonnes**, qui remplace le
 * toit minimal de V3-B1.
 *
 * Ce ticket ne pose que la coquille. Les deux colonnes laterales annoncent
 * ce qui viendra s'y asseoir plutot que de rester vides : le monde connu
 * est V3-D3, la fiche jouable V3-D5. La colonne centrale porte deja le
 * vrai ecran de jeu (scene + barre d'intention), deplace tel quel depuis
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

  const [scene, choices] = await Promise.all([
    loadSceneView(supabase, campaign.id),
    listSceneChoices(supabase, world.id),
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SoloShell
        worldSlug={worldSlug}
        entete={
          <>
            <h1 className="entity-title truncate">{data.actor.name}</h1>
            <p className="text-sm text-ink-muted">
              {data.targetDetails.length === 0
                ? "Personne d'autre dans la scène pour l'instant."
                : `${data.targetDetails.length} présent${data.targetDetails.length > 1 ? "s" : ""} à portée.`}
            </p>
          </>
        }
        monde={
          <EmptyState
            title="Le monde connu"
            description="Le wiki des fiches découvertes, les quêtes en cours, qui est présent et les règles actives viendront ici — c'est V3-D3."
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
        fiche={
          <EmptyState
            title="La fiche jouable"
            description="La fiche du personnage au format étroit, avec ses cinq onglets et tout ce qui se lance — c'est V3-D5."
          />
        }
      />
    </div>
  );
}
