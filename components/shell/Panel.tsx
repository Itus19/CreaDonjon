/**
 * Conteneur de fiche, isole pour le futur multi-panneau
 * (specs/coquille-et-design.md §4.2) : un seul panneau en V0, mais deja
 * son propre composant pour qu'en ajouter un second (`?avec=`) en V1 ne
 * demande pas de refonte.
 */
export default function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-1 flex-col gap-6 rounded-lg border border-edge bg-panel p-8 shadow-xl backdrop-blur-[var(--blur)]">
      {children}
    </div>
  );
}
