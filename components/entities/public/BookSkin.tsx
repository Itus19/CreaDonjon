"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { filterEntityTree, type EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import EntityTree from "@/components/shell/EntityTree";
import type { WikiBackground } from "@/src/server/services/publicShare";

/** Proprietes CSS personnalisees (`--h`, `--c`, etc.) : React ne les type pas nativement, meme convention que app/layout.tsx pour `--bg-image`. */
type CustomProperties = CSSProperties & Record<`--${string}`, string | number>;

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
 *
 * `wikiBackground` (V2-G13) : fond de PAGE, jamais d'application — le
 * scope `.wiki-bg-scope` (src/styles/tokens.css) recoit `--h`/`--c`/
 * `data-mode` en plus des jetons deja definis pour `:root`, sans jamais
 * toucher `<html>`. Fondu d'entree uniquement (pas de mecanisme de sortie
 * entre deux pages Next.js pour ce premier jet) : opacite 0 au premier
 * rendu, bascule a 1 juste apres le montage pour laisser le navigateur
 * peindre l'etat initial avant de lancer la transition CSS.
 */
export default function BookSkin({
  title,
  worldSlug,
  tree,
  hrefBase,
  children,
  wikiBackground,
}: {
  title: string;
  worldSlug: string;
  tree: EntityTreeGroup[];
  hrefBase: string;
  children: React.ReactNode;
  wikiBackground?: WikiBackground | null;
}) {
  const [query, setQuery] = useState("");
  const [bgVisible, setBgVisible] = useState(false);
  const filteredTree = filterEntityTree(tree, query);
  // Premiere visite (retour utilisateur) : seule la categorie PJ est
  // depliee — calcule depuis `tree` (jamais `filteredTree`, qui varie a
  // chaque frappe dans la recherche et ferait bouger ce defaut).
  const defaultCollapsedKinds = tree.map((group) => group.kind).filter((kind) => kind !== "pj");

  useEffect(() => {
    if (!wikiBackground) return;
    // Un frame pour laisser `opacity: 0` peindre avant de lancer la
    // transition — sans ca, le navigateur peut fusionner les deux etats et
    // le fondu ne se voit jamais.
    const raf = requestAnimationFrame(() => setBgVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [wikiBackground]);

  const scopeStyle: CustomProperties | undefined = wikiBackground
    ? { "--h": wikiBackground.hue, "--c": wikiBackground.chroma }
    : undefined;

  return (
    <div
      className={`flex w-full min-h-full ${wikiBackground ? "wiki-bg-scope" : ""}`}
      data-mode={wikiBackground?.mode}
      style={scopeStyle}
    >
      {wikiBackground && (
        <div
          className="wiki-bg-backdrop"
          aria-hidden="true"
          style={
            {
              opacity: bgVisible ? 1 : 0,
              transitionDuration: `${wikiBackground.fadeMs}ms`,
              "--wiki-bg-image": `url("${wikiBackground.imageUrl}")`,
              "--wiki-bg-blur": `${wikiBackground.blurPx}px`,
            } as CustomProperties
          }
        />
      )}
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
        <EntityTree
          groups={filteredTree}
          worldSlug={worldSlug}
          hrefBase={hrefBase}
          collapseStorageKey={`creadonjon:collapsed:wiki:${worldSlug}`}
          defaultCollapsedKinds={defaultCollapsedKinds}
        />
      </aside>
      <main className="min-w-0 flex-1 px-8 py-10">
        <div className="mx-auto max-w-[70ch]">{children}</div>
      </main>
    </div>
  );
}
