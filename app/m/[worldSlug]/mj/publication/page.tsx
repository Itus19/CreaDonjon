import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { chargerPublication } from "@/src/server/services/publication";
import PublicationPanel from "@/components/shell/PublicationPanel";
import RegisterPrimaryWindow from "@/components/shell/RegisterPrimaryWindow";

/** Ancien onglet "Publication" du menu de réglages (retour utilisateur, gomme le bouton ⚙). V3.1-60 : liens, message, fond par défaut et sommaire public de l'aperçu arrivent avec la page (`chargerPublication`, partagé avec la fenêtre). */
export default async function MjPublicationPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const publication = await chargerPublication(supabase, world);

  return (
    <>
      <RegisterPrimaryWindow windowRef={{ kind: "mj", key: "publication" }} name="Publication" badge="" homeHref={`/m/${worldSlug}/mj/publication`} />
      <PublicationPanel worldSlug={worldSlug} publication={publication} />
    </>
  );
}
