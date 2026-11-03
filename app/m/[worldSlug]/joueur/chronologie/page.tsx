import { notFound } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getWorldTimeline } from "@/src/server/services/timeline";
import WorldTimelineView from "@/components/shell/WorldTimelineView";

/**
 * La frise vue par un joueur (V3.1-99) : la même que celle du MJ, sans aucun de
 * ses gestes d'écriture. Le serveur ne renvoie que les dates que ce lecteur peut
 * voir (`getWorldTimeline`, V3.1-96) : rien n'est caché au CSS. Pas de `vueJoueurs`
 * ni de calcul de rôle ici : cette page ne montre jamais les outils du MJ.
 */
export default async function JoueurChronologiePage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const user = await getAuthUser(supabase);
  if (!user) notFound();

  const { entries, calendar } = await getWorldTimeline(supabase, world.id, user.id);

  return <WorldTimelineView worldSlug={worldSlug} entries={entries} calendar={calendar} estMj={false} vueJoueurs={false} />;
}
