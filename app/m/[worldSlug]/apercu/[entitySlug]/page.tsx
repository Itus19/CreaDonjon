import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { getPublicEntityDetail, getPublicEntityTree } from "@/src/server/services/publicShare";
import PublicEntityBody from "@/components/entities/public/PublicEntityBody";
import BookSkin from "@/components/entities/public/BookSkin";

/** Voir `app/m/[worldSlug]/apercu/page.tsx` — même principe, une fiche précise. */
export default async function ApercuEntityPage({
  params,
}: {
  params: Promise<{ worldSlug: string; entitySlug: string }>;
}) {
  const { worldSlug, entitySlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const [detail, tree, campaigns] = await Promise.all([
    getPublicEntityDetail(world.id, entitySlug),
    getPublicEntityTree(world.id),
    listCampaigns(supabase, world.id),
  ]);
  if (!detail) notFound();

  const title = campaigns[0]?.name ?? world.name;

  return (
    <BookSkin title={title} worldSlug={world.slug} tree={tree} hrefBase={`/m/${world.slug}/apercu`}>
      <p className="mb-1 font-mech text-xs text-ink-muted">Prévisualisation — vue d&apos;un visiteur anonyme</p>
      <PublicEntityBody {...detail} hrefBase={`/m/${world.slug}/apercu`} />
    </BookSkin>
  );
}
