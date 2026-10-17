"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { EntityTreeGroup, EntityTreeNode } from "@/src/core/entity-tree/build-tree";
import type { PaletteEntity } from "./CommandPalette";
import CommandPalette from "./CommandPalette";
import EntityTree from "./EntityTree";
import { classeItemFlyout, IconeRail, OutilsDalle, Rail, RailFilet, RailPart, RailRow, TraitSvg, useRailReplie } from "./Rail";
import { SectionRailRows } from "./SectionToggle";
import { SectionRecemment } from "./ListeRecents";
import { EnTeteRail } from "./WorldSidebarHeader";
import { useOpenEntityLink } from "./useOpenEntityLink";
import { createBlankEntityAction } from "@/app/m/[worldSlug]/actions";

/** Icone du groupe par type d'entite, rail replie. Un type inconnu retombe sur l'icone generique. */
function IconeGroupe({ kind }: { kind: string }) {
  switch (kind) {
    case "character":
    case "pj":
    case "pnj":
      return (
        <TraitSvg>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </TraitSvg>
      );
    case "location":
    case "carte":
      return (
        <TraitSvg>
          <path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" />
          <path d="M9 4v14M15 6v14" />
        </TraitSvg>
      );
    case "faction":
      return (
        <TraitSvg>
          <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M21 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
        </TraitSvg>
      );
    case "item":
      return (
        <TraitSvg>
          <path d="M5 8h14l-1 12H6L5 8Z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </TraitSvg>
      );
    case "creature":
      return (
        <TraitSvg>
          <path d="M12 3c3 0 6 2.5 6 6 0 2-1 3-1 5 0 3-2 6-5 7-3-1-5-4-5-7 0-2-1-3-1-5 0-3.5 3-6 6-6Z" />
          <path d="M9.5 10h.01M14.5 10h.01" />
        </TraitSvg>
      );
    case "quest":
      return (
        <TraitSvg>
          <path d="M6 21V4M6 4h11l-2 4 2 4H6" />
        </TraitSvg>
      );
    case "event":
      return (
        <TraitSvg>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M4 9h16M8 3v4M16 3v4" />
        </TraitSvg>
      );
    case "session_journal":
      return <IconeRail nom="livres" />;
    default:
      return <IconeRail nom="generique" />;
  }
}

/** Cherche `slug` parmi les noeuds et leurs enfants `part_of` (recursif). */
function contientSlug(noeuds: EntityTreeNode[], slug: string | null): boolean {
  if (!slug) return false;
  return noeuds.some((n) => n.slug === slug || contientSlug(n.children, slug));
}

/** Entree d'un menu de groupe : meme lien et meme ouverture de fenetre que dans l'arbre. */
function LienEntiteMenu({
  node,
  worldSlug,
  actif,
  fermer,
}: {
  node: EntityTreeNode;
  worldSlug: string;
  actif: boolean;
  fermer: () => void;
}) {
  const link = useOpenEntityLink(worldSlug, node.slug);
  return (
    <Link
      role="menuitem"
      href={link.href}
      onClick={(e) => {
        link.onClick(e);
        fermer();
      }}
      // Meme raison que dans `EntityTree` : un clic normal n'y navigue pas, il
      // ouvre une fenetre, donc precharger ces routes serait du rendu serveur perdu.
      prefetch={false}
      className={classeItemFlyout(actif)}
    >
      {node.name}
    </Link>
  );
}

export default function Sidebar({
  worldId,
  worldSlug,
  worldName,
  tree,
  entities,
}: {
  worldId: string;
  worldSlug: string;
  worldName: string;
  tree: EntityTreeGroup[];
  entities: PaletteEntity[];
}) {
  const t = useTranslations("shell");
  const kindLabels = t.raw("kindLabels") as Record<string, string>;
  const [open, setOpen] = useState(false);
  const { replie, basculer } = useRailReplie();
  const pathname = usePathname();
  const slugCourant = pathname.match(/\/f\/([^/]+)/)?.[1] ?? null;
  const slugActif = slugCourant ? decodeURIComponent(slugCourant) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("ouvrirArborescence")}
        // V2.1-16 : plus d'en-tete au-dessus, donc plus de decalage de 68px.
        className="fixed left-3 top-3 z-40 rounded-md border border-edge bg-panel-raised p-2 text-sm text-ink shadow-md print:hidden md:hidden"
      >
        ☰
      </button>

      {/* V3.1-29 : sous 768 px le rail devient une feuille du bas, ouverte par ce
          meme ☰ (le voile est celui de la feuille). */}
      {/* V2.1-16 — jamais de `md:h-screen` : la hauteur vient de la rangee
          bornee par `AppShell`, pas du viewport (100vh pose sous un en-tete
          faisait deborder la page). Le rail (V3.1-27) reste un item flex qui
          s'etire a la hauteur de sa rangee, marges comprises. */}
      <Rail ouvert={open} replie={replie} onBasculer={basculer} onFermer={() => setOpen(false)} titreFeuille={t("entitesDuMonde")}>
        <RailPart className="md:min-h-0 md:flex-1">
          {/* `overflow-x-hidden` avec `overflow-y-auto` : sans lui, une barre
              horizontale apparait pendant l'animation de largeur du rail. */}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 md:gap-0.5 md:overflow-x-hidden md:p-2">
            <EnTeteRail worldSlug={worldSlug} worldName={worldName} replie={replie} />
            {/* V3.1-30 : la bascule Monde/Regles/MJ n'est plus dans la feuille (la
                barre du telephone la remplace) ; « Recemment » prend la tete. */}
            <div className="md:hidden">
              <SectionRecemment worldSlug={worldSlug} espace="mj-monde" onNavigate={() => setOpen(false)} />
            </div>
            <SectionRailRows worldSlug={worldSlug} />
            <RailFilet />
            <CommandPalette
              worldId={worldId}
              worldSlug={worldSlug}
              entities={entities}
              declencheurRail={(ouvrir) => (
                <RailRow icone={<IconeRail nom="loupe" />} libelle={t("rechercher")} onClick={ouvrir} />
              )}
            />
            <Link
              href={`/m/${worldSlug}/chronologie`}
              onClick={() => setOpen(false)}
              className="rounded px-2 py-1.5 text-sm text-ink-soft transition-colors hover:bg-panel-raised hover:text-ink md:hidden"
            >
              {t("chronologie")}
            </Link>
            <div className="hidden md:block">
              <RailRow
                href={`/m/${worldSlug}/chronologie`}
                icone={<IconeRail nom="frise" />}
                libelle={t("chronologie")}
                actif={pathname === `/m/${worldSlug}/chronologie`}
              />
            </div>
            {replie ? (
              // Replie : une ligne par groupe, dont le menu flottant liste les
              // entrees de premier niveau (liens identiques a ceux de l'arbre).
              tree.map((groupe) => (
                <RailRow
                  key={groupe.kind}
                  icone={<IconeGroupe kind={groupe.kind} />}
                  libelle={kindLabels[groupe.kind] ?? groupe.kind}
                  actif={contientSlug(groupe.items, slugActif)}
                  menu={(fermer) =>
                    groupe.items.map((node) => (
                      <LienEntiteMenu key={node.id} node={node} worldSlug={worldSlug} actif={node.slug === slugActif} fermer={fermer} />
                    ))
                  }
                />
              ))
            ) : (
              <div onClick={() => setOpen(false)}>
                <EntityTree
                  groups={tree}
                  worldSlug={worldSlug}
                  editable
                  collapseStorageKey={`creadonjon:collapsed:entityTree:${worldSlug}`}
                />
              </div>
            )}
          </div>

          <div className="border-t border-edge p-4 md:border-0 md:p-2">
            <form action={createBlankEntityAction}>
              <input type="hidden" name="worldId" value={worldId} />
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <button
                type="submit"
                onClick={() => setOpen(false)}
                className="block w-full rounded-full bg-accent px-4 py-2 text-center text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover md:hidden"
              >
                {t("nouvelleEntite")}
              </button>
              <div className="hidden md:block">
                <RailRow soumettre pointille icone={<IconeRail nom="plus" />} libelle={t("nouvelleEntiteRail")} />
              </div>
            </form>
          </div>
        </RailPart>
        <OutilsDalle worldSlug={worldSlug} />
      </Rail>
    </>
  );
}
