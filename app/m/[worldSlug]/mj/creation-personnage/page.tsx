import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import CharacterCreatorWizard from "@/components/blocks/CharacterCreatorWizard";

/**
 * Assistant de creation de personnage (V2-G1, sur demande explicite de
 * l'utilisateur : "d'abord un outil complet dans l'ecran MJ avant de
 * l'integrer cote monde via un bloc"). Parcours en sept etapes
 * (specs/wiki-liens-et-personnages.md §B8), meme moteur de resolution que la
 * fiche jouable (`useCharacterSheetContext`) pour un apercu fidele avant
 * creation reelle de l'entite.
 */
export default async function MjCreationPersonnagePage({
  params,
}: {
  params: Promise<{ worldSlug: string }>;
}) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="block-title text-base">Création de personnage</h1>
        <p className="text-xs text-ink-muted">
          Composez un personnage étape par étape en suivant les règles du monde, puis créez sa fiche.
        </p>
      </div>
      <CharacterCreatorWizard worldSlug={worldSlug} worldId={world.id} />
    </div>
  );
}
