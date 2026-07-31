"use client";

import { useState } from "react";
import type { EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import type { PaletteEntity } from "./CommandPalette";
import CommandPalette from "./CommandPalette";
import EntityTree from "./EntityTree";

export default function Sidebar({
  worldId,
  worldSlug,
  tree,
  entities,
}: {
  worldId: string;
  worldSlug: string;
  tree: EntityTreeGroup[];
  entities: PaletteEntity[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir l'arborescence"
        className="fixed left-3 top-[68px] z-40 rounded-md border border-edge bg-panel-raised p-2 text-sm text-ink shadow-md md:hidden"
      >
        ☰
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-scrim md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 top-14 z-50 flex w-[280px] shrink-0 flex-col gap-4 border-r border-edge bg-panel-sunken p-4 transition-transform md:static md:top-0 md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <CommandPalette worldId={worldId} worldSlug={worldSlug} entities={entities} />
        <div className="flex-1 overflow-y-auto" onClick={() => setOpen(false)}>
          <EntityTree groups={tree} worldSlug={worldSlug} />
        </div>
      </aside>
    </>
  );
}
