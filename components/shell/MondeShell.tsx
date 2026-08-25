import type { EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import type { PaletteEntity } from "./CommandPalette";
import Sidebar from "./Sidebar";
import WindowsDesktop from "./WindowsDesktop";

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
  tree,
  entities,
  children,
}: {
  worldId: string;
  worldSlug: string;
  tree: EntityTreeGroup[];
  entities: PaletteEntity[];
  children: React.ReactNode;
}) {
  return (
    <>
      <Sidebar worldId={worldId} worldSlug={worldSlug} tree={tree} entities={entities} />
      <WindowsDesktop worldSlug={worldSlug}>{children}</WindowsDesktop>
    </>
  );
}
