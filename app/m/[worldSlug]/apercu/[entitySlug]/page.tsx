import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listCampaigns } from "@/src/server/services/campaigns";
import { getPublicEntityDetail, getPublicEntityTree } from "@/src/server/services/publicShare";
import { ENTITY_KIND_LABELS } from "@/components/shared/entityKindLabels";
import PublicBlockView from "@/components/entities/public/PublicBlockView";
import PublicPortrait from "@/components/entities/public/PublicPortrait";
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

  const { entity, blocks } = detail;
  const title = campaigns[0]?.name ?? world.name;

  return (
    <BookSkin title={title} worldSlug={world.slug} tree={tree} hrefBase={`/m/${world.slug}/apercu`}>
      <p className="font-mech text-xs text-ink-muted">Prévisualisation — vue d&apos;un visiteur anonyme</p>
      <div className="mt-1 flex items-start gap-4">
        <PublicPortrait entityId={entity.id} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h1 className="entity-title flex-1">{entity.name || "(sans nom)"}</h1>
            <span className="shrink-0 whitespace-nowrap text-sm font-medium text-ink-muted">
              {ENTITY_KIND_LABELS[entity.entity_kind as keyof typeof ENTITY_KIND_LABELS] ?? entity.entity_kind}
            </span>
          </div>

          {entity.aliases.length > 0 && (
            <p className="mt-1 text-xs text-ink-muted">Alias : {entity.aliases.join(", ")}</p>
          )}
        </div>
      </div>

      {blocks.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">Aucun contenu public pour cette fiche.</p>
      ) : (
        <div className="mt-4 flex flex-col">
          {blocks.map((block) => (
            <PublicBlockView key={block.id} block={block} />
          ))}
        </div>
      )}
    </BookSkin>
  );
}
