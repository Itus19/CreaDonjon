"use client";

import { useState } from "react";
import { filterEntityTree, type EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import EntityTree from "./EntityTree";

/**
 * Sommaire de l'onglet Wiki (retour utilisateur, suite) — recherche locale
 * + arborescence, meme structure que `BookSkin.tsx` (peau du wiki public)
 * mais sans son en-tete "titre -> racine du wiki" (deja couvert par le rail
 * de navigation joueur) et sans jamais l'edition (`editable` omis, meme
 * defaut que BookSkin).
 */
export default function PlayerWikiSidebar({ worldSlug, tree }: { worldSlug: string; tree: EntityTreeGroup[] }) {
  const [query, setQuery] = useState("");
  const filteredTree = filterEntityTree(tree, query);
  const defaultCollapsedKinds = tree.map((group) => group.kind).filter((kind) => kind !== "pj");

  return (
    <div className="flex flex-col gap-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher…"
        className="w-full rounded-md border border-edge bg-transparent px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
      />
      <EntityTree
        groups={filteredTree}
        worldSlug={worldSlug}
        hrefBase={`/m/${worldSlug}/joueur/wiki`}
        collapseStorageKey={`creadonjon:collapsed:wiki-joueur:${worldSlug}`}
        defaultCollapsedKinds={defaultCollapsedKinds}
      />
    </div>
  );
}
