import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { ensureGeneratorToolsEntity } from "@/src/server/services/entities";
import { resolveGeneratorToolsForEntity } from "@/src/server/services/generators";
import GeneratorToolPanel from "@/components/shell/GeneratorToolPanel";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";

/**
 * Page dediee de l'outil MJ "Générateurs" (V2-J1 Phase 2) — outil autonome,
 * jamais attache a une fiche de wiki (retour utilisateur explicite : "je ne
 * suis pas sûr que je veux des outils directement dans les fiches"). Ne
 * depend d'aucune campagne (contrairement a Rencontres/Initiative), donc
 * pas de selecteur `?campagne=` ici — seulement du monde.
 */
export default async function MjGenerateursPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const entityId = await ensureGeneratorToolsEntity(supabase, world.id, user.id);
  const tools = await resolveGeneratorToolsForEntity(supabase, entityId);

  return (
    <div className="flex flex-col gap-4">
      <RegisterPrimaryWindow windowRef={{ kind: "mj", key: "generateurs" }} name="Générateurs" badge="" homeHref={`/m/${worldSlug}/mj/generateurs`} />
      <div>
        <h1 className="block-title text-base">Générateurs</h1>
        <p className="text-xs text-ink-muted">
          Composez taverne, échoppe ou PNJ section par section — chaque emplacement se relance individuellement.
        </p>
      </div>
      <GeneratorToolPanel worldSlug={worldSlug} tools={tools} />
    </div>
  );
}
