"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import type { PaletteEntity } from "./CommandPalette";
import CommandPalette from "./CommandPalette";
import EntityTree from "./EntityTree";
import SectionToggle from "./SectionToggle";
import { createBlankEntityAction } from "@/app/m/[worldSlug]/actions";

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
  const t = useTranslations("shell");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("ouvrirArborescence")}
        className="fixed left-3 top-[68px] z-40 rounded-md border border-edge bg-panel-raised p-2 text-sm text-ink shadow-md print:hidden md:hidden"
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
        className={`fixed inset-y-0 left-0 top-14 z-50 flex w-[280px] shrink-0 flex-col border-r border-edge bg-panel-sunken transition-transform print:hidden md:static md:top-0 md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <SectionToggle worldSlug={worldSlug} />
          <CommandPalette worldId={worldId} worldSlug={worldSlug} entities={entities} />
          <Link
            href={`/m/${worldSlug}/chronologie`}
            onClick={() => setOpen(false)}
            className="rounded px-2 py-1.5 text-sm text-ink-soft transition-colors hover:bg-panel-raised hover:text-ink"
          >
            {t("chronologie")}
          </Link>
          <div onClick={() => setOpen(false)}>
            <EntityTree
              groups={tree}
              worldSlug={worldSlug}
              editable
              collapseStorageKey={`creadonjon:collapsed:entityTree:${worldSlug}`}
            />
          </div>
        </div>

        <div className="border-t border-edge p-4">
          <form action={createBlankEntityAction}>
            <input type="hidden" name="worldId" value={worldId} />
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <button
              type="submit"
              onClick={() => setOpen(false)}
              className="block w-full rounded-full bg-accent px-4 py-2 text-center text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
            >
              {t("nouvelleEntite")}
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
