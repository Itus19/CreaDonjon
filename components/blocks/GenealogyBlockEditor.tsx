"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { GenealogyBlockData } from "@/src/core/schemas/blocks/genealogy";
import type { FamilyTree, FamilyTreeEdge, FamilyTreeNode } from "@/src/core/genealogy/buildFamilyTree";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";
import FamilyTreeCanvas from "@/components/entities/genealogy/FamilyTreeCanvas";
import { useWorldCalendar } from "@/components/shared/useWorldCalendar";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import { ligneDates, type CaseEnfant } from "@/lib/ui/arbre";
import {
  LIENS_FAMILLE,
  lienFamille,
  relationPourLien,
  relationsPourEnfantDeCouple,
  type LienFamille,
  type RelationACreer,
} from "@/lib/ui/liensFamille";

const MENU_WIDTH = 256;

interface AnchorRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** L'étape de recherche : à quelle fiche on ajoute, par quel lien, et (case « + enfant ») sous quel couple. */
interface MenuStep {
  anchorId: string;
  rect: AnchorRect;
  lien: LienFamille;
  couple?: { parentA: string; parentB: string };
}

/**
 * Editeur du bloc genealogie (V2-H3, refait en V3.1-73) : arbre derive de
 * `relations` (jamais stocke ici), rafraichi depuis
 * `/api/entities/[id]/genealogy` apres chaque ajout/suppression.
 *
 * Toucher un portrait fait paraitre, SOUS l'arbre, une barre : nom, dates,
 * « Ouvrir la fiche », « Centrer l'arbre ici » (change la racine affichee —
 * un etat d'affichage, rien n'est enregistre : l'arbre est relu avec cette
 * racine par la meme route) et « Ajouter » avec les neuf liens. Un lien choisi
 * ouvre, juste a cote du bouton, la recherche/creation de fiche — memes routes
 * que `RelationsChips.tsx` (creer/retirer une relation), aucune nouvelle
 * mecanique d'ecriture. La case pointillee « + enfant » sous un couple sans
 * enfant relie le nouvel enfant aux DEUX parents.
 *
 * Le menu est porte hors du canevas via un portail (`createPortal`), en
 * position `fixed` calculee depuis le rectangle reel du bouton : le canevas est
 * dans un conteneur `overflow-hidden`, un menu ancre par simple CSS se ferait
 * rogner.
 */
export default function GenealogyBlockEditor({
  entityId,
  worldId,
  worldSlug,
  data,
  otherEntities,
  onRelationsChanged,
  reloadSignal,
}: {
  entityId: string;
  worldId: string;
  worldSlug: string;
  data: GenealogyBlockData;
  otherEntities: OtherEntityOption[];
  /** Rafraichit la section "Relations" en tete de fiche — meme table, deux vues (V2-H3). */
  onRelationsChanged: () => void;
  /** V2, retour utilisateur : incremente par un ancetre quand une relation change ailleurs (liste du haut, bloc reseau) — force le rechargement de l'arbre. */
  reloadSignal?: number;
}) {
  const t = useTranslations("fiche.genealogie");
  const calendrier = useWorldCalendar(worldSlug);
  const [tree, setTree] = useState<FamilyTree | null>(null);
  const [menu, setMenu] = useState<MenuStep | null>(null);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // « Centrer l'arbre ici » : un etat d'affichage, jamais enregistre.
  const [centreId, setCentreId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const rootEntityId = centreId ?? data.rootEntityId ?? entityId;
  const genealogyUrl = `/api/entities/${entityId}/genealogy?${new URLSearchParams({
    rootEntityId,
    depthUp: String(data.depthUp),
    depthDown: String(data.depthDown),
  })}`;

  useEffect(() => {
    let cancelled = false;
    fetch(genealogyUrl)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: FamilyTree | null) => {
        if (!cancelled && body) setTree(body);
      })
      .catch((e) => console.error("Chargement de la généalogie impossible", e));
    return () => {
      cancelled = true;
    };
  }, [genealogyUrl, reloadSignal]);

  /** Reappel imperatif apres l'ajout/la suppression d'une relation (pas dans un effet, donc sans le meme garde-fou de setState). */
  async function loadTree() {
    const res = await fetch(genealogyUrl);
    if (res.ok) setTree(await res.json());
  }

  function choisirLien(anchorId: string, lien: LienFamille, rect: AnchorRect) {
    setQuery("");
    setErreur(null);
    setMenu({ anchorId, rect, lien });
  }

  function ajouterEnfantDeCouple(c: CaseEnfant, rect: DOMRect) {
    const enfant = lienFamille("enfant");
    if (!enfant) return;
    setQuery("");
    setErreur(null);
    setMenu({ anchorId: c.parentA, rect, lien: enfant, couple: { parentA: c.parentA, parentB: c.parentB } });
  }

  /** Poste les relations, une par une ; la premiere qui echoue est dite, jamais silencieuse. */
  async function creerRelations(relations: RelationACreer[]) {
    for (const r of relations) {
      const res = await fetch(`/api/entities/${r.sourceEntityId}/relations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetEntityId: r.targetEntityId,
          relationType: r.relationType,
          visibility: { level: "public", scopeId: null },
        }),
      });
      if (!res.ok) {
        const corps = (await res.json().catch(() => null)) as { error?: string } | null;
        setErreur(corps?.error ?? t("erreurLien"));
        return false;
      }
    }
    return true;
  }

  async function lierA(autreId: string) {
    if (!menu) return;
    setPending(true);
    const relations = menu.couple
      ? relationsPourEnfantDeCouple(menu.couple.parentA, menu.couple.parentB, autreId)
      : [relationPourLien(menu.anchorId, autreId, menu.lien)];
    const ok = await creerRelations(relations);
    setPending(false);
    if (!ok) return;
    setMenu(null);
    setQuery("");
    await loadTree();
    onRelationsChanged();
  }

  async function createAndLink(name: string) {
    if (!menu || !name.trim()) return;
    setPending(true);
    const res = await fetch("/api/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worldId, name: name.trim(), entityKind: "character" }),
    });
    setPending(false);
    if (!res.ok) {
      const corps = (await res.json().catch(() => null)) as { error?: string } | null;
      setErreur(corps?.error ?? t("erreurCreation"));
      return;
    }
    const created = (await res.json()) as { id: string };
    await lierA(created.id);
  }

  async function deleteEdge(edge: FamilyTreeEdge) {
    await fetch(`/api/relations/${edge.id}`, { method: "DELETE" });
    await loadTree();
    onRelationsChanged();
  }

  /**
   * Bouton oeil sur le portrait : bascule TOUTES les aretes qui touchent ce
   * nœud dans l'arbre affiche. Public si au moins une arete l'est deja ->
   * tout masquer ; sinon tout rendre public. Meme route que RelationsChips.tsx
   * et RelationsGraphBlockEditor.tsx.
   */
  async function toggleNodeVisibility(_node: FamilyTreeNode, edges: FamilyTreeEdge[]) {
    const anyPublic = edges.some((e) => e.visibilityLevel === "public");
    const nextLevel = anyPublic ? "gm" : "public";
    await Promise.all(
      edges.map((edge) =>
        fetch(`/api/relations/${edge.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visibility: { level: nextLevel, scopeId: null } }),
        })
      )
    );
    await loadTree();
    onRelationsChanged();
  }

  if (!tree) return <p className="text-sm text-ink-muted">{t("chargement")}</p>;

  const matches =
    menu && query.trim().length > 0
      ? otherEntities.filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
      : [];

  // Ouvre a droite du bouton par defaut, bascule a gauche si ca deborderait du viewport.
  const menuStyle = menu
    ? (() => {
        const openLeft = menu.rect.right + MENU_WIDTH + 8 > window.innerWidth;
        const left = openLeft ? menu.rect.left - MENU_WIDTH - 8 : menu.rect.right + 8;
        const top = Math.min(menu.rect.top, window.innerHeight - 260);
        return { left: Math.max(8, left), top: Math.max(8, top) };
      })()
    : null;

  const choisi = selectedId ? tree.nodes.find((n) => n.id === selectedId) : undefined;
  const dates = choisi ? ligneDates(choisi, (d) => formatGameDate(d, calendrier), calendrier.currentDate ?? null) : null;
  const racineInitiale = data.rootEntityId ?? entityId;

  return (
    <>
      {centreId && centreId !== racineInitiale && (
        <button
          type="button"
          onClick={() => {
            setCentreId(null);
            setSelectedId(null);
          }}
          className="mb-2 rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised"
        >
          {t("revenir")}
        </button>
      )}
      <FamilyTreeCanvas
        tree={tree}
        rootId={rootEntityId}
        hrefBase={`/m/${worldSlug}/f`}
        calendrier={calendrier}
        selectedId={selectedId}
        onSelectNode={setSelectedId}
        onAddChild={ajouterEnfantDeCouple}
        onDeleteEdge={deleteEdge}
        onToggleNodeVisibility={toggleNodeVisibility}
      />

      {choisi && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-edge bg-panel-sunken px-3 py-2 text-xs">
          <b className="text-sm text-ink">{choisi.name}</b>
          {dates && (
            <span className="text-ink-muted">
              {[dates.naissance, dates.mort].filter(Boolean).join(" – ")}
              {dates.age !== undefined && ` · ${t("age", { n: dates.age })}`}
            </span>
          )}
          <Link
            href={`/m/${worldSlug}/f/${choisi.slug}`}
            prefetch={false}
            className="rounded-full border border-edge px-3 py-1 text-ink transition-colors hover:bg-panel-raised"
          >
            {t("ouvrirFiche")}
          </Link>
          <button
            type="button"
            onClick={() => {
              setCentreId(choisi.id);
              setSelectedId(null);
            }}
            className="rounded-full border border-edge px-3 py-1 text-ink transition-colors hover:bg-panel-raised"
          >
            {t("centrerIci")}
          </button>
          <span className="ml-1 text-xs font-semibold uppercase tracking-wider text-ink-muted">{t("ajouter")}</span>
          <div className="flex flex-wrap gap-1">
            {LIENS_FAMILLE.map((lien) => (
              <button
                key={lien.cle}
                type="button"
                onClick={(e) => choisirLien(choisi.id, lien, e.currentTarget.getBoundingClientRect())}
                className="rounded-full border border-edge px-2.5 py-0.5 text-ink-soft transition-colors hover:bg-panel-raised hover:text-ink"
              >
                {t(`liens.${lien.cle}`)}
              </button>
            ))}
          </div>
        </div>
      )}
      {erreur && <p className="mt-1 text-xs text-danger">{erreur}</p>}

      {menu &&
        menuStyle &&
        createPortal(
          <>
            {/* Fond invisible plein ecran : ferme le menu au clic en dehors. */}
            <div className="fixed inset-0 z-30" onClick={() => setMenu(null)} />
            <div
              onClick={(e) => e.stopPropagation()}
              className="fixed z-40 rounded-lg border border-edge-strong bg-panel-raised p-2 shadow-2xl"
              style={{ left: menuStyle.left, top: menuStyle.top, width: MENU_WIDTH }}
            >
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-ink-muted">{t(`liens.${menu.lien.cle}`)}</span>
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("recherchePlaceholder")}
                  aria-label={t("rechercheLabel")}
                  className="rounded-md border border-edge bg-transparent px-2 py-1 text-sm"
                />
                <div className="flex max-h-40 flex-col overflow-y-auto">
                  {matches.map((entity) => (
                    <button
                      key={entity.id}
                      type="button"
                      aria-busy={pending}
                      onClick={() => {
                        if (!pending) void lierA(entity.id);
                      }}
                      className="rounded px-2 py-1.5 text-left text-xs text-ink hover:bg-panel"
                    >
                      {entity.name}
                    </button>
                  ))}
                  {query.trim().length > 0 && (
                    <button
                      type="button"
                      aria-busy={pending}
                      onClick={() => {
                        if (!pending) void createAndLink(query);
                      }}
                      className="rounded px-2 py-1.5 text-left text-xs text-accent hover:bg-panel"
                    >
                      {t("creer", { nom: query.trim() })}
                    </button>
                  )}
                </div>
                <button type="button" onClick={() => setMenu(null)} className="mt-1 text-left text-xs text-ink-muted hover:text-ink">
                  {t("passer")}
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
