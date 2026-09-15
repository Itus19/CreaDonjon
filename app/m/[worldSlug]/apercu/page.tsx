import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { getPublicEntityTree, getLatestPublicSessionJournalSlug } from "@/src/server/services/publicShare";
import { WikiBackgroundRegistrar } from "@/components/entities/public/WikiBackgroundProvider";

/**
 * Prévisualisation authentifiée (V2-G2) : ce que verrait un lien de partage
 * sans mot de passe (`scope='public_only'`), sans en dépenser un — gardée
 * par `getWorldBySlug` (RLS), pas par un jeton. Mêmes fonctions que
 * `/partage/[token]/**` (`src/server/services/publicShare.ts`), même peau
 * (`BookSkin`) — seule la source du `worldId` change.
 *
 * V2.1-12 : la peau est montée par `layout.tsx`, cette page ne rend plus que
 * le contenu de la colonne de lecture. Elle enregistre en revanche un fond
 * **nul** : sans cet appel, revenir de la fiche au sommaire laisserait le fond
 * de la fiche précédente affiché.
 */
export default async function ApercuWorldPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const latestSlug = await getLatestPublicSessionJournalSlug(world.id);
  if (latestSlug) redirect(`/m/${world.slug}/apercu/${latestSlug}`);

  const [tree, campaigns] = await Promise.all([getPublicEntityTree(world.id), listCampaigns(supabase, world.id)]);
  const title = campaigns[0]?.name ?? world.name;

  return (
    <>
      <WikiBackgroundRegistrar background={null} />
      <p className="font-mech text-xs text-ink-muted">Prévisualisation — vue d&apos;un visiteur anonyme</p>
      <h1 className="entity-title mt-1">{title}</h1>
      {tree.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">Ce monde n&apos;a encore aucun contenu public.</p>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">Choisissez une entité dans le sommaire.</p>
      )}
    </>
  );
}
