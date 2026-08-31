/**
 * Index de l'onglet Wiki (retour utilisateur, suite) — le sommaire vit
 * desormais dans `layout.tsx` (persistant, meme presentation que
 * BookSkin) : cette page n'est plus qu'une invite tant qu'aucune fiche
 * n'est selectionnee, meme motif que `/partage/[token]/page.tsx`.
 */
export default function JoueurWikiIndexPage() {
  return <p className="text-sm text-ink-muted">Choisissez une entité dans le sommaire.</p>;
}
