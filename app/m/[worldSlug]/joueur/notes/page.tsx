import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getOrCreateNotebook } from "@/src/server/services/notebook";
import NotebookWorkspace from "@/components/shell/notebook/NotebookWorkspace";

/**
 * Cahier de notes joueuse (V2.1-2, remplace l'ancien textarea unique
 * V2-M7b) — mode `split` : la coquille joueur (`PlayerShell.tsx`) n'a pas
 * de fenêtres flottantes, un lien ouvre donc son compagnon dans un panneau
 * fixe à droite plutôt que dans une fenêtre du bureau (réservé au MJ).
 */
export default async function JoueurNotesPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const notebook = await getOrCreateNotebook(supabase, { worldId: world.id, userId: user.id });

  return (
    <div className="flex h-full min-h-[480px] flex-col gap-2">
      <p className="text-xs text-ink-muted">Privées — ni le MJ ni les autres joueurs ne les voient, sauf ce que vous épinglez et qui reste soumis à sa visibilité normale.</p>
      <div className="min-h-0 flex-1">
        <NotebookWorkspace worldSlug={worldSlug} initial={notebook} mode="split" />
      </div>
    </div>
  );
}
