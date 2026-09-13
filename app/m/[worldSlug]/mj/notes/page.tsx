import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getOrCreateNotebook } from "@/src/server/services/notebook";
import NotebookWorkspace from "@/components/shell/notebook/NotebookWorkspace";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";

/**
 * Outil MJ "Bloc-notes" (V2.1-2) — même mécanisme de fenêtre que les autres
 * outils MJ pour l'outil lui-même (`RegisterPrimaryWindow`), mais son
 * compagnon (fiche épinglée ouverte depuis le cahier) s'affiche dans un
 * panneau fixe À L'INTÉRIEUR de cette fenêtre (`NotebookWorkspace`,
 * `isGm`) plutôt que dans une seconde fenêtre flottante — retour
 * utilisateur : même disposition que côté joueur (`joueur/notes/page.tsx`),
 * jamais deux comportements différents pour le même outil.
 */
export default async function MjNotesPage({ params }: { params: Promise<{ worldSlug: string }> }) {
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
    <div className="flex h-full flex-col gap-4">
      <RegisterPrimaryWindow windowRef={{ kind: "mj", key: "notes" }} name="Bloc-notes" badge="" homeHref={`/m/${worldSlug}/mj/notes`} />
      <div>
        <h1 className="block-title text-base">Bloc-notes</h1>
        <p className="text-xs text-ink-muted">Vos notes, organisées en pages et sous-pages — privées, jamais visibles des joueuses.</p>
      </div>
      <div className="min-h-0 flex-1">
        <NotebookWorkspace worldSlug={worldSlug} initial={notebook} isGm sessionPrepTemplate />
      </div>
    </div>
  );
}
