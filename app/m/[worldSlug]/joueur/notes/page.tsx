import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getOrCreateNotebook } from "@/src/server/services/notebook";
import NotebookWorkspace from "@/components/shell/notebook/NotebookWorkspace";

/**
 * Cahier de notes joueuse (V2.1-2, remplace l'ancien textarea unique
 * V2-M7b) — un lien ouvre son compagnon dans un panneau fixe à droite,
 * même disposition que côté MJ (`mj/notes/page.tsx`).
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
        <NotebookWorkspace worldSlug={worldSlug} initial={notebook} />
      </div>
    </div>
  );
}
