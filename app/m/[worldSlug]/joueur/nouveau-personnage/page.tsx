import { notFound } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import CharacterCreatorWizard from "@/components/blocks/CharacterCreatorWizard";
import { createAndClaimCharacterAction } from "./actions";

/**
 * "Nouveau PJ" depuis l'écran "Choisis ton personnage" (V3.1-10) — même
 * assistant que côté MJ (`mj/creation-personnage`), mais la fiche créée est
 * immédiatement réclamée par la joueuse elle-même (`onCreate`) plutôt que
 * laissée flottante pour une attribution manuelle ultérieure.
 */
export default async function JoueurNouveauPersonnagePage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();
  const user = await getAuthUser(supabase);
  if (!user) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="block-title text-base">Nouveau personnage</h1>
      <CharacterCreatorWizard worldSlug={worldSlug} worldId={world.id} playerRestricted onCreate={createAndClaimCharacterAction} />
    </div>
  );
}
