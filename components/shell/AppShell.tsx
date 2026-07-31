import Link from "next/link";
import type { EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import type { PaletteEntity } from "./CommandPalette";
import Sidebar from "./Sidebar";
import Panel from "./Panel";

/**
 * Barre superieure, barre laterale, zone de travail
 * (specs/coquille-et-design.md §3). Le mode solo (bascule au centre)
 * viendra en V3 : l'onglet existe pour la forme, desactive.
 */
export default function AppShell({
  worldName,
  worldSlug,
  tree,
  entities,
  children,
}: {
  worldName: string;
  worldSlug: string;
  tree: EntityTreeGroup[];
  entities: PaletteEntity[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-edge bg-panel px-4">
        <Link href={`/m/${worldSlug}`} className="truncate font-chrome text-sm font-semibold text-ink">
          {worldName}
        </Link>
        <div className="flex items-center gap-1 rounded-full border border-edge p-0.5 text-xs">
          <span className="rounded-full bg-panel-raised px-3 py-1 text-ink">Monde</span>
          <span className="cursor-not-allowed px-3 py-1 text-ink-muted" title="Bientôt (V1)">
            Règles
          </span>
        </div>
        <Link href="/" className="text-sm text-ink-muted hover:text-ink">
          Mes mondes
        </Link>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar worldSlug={worldSlug} tree={tree} entities={entities} />
        <main className="flex flex-1 overflow-y-auto p-8">
          <Panel>{children}</Panel>
        </main>
      </div>
    </div>
  );
}
