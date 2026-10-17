import type { EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import type { PaletteEntity } from "./CommandPalette";
import Sidebar from "./Sidebar";
import WindowsDesktop from "./WindowsDesktop";
import { ArbreLecteurProvider } from "./ArbreLecteurContext";

/**
 * Contenu de la section Monde : barre laterale des entites + rendu des
 * fenetres flottantes (ADR-0011). L'etat des fenetres lui-meme vit plus
 * haut (`DesktopWindowsProvider`, monte dans `app/m/[worldSlug]/layout.tsx`,
 * partage avec Regles) — ce composant ne monte que le rendu et sa propre
 * barre laterale.
 */
export default function MondeShell({
  worldId,
  worldSlug,
  worldName,
  tree,
  entities,
  children,
}: {
  worldId: string;
  worldSlug: string;
  worldName: string;
  tree: EntityTreeGroup[];
  entities: PaletteEntity[];
  children: React.ReactNode;
}) {
  return (
    // V3.1-30 : l'arbre deja charge sert aussi a la recherche locale de l'accueil du telephone.
    <ArbreLecteurProvider tree={tree}>
      <Sidebar worldId={worldId} worldSlug={worldSlug} worldName={worldName} tree={tree} entities={entities} />
      <WindowsDesktop>{children}</WindowsDesktop>
    </ArbreLecteurProvider>
  );
}
