import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getLatestSessionJournalSlug } from "@/src/server/services/sessionJournal";

/**
 * Index de l'onglet Wiki (retour utilisateur, suite) — le sommaire vit
 * dans `layout.tsx` (persistant, meme presentation que BookSkin) : cette
 * page reste une invite tant qu'aucune fiche n'est selectionnee...
 *
 * ...sauf si le Livre de sessions a au moins une entree redigee (V2.1-3,
 * retour utilisateur : "le wiki public s'ouvre toujours sur la page la
 * plus récente par défaut comme écran d'accueil") — redirige alors vers
 * cette fiche plutot que d'afficher l'invite, meme mecanisme cote
 * `/apercu` et `/partage/[token]`.
 */
export default async function JoueurWikiIndexPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  const latestSlug = await getLatestSessionJournalSlug(supabase, world.id);
  if (latestSlug) redirect(`/m/${worldSlug}/joueur/wiki/${latestSlug}`);

  return <p className="text-sm text-ink-muted">Choisissez une entité dans le sommaire.</p>;
}
