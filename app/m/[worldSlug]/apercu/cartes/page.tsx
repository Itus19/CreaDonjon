import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { getPublicEntityTree, getPublicWorldMaps } from "@/src/server/services/publicShare";
import BookSkin from "@/components/entities/public/BookSkin";
import PublicWorldMapsView from "@/components/entities/public/PublicWorldMapsView";

/** Vue "Cartes" en prévisualisation (Lot I) — même source que `/partage/[token]/cartes` (`getPublicWorldMaps`, viewer anonyme), seule la garde change (RLS via `getWorldBySlug`, pas un jeton). */
export default async function ApercuCartesPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const [tree, campaigns, maps] = await Promise.all([
    getPublicEntityTree(world.id),
    listCampaigns(supabase, world.id),
    getPublicWorldMaps(world.id),
  ]);
  const title = campaigns[0]?.name ?? world.name;

  return (
    <BookSkin title={title} worldSlug={world.slug} tree={tree} hrefBase={`/m/${world.slug}/apercu`} fullWidth>
      <h1 className="entity-title">Cartes</h1>
      <div className="mt-4">
        <PublicWorldMapsView maps={maps} />
      </div>
    </BookSkin>
  );
}
