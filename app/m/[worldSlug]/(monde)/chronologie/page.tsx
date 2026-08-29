import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getWorldTimeline } from "@/src/server/services/timeline";
import WorldTimelineView from "@/components/shell/WorldTimelineView";

/**
 * Vue générale du monde (V2-H2 phase 2) : agrège les entrées visibles de
 * tous les blocs `timeline` du monde — la vue de la chronologie d'ensemble
 * dont on a besoin sans avoir à créer soi-même une fiche « Chronologie »
 * dédiée pour l'obtenir (le mécanisme flexible bloc + entrée reste
 * disponible pour des chronologies filtrées, comme la vie d'un personnage).
 */
export default async function ChronologiePage({
  params,
}: {
  params: Promise<{ worldSlug: string }>;
}) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { entries, calendar } = await getWorldTimeline(supabase, world.id, user.id);

  return <WorldTimelineView worldSlug={worldSlug} entries={entries} calendar={calendar} />;
}
