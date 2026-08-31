/**
 * Index de l'onglet Regles (retour utilisateur, suite) — le sommaire vit
 * desormais dans `layout.tsx` (persistant, meme presentation que le wiki) :
 * cette page n'est plus qu'une invite tant qu'aucune regle n'est
 * selectionnee.
 */
export default function JoueurReglesIndexPage() {
  return <p className="text-sm text-ink-muted">Choisissez une règle dans le sommaire.</p>;
}
