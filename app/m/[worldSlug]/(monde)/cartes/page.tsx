import { notFound } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { buildViewerForWorld } from "@/src/server/services/visibility";
import { getWorldMaps } from "@/src/server/services/maps";
import WorldMapsView from "@/components/shell/WorldMapsView";

/**
 * Vue générale "Cartes" du monde (Lot I, retour utilisateur : "un endroit
 * où je puisse travailler et où [je] pourrai voir la/les cartes en
 * grand") — agrège tous les blocs `map` du monde, même emplacement dans
 * la barre latérale que "Chronologie" (`Sidebar.tsx`).
 */
export default async function CartesPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const user = await getAuthUser(supabase);
  if (!user) notFound();

  const viewer = await buildViewerForWorld(supabase, world.id, user.id);
  const maps = await getWorldMaps(supabase, world.id, viewer);

  return <WorldMapsView worldSlug={worldSlug} initialMaps={maps} />;
}
