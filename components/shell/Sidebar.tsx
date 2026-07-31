"use client";

import { useState } from "react";
import Link from "next/link";
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
        className={`fixed inset-y-0 left-0 top-14 z-50 flex w-[280px] shrink-0 flex-col border-r border-edge bg-panel-sunken transition-transform md:static md:top-0 md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <CommandPalette worldId={worldId} worldSlug={worldSlug} entities={entities} />
          <div onClick={() => setOpen(false)}>
            <EntityTree groups={tree} worldSlug={worldSlug} />
          </div>
        </div>

        <div className="border-t border-edge p-4">
          <Link
            href={`/m/${worldSlug}/f/new`}
            onClick={() => setOpen(false)}
            className="block w-full rounded-full bg-accent px-4 py-2 text-center text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
          >
            + Nouvelle entité
          </Link>
        </div>
      </aside>
    </>
  );
}
