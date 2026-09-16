"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { filterEntityTree, type EntityTreeGroup } from "@/src/core/entity-tree/build-tree";
import EntityTree from "@/components/shell/EntityTree";
import { useWikiBackgroundDisplay } from "./WikiBackgroundProvider";

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
 * Fond de page (V2-G13) : fond de PAGE, jamais d'application — le scope
 * `.wiki-bg-scope` (src/styles/tokens.css) recoit `--h`/`--c`/`data-mode` en
 * plus des jetons deja definis pour `:root`, sans jamais toucher `<html>`. La
 * div de fond elle-meme (fondu d'entree ET de sortie) est portee par
 * `WikiBackgroundProvider`. Ce composant se contente d'APPLIQUER les jetons du
 * fond actuellement affiche sur son propre conteneur ; c'est la page qui
 * DECLARE le sien, via `WikiBackgroundRegistrar`.
 *
 * V2.1-12 : monte dans le `layout.tsx` de chaque route, plus dans les pages.
 * La coquille est par MONDE — l'y laisser dans la page la reconstruisait a
 * chaque fiche, ce qui vidait la recherche, perdait le defilement du sommaire
 * et faisait scintiller son repli (lu depuis `localStorage` dans un effet,
 * donc apres le premier rendu). Le fond, lui, est par FICHE et reste declare
 * par la page. Troisieme appelant ajoute au meme moment : l'onglet Wiki de la
 * coquille joueur, qui reimplementait cette meme disposition sans le fond.
 */
export default function BookSkin({
  title,
  worldSlug,
  tree,
  hrefBase,
  children,
  banner,
}: {
  title: string;
  worldSlug: string;
  tree: EntityTreeGroup[];
  hrefBase: string;
  children: React.ReactNode;
  /**
   * V2.1-12 : bandeau pose au-dessus du contenu, dans la colonne de lecture —
   * la bannière de séance de la coquille joueur, qui n'avait nulle part où
   * aller une fois `TwoPaneReaderLayout` retiré. Rendu par le layout, donc
   * monté une seule fois pour toutes les fiches du monde, comme le sommaire.
   */
  banner?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // V2.1-12 : ce composant LIT le fond, il ne l'enregistre plus. Il vit
  // desormais dans le `layout.tsx` (il est par monde), alors que le fond est
  // par fiche — seule la page peut le declarer, via `WikiBackgroundRegistrar`.
  const { displayed } = useWikiBackgroundDisplay();
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
      {/* V2.1-13 — le COUPLE sommaire + texte est borne et centre, plutot que
          le texte seul centre dans ce qui reste apres le sommaire. Avant, le
          vide n'etait pas une marge choisie mais un reste : ~300px entre les
          deux colonnes sur un ecran de 1920, ~100px sur un portable, zero en
          dessous. Le sommaire se lisait comme appartenant a une autre page.

          Borne exprimee dans les unites du CONTENU, jamais en pixels devines :
          `16rem` est la largeur du sommaire (`md:w-64` ci-dessous), `70ch`
          celle de la colonne de prose (`max-w-[70ch]` plus bas), `4rem` le
          rembourrage que `main` pose deja (`md:px-8`, des deux cotes). Elle
          suit donc la police si elle change, au lieu de se perimer.

          Une largeur MAXIMALE, pas une regle conditionnelle : sous le seuil,
          elle cesse simplement de mordre et la disposition redevient celle
          d'avant. Rien a tester en dessous, aucun cas particulier a ecrire. */}
      <div className="mx-auto flex h-full w-full min-w-0 max-w-[calc(16rem+70ch+4rem)]">
      {/* Sommaire replie par defaut sous md (retour utilisateur : "les
          images de portrait ne s'affichent pas toujours sur smartphone" —
          en realite le sommaire, fixe a 256px, ne se repliait jamais et
          n'y laissait qu'un filet de ~100px pour tout le contenu, portrait
          compris). Meme motif que `Sidebar.tsx`/`MjSidebar.tsx` (bouton
          hamburger + scrim + panneau `fixed` qui glisse). Ces deux-la
          portaient un decalage `top-14` pour l'en-tete de la coquille ; il a
          disparu avec elle (V2.1-16), et les trois tiroirs partent desormais
          du meme haut d'ecran — celui que BookSkin a toujours eu. */}
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
          dans `AppShell.tsx`, qui borne la coquille a la hauteur de l'ecran
          (`min-h-0` + `overflow-hidden`, V2.1-16 — la description precedente
          parlait d'un `h-screen` qui n'a jamais existe la) : sans sa propre
          zone de defilement, un contenu plus long que l'ecran resterait
          simplement coupe, sans barre ni molette pour l'atteindre. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] shrink-0 overflow-y-auto bg-panel-sunken px-6 pb-10 pt-16 transition-transform print:hidden md:static md:z-auto md:w-64 md:translate-x-0 md:bg-transparent ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* `prefetch={false}` (V2.1-20 lot 6) : le dernier des dix-huit. Sur
            `/partage`, cette racine REDIRIGE de surcroit vers la derniere
            entree du Livre de sessions — precharger une redirection est du
            travail serveur dont il ne reste rien. */}
        <Link href={hrefBase} prefetch={false} onClick={() => setOpen(false)} className="mb-4 block font-chrome text-base font-semibold text-ink hover:text-accent">
          {title}
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
        <div className="mx-auto max-w-[70ch]">
          {banner}
          {children}
        </div>
      </main>
      </div>
    </div>
  );
}
