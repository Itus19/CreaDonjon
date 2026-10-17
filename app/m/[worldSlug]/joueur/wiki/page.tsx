import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWorldBySlug } from "@/src/server/services/worlds";
import { getLatestSessionJournalSlug } from "@/src/server/services/sessionJournal";
import { WikiBackgroundRegistrar } from "@/components/entities/public/WikiBackgroundProvider";
import AccueilLecteur from "@/components/shell/AccueilLecteur";

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
 *
 * V3.1-30 : `?accueil=1` contourne cette redirection. C'est l'adresse que la
 * barre du telephone (et « re-toucher Wiki ») donne a l'entree Wiki : sous
 * 768 px, la page montre alors l'accueil (recherche + consultees recemment)
 * au lieu de renvoyer vers la derniere entree. Le rail (md+) garde `/wiki`
 * nu et donc la redirection.
 */
export default async function JoueurWikiIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ worldSlug: string }>;
  searchParams: Promise<{ accueil?: string }>;
}) {
  const { worldSlug } = await params;
  const { accueil } = await searchParams;
  const supabase = await createClient();
  const world = await getWorldBySlug(supabase, worldSlug);
  if (!world) notFound();

  if (accueil !== "1") {
    const latestSlug = await getLatestSessionJournalSlug(supabase, world.id);
    if (latestSlug) redirect(`/m/${worldSlug}/joueur/wiki/${latestSlug}`);
  }

  return (
    <>
      {/* V2.1-12 : enregistre un fond NUL — sans cet appel, revenir de la fiche
          au sommaire laisserait le fond de la fiche precedente affiche. */}
      <WikiBackgroundRegistrar background={null} />
      <AccueilLecteur worldSlug={worldSlug} espace="joueur-wiki" />
      <p className="text-sm text-ink-muted max-md:hidden">Choisissez une entité dans le sommaire.</p>
    </>
  );
}
