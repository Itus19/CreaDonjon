import { notFound } from "next/navigation";
import { loadNotebookWorkspace } from "@/src/server/services/sharedNotes";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
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

  const notebook = await loadNotebookWorkspace(supabase, { worldId: world.id, userId: user.id });

  return (
    <div className="flex h-full min-h-[480px] flex-col gap-2">
      <p className="text-xs text-ink-muted">Privées par défaut : seule une page que vous passez sur « La table » est lue par les autres, sans qu&apos;ils puissent l&apos;écrire.</p>
      <div className="min-h-0 flex-1">
        <NotebookWorkspace worldSlug={worldSlug} initial={notebook} />
      </div>
    </div>
  );
}
