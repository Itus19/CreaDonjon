"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { filterEntityTree, type EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import EntityTree from "@/components/shell/EntityTree";
import type { WikiBackground } from "@/src/server/services/publicShare";
import { useWikiBackground } from "./WikiBackgroundProvider";

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
 * toucher `<html>`. La div de fond elle-meme (fondu d'entree ET de
 * sortie) est portee par `WikiBackgroundProvider` dans le `layout.tsx` du
 * segment — le seul endroit qui persiste entre deux fiches, necessaire
 * pour animer une sortie (retour utilisateur). Ce composant se contente
 * d'enregistrer son propre fond (`useWikiBackground`) et d'appliquer les
 * jetons de couleur actuellement affiches sur son propre conteneur.
 */
export default function BookSkin({
  title,
  worldSlug,
  tree,
  hrefBase,
  children,
  wikiBackground,
  fullWidth,
}: {
  title: string;
  worldSlug: string;
  tree: EntityTreeGroup[];
  hrefBase: string;
  children: React.ReactNode;
  wikiBackground?: WikiBackground | null;
  /** Cartes (Lot I) : un canevas interactif a besoin de toute la largeur disponible, jamais la colonne de lecture a `max-w-[70ch]` — meme echappatoire que `PlayerShell.tsx` pour Wiki/Regles cote joueur. */
  fullWidth?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { displayed } = useWikiBackground(wikiBackground);
  const filteredTree = filterEntityTree(tree, query);
  // Premiere visite (retour utilisateur) : seule la categorie PJ est
  // depliee — calcule depuis `tree` (jamais `filteredTree`, qui varie a
  // chaque frappe dans la recherche et ferait bouger ce defaut).
  const defaultCollapsedKinds = tree.map((group) => group.kind).filter((kind) => kind !== "pj");

  const scopeStyle: CustomProperties | undefined = displayed
    ? { "--h": displayed.hue, "--c": displayed.chroma }
    : undefined;

  return (
    <div
      className={`flex w-full h-full ${displayed ? "wiki-bg-scope" : ""}`}
      data-mode={displayed?.mode}
      style={scopeStyle}
    >
      {/* Sommaire replie par defaut sous md (retour utilisateur : "les
          images de portrait ne s'affichent pas toujours sur smartphone" —
          en realite le sommaire, fixe a 256px, ne se repliait jamais et
          n'y laissait qu'un filet de ~100px pour tout le contenu, portrait
          compris). Meme motif que `Sidebar.tsx`/`MjSidebar.tsx` (bouton
          hamburger + scrim + panneau `fixed` qui glisse), sans le decalage
          `top-14` de ceux-ci : BookSkin n'a pas d'en-tete au-dessus, ni sur
          `/partage/[token]/**` ni sur `/m/[worldSlug]/apercu/**`. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le sommaire"
        className="fixed left-3 top-3 z-40 rounded-md border border-edge bg-panel-raised p-2 text-sm text-ink shadow-md print:hidden md:hidden"
      >
        ☰
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-scrim md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      {/* `overflow-y-auto` sur l'aside ET le main (retour utilisateur, la
          molette ne faisait rien) : `/m/[worldSlug]/apercu/**` est imbrique
          dans `AppShell.tsx`, qui borne la page a `h-screen` avec
          `overflow-hidden` (les fenetres flottantes de l'editeur gerent
          deja leur propre defilement de cette maniere) — sans sa propre
          zone de defilement, un contenu plus long que l'ecran restait
          simplement coupe, sans barre ni molette pour l'atteindre. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] shrink-0 overflow-y-auto bg-panel-sunken px-6 pb-10 pt-16 transition-transform print:hidden md:static md:z-auto md:w-64 md:translate-x-0 md:bg-transparent ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link href={hrefBase} onClick={() => setOpen(false)} className="mb-4 block font-chrome text-base font-semibold text-ink hover:text-accent">
          {title}
        </Link>
        {/* "Cartes" (Lot I, retour utilisateur : "un endroit où je puisse...
            voir la/les cartes en grand", MJ ou wiki public) — meme
            placement que "Chronologie" dans Sidebar.tsx (au-dessus de
            l'arborescence), meme motif : une vue d'ensemble du monde,
            jamais rattachee a une seule fiche. */}
        <Link
          href={`${hrefBase}/cartes`}
          onClick={() => setOpen(false)}
          className="mb-4 block rounded px-2 py-1.5 text-sm text-ink-soft transition-colors hover:bg-panel-raised hover:text-ink"
        >
          Cartes
        </Link>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher…"
          className="mb-4 w-full rounded-md border border-edge bg-transparent px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
        />
        <div onClick={() => setOpen(false)}>
          <EntityTree
            groups={filteredTree}
            worldSlug={worldSlug}
            hrefBase={hrefBase}
            collapseStorageKey={`creadonjon:collapsed:wiki:${worldSlug}`}
            defaultCollapsedKinds={defaultCollapsedKinds}
          />
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto px-4 py-10 pt-16 md:px-8 md:pt-10">
        {fullWidth ? children : <div className="mx-auto max-w-[70ch]">{children}</div>}
      </main>
    </div>
  );
}
