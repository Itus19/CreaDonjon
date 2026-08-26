/**
 * Simple conteneur stylise. Le multi-panneau envisage ici a l'origine
 * (specs/coquille-et-design.md §4.2, V0) a ete devance et execute
 * autrement : ADR-0006 fait de `?avec=` une liste de fiches ouvertes en
 * fenetres flottantes (`WindowFrame`/`DesktopWindowsProvider`), jamais des
 * `<Panel>` cote a cote — ce composant ne sert plus qu'a l'affichage
 * mobile et au fond vide du bureau avant qu'une fiche ne s'ouvre
 * (`WindowsDesktop.tsx`).
 */
export default function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-1 flex-col gap-6 rounded-lg border border-edge bg-panel p-8 shadow-xl backdrop-blur-[var(--blur)]">
      {children}
    </div>
  );
}
