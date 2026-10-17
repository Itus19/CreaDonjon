import AccueilLecteur from "@/components/shell/AccueilLecteur";

/**
 * Index de l'onglet Regles (retour utilisateur, suite) — le sommaire vit
 * desormais dans `layout.tsx` (persistant, meme presentation que le wiki) :
 * cette page n'est plus qu'une invite tant qu'aucune regle n'est
 * selectionnee. V3.1-30 : sous 768 px, l'invite cede la place a l'accueil du
 * telephone (recherche + consultees recemment).
 */
export default async function JoueurReglesIndexPage({ params }: { params: Promise<{ worldSlug: string }> }) {
  const { worldSlug } = await params;
  return (
    <>
      <AccueilLecteur worldSlug={worldSlug} espace="joueur-regles" />
      <p className="text-sm text-ink-muted max-md:hidden">Choisissez une règle dans le sommaire.</p>
    </>
  );
}
