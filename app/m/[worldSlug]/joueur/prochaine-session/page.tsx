import { notFound } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import NextSessionPanel from "@/components/shell/scheduling/NextSessionPanel";
import { chargerProchaineSession } from "@/src/server/services/prochaineSession";

/**
 * Page "Prochaine session" côté joueuse (V3.1-8/V3.1-9) — une page normale
 * de la coquille joueuse, jamais une fenêtre pop-up (retour utilisateur :
 * "à l'image de ce que le joueur peut voir pour les autres onglets").
 */
export default async function JoueurProchaineSessionPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();
  const user = await getAuthUser(supabase);
  if (!user) notFound();
  // V3.1-62, étape 3 (C1) : la demande ouverte, le tableau et les séances arrivent avec la page.
  const initial = await chargerProchaineSession(supabase, { worldId: world.id, userId: user.id });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
      <h1 className="block-title text-base">Prochaine session</h1>
      <NextSessionPanel worldSlug={worldSlug} initial={initial} />
    </div>
  );
}
