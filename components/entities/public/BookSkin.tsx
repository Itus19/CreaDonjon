"use client";

import { useState } from "react";
import Link from "next/link";
import { filterEntityTree, type EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import EntityTree from "@/components/shell/EntityTree";

/**
 * Peau « livre » du wiki (V2-G2) : mêmes composants que la coquille
 * d'édition (`EntityTree`), jetons différents — sommaire hiérarchique à
 * gauche, corps de texte à largeur mesurée (65–75 caractères, `max-w-[70ch]`)
 * à droite, aucune commande d'édition. Utilisée à la fois par
 * `/partage/[token]/**` (visiteur anonyme) et `/m/[worldSlug]/apercu/**`
 * (prévisualisation authentifiée) — seule la source des données change.
 *
 * `title` : nom de la campagne si le monde en a une, sinon nom du monde
 * (calculé par l'appelant — voir `getPublicCampaignName`/`listCampaigns`).
 *
 * Recherche locale (retour utilisateur) : l'arborescence complète est deja
 * chargee par le serveur, filtrer en local (`filterEntityTree`) evite un
 * aller-retour reseau pour une poignee d'entites — pas le meme besoin que
 * `CommandPalette` (recherche serveur, creation, fenetres flottantes),
 * jamais reutilise ici pour cette raison.
 */
export default function BookSkin({
  title,
  worldSlug,
  tree,
  hrefBase,
  children,
}: {
  title: string;
  worldSlug: string;
  tree: EntityTreeGroup[];
  hrefBase: string;
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const filteredTree = filterEntityTree(tree, query);

  return (
    <div className="flex w-full min-h-full">
      <aside className="w-64 shrink-0 px-6 pb-10 pt-16">
        <Link href={hrefBase} className="mb-4 block font-chrome text-base font-semibold text-ink hover:text-accent">
          {title}
        </Link>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher…"
          className="mb-4 w-full rounded-md border border-edge bg-transparent px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
        />
        <EntityTree groups={filteredTree} worldSlug={worldSlug} hrefBase={hrefBase} />
      </aside>
      <main className="min-w-0 flex-1 px-8 py-10">
        <div className="mx-auto max-w-[70ch]">{children}</div>
      </main>
    </div>
  );
}
