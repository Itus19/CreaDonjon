import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getEntityBySlug } from "@/src/server/repos/entities";
import { listVisibleBlocks } from "@/src/server/services/blocks";
import PlayerBlockView from "@/components/entities/player/PlayerBlockView";

/**
 * Fiche en lecture seule (V2-M7b, coquille joueur) — `listVisibleBlocks`
 * (deja filtre par la VRAIE visibilite du joueur, canSee/filterBlocks) puis
 * `PlayerBlockView` (rendu, jamais d'affordance d'edition). Premiere
 * tranche de types de blocs geres — voir le composant pour le detail.
 */
export default async function JoueurWikiEntityPage({
  params,
}: {
  params: Promise<{ worldSlug: string; entitySlug: string }>;
}) {
  const { worldSlug, entitySlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const entity = await getEntityBySlug(supabase, world.id, entitySlug);
  if (!entity) notFound();

  const blocks = await listVisibleBlocks(supabase, world.id, entity.id, user.id);

  return (
    <div className="flex flex-col gap-3">
      <Link href={`/m/${worldSlug}/joueur/wiki`} className="text-xs text-ink-muted hover:text-ink">
        ← Wiki
      </Link>
      <h2 className="text-lg font-semibold text-ink">{entity.name}</h2>
      {blocks.length === 0 ? (
        <p className="text-sm text-ink-muted">Rien de visible pour l&apos;instant.</p>
      ) : (
        blocks.map((block) => <PlayerBlockView key={block.id} block={block} />)
      )}
    </div>
  );
}
