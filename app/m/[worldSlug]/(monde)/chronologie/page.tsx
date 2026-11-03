import { notFound } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getWorldTimeline } from "@/src/server/services/timeline";
import { isWorldAdmin } from "@/src/server/services/permissions";
import { estVueJoueurs } from "@/lib/ui/frise";
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
  searchParams,
}: {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ vue?: string | string[] }>;
}) {
  const { worldSlug } = await params;
  const { vue } = await searchParams;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const user = await getAuthUser(supabase);
  if (!user) notFound();

  // V3.1-98 : « Voir comme les joueurs » est demandé au serveur (`?vue=joueurs`), qui
  // retire les dates du MJ du flux ; le service refuse la demande à qui n'est pas MJ.
  const estMj = await isWorldAdmin(supabase, { worldId: world.id, userId: user.id });
  const vueJoueurs = estMj && estVueJoueurs(vue);
  const { entries, calendar } = await getWorldTimeline(supabase, world.id, user.id, { vueJoueurs });

  return <WorldTimelineView worldSlug={worldSlug} entries={entries} calendar={calendar} estMj={estMj} vueJoueurs={vueJoueurs} />;
}
