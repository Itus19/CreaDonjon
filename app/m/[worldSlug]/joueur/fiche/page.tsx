import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { listPlayerEditableEntities } from "@/src/server/services/entities";

/**
 * Index de l'onglet Édition — redirige vers la premiere fiche editable
 * (le personnage revendique en tete, cf. `listPlayerEditableEntities`),
 * meme motif que l'index Wiki ("Choisissez une entité") mais avec un
 * choix par defaut ici : ce joueur a rarement plus d'une poignee de
 * fiches, autant ouvrir directement la plus probable plutot que de forcer
 * un clic supplementaire a chaque visite.
 */
export default async function JoueurFicheIndexPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const campaigns = await listCampaigns(supabase, world.id);
  const campaignId = campaigns[0]?.id ?? null;
  const entities = await listPlayerEditableEntities(supabase, { worldId: world.id, campaignId, userId: user.id });

  if (entities.length === 0) {
    return <p className="text-sm text-ink-muted">Aucune fiche éditable pour l&apos;instant dans ce monde.</p>;
  }
  redirect(`/m/${worldSlug}/joueur/fiche/${entities[0].slug}`);
}
