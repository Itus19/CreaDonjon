import { Suspense } from "react";
import type { EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import type { PaletteEntity } from "./CommandPalette";
import Sidebar from "./Sidebar";
import DesktopWindows from "./DesktopWindows";

/**
 * Contenu de la section Monde : barre laterale des entites + fenetres
 * flottantes (ADR-0006). Extrait de l'ancien AppShell pour que la section
 * Regles puisse avoir sa propre barre laterale sans ce mecanisme, qui
 * n'a de sens que pour l'edition de fiches en parallele.
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
    <Suspense fallback={null}>
      <DesktopWindows
        worldSlug={worldSlug}
        sidebar={<Sidebar worldId={worldId} worldSlug={worldSlug} tree={tree} entities={entities} />}
      >
        {children}
      </DesktopWindows>
    </Suspense>
  );
}
