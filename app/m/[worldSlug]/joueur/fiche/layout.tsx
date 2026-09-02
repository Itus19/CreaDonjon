import { notFound, redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { listPlayerEditableEntities } from "@/src/server/services/entities";
import PlayerEditableEntitiesSidebar from "@/components/shell/PlayerEditableEntitiesSidebar";
import TwoPaneReaderLayout from "@/components/shell/TwoPaneReaderLayout";

/**
 * Onglet Édition (V2-M13, renomme depuis "Fiche" — retour utilisateur :
 * "remplace le terme 'Fiche' par 'Édition' dans le menu joueur") — meme
 * disposition a deux volets que Wiki/Regles (`TwoPaneReaderLayout`),
 * sommaire a GAUCHE comme le Wiki (retour utilisateur, revient sur le
 * `side="right"` initial de V2-M13) et jamais l'arborescence complete du
 * monde : uniquement les fiches que ce joueur peut editer (son personnage
 * revendique + les fiches de lore octroyees), pour naviguer entre elles
 * sans repasser par le Wiki general.
 */
export default async function JoueurFicheLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ worldSlug: string }>;
}) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();
  const user = await getAuthUser(supabase);
  if (!user) redirect("/login");

  const campaigns = await listCampaigns(supabase, world.id);
  const campaignId = campaigns[0]?.id ?? null;
  const entities = await listPlayerEditableEntities(supabase, { worldId: world.id, campaignId, userId: user.id });

  return (
    <TwoPaneReaderLayout sidebar={<PlayerEditableEntitiesSidebar worldSlug={worldSlug} entities={entities} />}>
      {children}
    </TwoPaneReaderLayout>
  );
}
