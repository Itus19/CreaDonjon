import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { listShareLinks } from "@/src/server/services/shareLinks";
import PublicationPanel from "@/components/shell/PublicationPanel";

/** Ancien onglet "Publication" du menu de réglages (retour utilisateur, gomme le bouton ⚙) — même donnees que `GET /api/worlds/[worldSlug]/share-links`, lues ici directement (contexte serveur de monde reel) plutot qu'un fetch client. */
export default async function MjPublicationPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const links = await listShareLinks(supabase, world.id);

  return (
    <PublicationPanel
      worldId={world.id}
      worldSlug={worldSlug}
      initialLinks={links}
      initialWikiWelcomeMessage={world.wiki_welcome_message ?? ""}
    />
  );
}
