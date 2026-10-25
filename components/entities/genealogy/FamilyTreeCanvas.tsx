"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import EyeIcon from "@/components/shared/EyeIcon";
import FamilyTreeCard from "@/components/entities/genealogy/FamilyTreeCard";
import { formatGameDate } from "@/src/core/calendar/formatDate";
import type { CalendarConfigInput } from "@/src/core/schemas/calendar";
import type { FamilyTree, FamilyTreeEdge, FamilyTreeNode } from "@/src/core/genealogy/buildFamilyTree";
import {
  casesEnfant,
  dimensions,
  estDefunt,
  gabaritPour,
  ligneDates,
  position,
  traits,
  vueAjustee,
  vueCentree,
  zoomerAutour,
  type CaseEnfant,
  type Vue,
} from "@/lib/ui/arbre";

const VIEWPORT_HEIGHT = 440;
const LIMITES = { min: 0.3, max: 2.5 };
/** En dessous de ce deplacement (px), un clic-relache reste un clic — pas un panoramique qui devrait avaler le clic suivant. */
const DRAG_THRESHOLD = 4;
const MARGE = 16;

/**
 * Canevas de rendu partage entre l'editeur et le wiki public (V2-H3, refait en
 * V3.1-73) : de GRANDS portraits (100 × 130 ; 66 × 88 et prenoms seuls au
 * telephone), le nom en pastille a cheval sur le bas, les dates dessous, des
 * traits ARRONDIS (le couple relie a l'horizontale, les enfants descendent du
 * milieu du couple par des coudes), l'ex-partenaire en pointille orange
 * (`--gm`), le defunt en gris, un fond pointe et le zoom en bas a droite
 * (+, −, recadrer). Tout le calcul — gabarit, traits, case « + enfant », dates,
 * vue — vit dans `lib/ui/arbre.ts`.
 *
 * Navigation : ctrl+molette pour zoomer (une simple molette laisse la page
 * defiler), clic-glisse pour deplacer ; au doigt, glisser et pincer. L'arbre
 * s'ouvre ajuste a la fenetre sur ordinateur, CENTRE sur la fiche au telephone.
 *
 * Choisir un portrait passe par `onSelectNode` (la barre de l'editeur) ; sans
 * lui (wiki public), la carte est un lien. Survol d'un TRAIT = apercu de son
 * libelle ; clic = « epingle » (bouton de suppression). Tout clic dans un
 * element pose sur le fond (cartes, etiquettes, case « + enfant », zoom) arrete
 * sa remontee : le fond deselectionne.
 */
export default function FamilyTreeCanvas({
  tree,
  rootId,
  hrefBase,
  calendrier,
  selectedId,
  onSelectNode,
  onAddChild,
  onDeleteEdge,
  onToggleNodeVisibility,
}: {
  tree: FamilyTree;
  /** L'entite dont c'est l'arbre — jamais de bouton oeil sur son propre portrait, bord accent. */
  rootId?: string;
  /** Base des liens vers une fiche (carte-lien du wiki public). */
  hrefBase: string;
  /** Calendrier du monde : sans lui, aucune date n'est ecrite (le defunt reste gris). */
  calendrier?: CalendarConfigInput | null;
  selectedId?: string | null;
  /** Fourni : une carte est un bouton qui choisit la fiche ; `null` quand on clique le fond. */
  onSelectNode?: (id: string | null) => void;
  /** Fourni : la case pointillee « + enfant » paraît sous un couple sans enfant. */
  onAddChild?: (c: CaseEnfant, rect: DOMRect) => void;
  /** Bouton de suppression sur le trait epingle (clic) — omis en lecture seule (wiki public). */
  onDeleteEdge?: (edge: FamilyTreeEdge) => void;
  /** Bouton oeil sur le portrait : bascule TOUTES les aretes qui touchent ce nœud. Omis en lecture seule. */
  onToggleNodeVisibility?: (node: FamilyTreeNode, edges: FamilyTreeEdge[]) => void;
}) {
  const t = useTranslations("fiche.genealogie");
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [pinnedEdgeId, setPinnedEdgeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [view, setView] = useState<Vue>({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [largeur, setLargeur] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number; moved: boolean } | null>(null);
  const pinceRef = useRef<{ distance: number; vue: Vue } | null>(null);
  const suppressClickRef = useRef(false);
  const fittedForRef = useRef<string | null>(null);

  const g = gabaritPour(largeur);
  const places = new Map(tree.nodes.map((node) => [node.id, { node, ...position(node, tree.minGeneration, g) }]));
  const { largeur: treeWidth, hauteur: treeHeight } = dimensions(tree, g);
  const lesTraits = traits(tree, g);
  const cases = onAddChild ? casesEnfant(tree, g) : [];
  const aujourdhui = calendrier?.currentDate ?? null;

  /** L'arbre ajuste a la fenetre (ordinateur) ou ouvert centre sur la fiche (telephone). */
  function vueInitiale(container: HTMLElement): Vue {
    const fenetre = { largeur: container.clientWidth, hauteur: container.clientHeight };
    const racine = rootId ? places.get(rootId) : undefined;
    if (g.largeur < 100 && racine) {
      return vueCentree({ x: racine.x + g.largeur / 2 + MARGE, y: racine.y + g.hauteur / 2 + MARGE }, fenetre, 1);
    }
    return vueAjustee({ largeur: treeWidth + 2 * MARGE, hauteur: treeHeight + 2 * MARGE }, fenetre, LIMITES, 0);
  }

  // Largeur du bloc suivie (le gabarit en depend) ; mesuree avant le premier affichage.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setLargeur(container.clientWidth);
    const observer = new ResizeObserver((entrees) => {
      const w = entrees[0]?.contentRect.width;
      if (w) setLargeur(w);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Cadre l'arbre a l'ouverture et a chaque changement structurel (noeuds, gabarit) — jamais a chaque re-rendu, ce qui effacerait un panoramique/zoom manuel en cours.
  const signature =
    tree.nodes
      .map((n) => n.id)
      .sort()
      .join(",") + `|${g.largeur}|${rootId ?? ""}`;
  useLayoutEffect(() => {
    if (fittedForRef.current === signature) return;
    const container = containerRef.current;
    if (!container || treeWidth === 0 || treeHeight === 0 || largeur === 0) return;
    fittedForRef.current = signature;
    setView(vueInitiale(container));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, treeWidth, treeHeight, largeur]);

  // Molette non-passive : sans cela preventDefault() n'empeche pas la page de defiler. Ctrl+molette seulement : une simple molette laisse la page defiler.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const rect = container!.getBoundingClientRect();
      const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setView((courante) => zoomerAutour(courante, 1 - e.deltaY * 0.001, point, LIMITES));
    }
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: view.x, startPanY: view.y, moved: false };
    setIsDragging(true);
  }
  function handleMouseMove(e: React.MouseEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) drag.moved = true;
    if (drag.moved) setView((courante) => ({ ...courante, x: drag.startPanX + dx, y: drag.startPanY + dy }));
  }
  function endDrag() {
    if (dragRef.current?.moved) suppressClickRef.current = true;
    dragRef.current = null;
    setIsDragging(false);
  }
  function handleClickCapture(e: React.MouseEvent) {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    }
  }

  // Au doigt : un doigt deplace, deux doigts pincent.
  function ecart(touches: React.TouchList): number {
    return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  }
  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      pinceRef.current = { distance: ecart(e.touches), vue: view };
      dragRef.current = null;
    } else if (e.touches.length === 1) {
      const doigt = e.touches[0];
      dragRef.current = { startX: doigt.clientX, startY: doigt.clientY, startPanX: view.x, startPanY: view.y, moved: false };
    }
  }
  function handleTouchMove(e: React.TouchEvent) {
    const pince = pinceRef.current;
    if (pince && e.touches.length === 2) {
      const rect = containerRef.current?.getBoundingClientRect();
      const milieu = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - (rect?.left ?? 0),
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - (rect?.top ?? 0),
      };
      setView(zoomerAutour(pince.vue, ecart(e.touches) / pince.distance, milieu, LIMITES));
      suppressClickRef.current = true;
      return;
    }
    const drag = dragRef.current;
    if (!drag || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - drag.startX;
    const dy = e.touches[0].clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) drag.moved = true;
    if (drag.moved) setView((courante) => ({ ...courante, x: drag.startPanX + dx, y: drag.startPanY + dy }));
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinceRef.current = null;
    if (e.touches.length === 0) {
      if (dragRef.current?.moved) suppressClickRef.current = true;
      dragRef.current = null;
    }
  }

  function zoomerBouton(facteur: number) {
    const container = containerRef.current;
    if (!container) return;
    setView((courante) => zoomerAutour(courante, facteur, { x: container.clientWidth / 2, y: container.clientHeight / 2 }, LIMITES));
  }
  function recadrer() {
    const container = containerRef.current;
    if (container) setView(vueInitiale(container));
  }

  if (tree.nodes.length === 0) {
    return <p className="text-sm text-ink-muted">{t("aucuneParente")}</p>;
  }

  // Survol d'un portrait : lui + ses voisins directs restent nets, le reste s'estompe.
  const highlightedNodeIds = hoveredNodeId
    ? new Set([hoveredNodeId, ...tree.edges.flatMap((e) => (e.fromId === hoveredNodeId ? [e.toId] : e.toId === hoveredNodeId ? [e.fromId] : []))])
    : null;

  // Etiquette(s) : un trait EPINGLE reste visible, plus tous les liens directs du portrait survole ou, a defaut, le seul lien survole.
  const edgesToLabel = (() => {
    const parId = new Map(tree.edges.map((e) => [e.id, e] as const));
    const resultat = new Map<string, FamilyTreeEdge>();
    const pinned = pinnedEdgeId ? parId.get(pinnedEdgeId) : undefined;
    if (pinned) resultat.set(pinned.id, pinned);
    if (hoveredNodeId) {
      for (const e of tree.edges) if (e.fromId === hoveredNodeId || e.toId === hoveredNodeId) resultat.set(e.id, e);
    } else if (hoveredEdgeId) {
      const e = parId.get(hoveredEdgeId);
      if (e) resultat.set(e.id, e);
    }
    return [...resultat.values()];
  })();
  const traitDe = new Map(lesTraits.map((x) => [x.edgeId, x]));

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-xl border border-edge/60 select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{
        height: VIEWPORT_HEIGHT,
        touchAction: "none",
        backgroundImage: "radial-gradient(var(--edge) 1px, transparent 1px)",
        backgroundSize: `${18 * view.scale}px ${18 * view.scale}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
        backgroundColor: "color-mix(in oklch, var(--panel-sunken) 60%, transparent)",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClickCapture={handleClickCapture}
      onClick={() => {
        setPinnedEdgeId(null);
        onSelectNode?.(null);
      }}
    >
      <div
        className="absolute left-0 top-0"
        style={{ width: treeWidth + 2 * MARGE, height: treeHeight + 2 * MARGE, padding: MARGE, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: "0 0" }}
      >
        <svg className="pointer-events-none absolute overflow-visible" style={{ left: MARGE, top: MARGE }} width={treeWidth} height={treeHeight}>
          {tree.edges.map((edge) => {
            const trait = traitDe.get(edge.id);
            if (!trait) return null;
            const isActive = edge.id === pinnedEdgeId || edge.id === hoveredEdgeId || edgesToLabel.some((e) => e.id === edge.id);
            const dimmed = highlightedNodeIds ? !(highlightedNodeIds.has(edge.fromId) && highlightedNodeIds.has(edge.toId)) : false;
            // Un lien masque au wiki public (tout sauf `public`) reste grise et pointille ; l'ex-partenaire est en pointille orange (`--gm`).
            const hiddenFromPublic = edge.visibilityLevel !== "public";
            const stroke = isActive ? "var(--accent)" : trait.ex ? "var(--gm)" : hiddenFromPublic ? "var(--ink-muted)" : "var(--edge-strong)";
            const dash = trait.ex ? "6 4" : !isActive && hiddenFromPublic ? "4 3" : undefined;
            return (
              <g
                key={edge.id}
                className="pointer-events-auto cursor-pointer"
                style={{ opacity: dimmed ? 0.15 : 1 }}
                onMouseEnter={() => setHoveredEdgeId(edge.id)}
                onMouseLeave={() => setHoveredEdgeId((courant) => (courant === edge.id ? null : courant))}
                onClick={(e) => {
                  e.stopPropagation();
                  setPinnedEdgeId((courant) => (courant === edge.id ? null : edge.id));
                }}
              >
                {/* Trait large invisible : la ligne visible est trop fine pour un survol/clic fiable. */}
                <path d={trait.d} fill="none" stroke="transparent" strokeWidth={16} />
                <path d={trait.d} fill="none" stroke={stroke} strokeWidth={isActive ? 2 : 1.5} strokeDasharray={dash} strokeLinecap="round" />
              </g>
            );
          })}
        </svg>

        {tree.nodes.map((node) => {
          const slot = places.get(node.id);
          if (!slot) return null;
          const dimmed = highlightedNodeIds ? !highlightedNodeIds.has(node.id) : false;
          const touchingEdges = tree.edges.filter((e) => e.fromId === node.id || e.toId === node.id);
          // Etat de l'oeil : visible tant qu'AU MOINS une arete qui touche ce nœud est publique.
          const nodeIsPublic = touchingEdges.length === 0 || touchingEdges.some((e) => e.visibilityLevel === "public");
          const dates = calendrier ? ligneDates(node, (d) => formatGameDate(d, calendrier), aujourdhui) : null;
          return (
            <div
              key={node.id}
              className="group absolute"
              style={{ left: slot.x + MARGE, top: slot.y + MARGE, width: g.largeur, height: g.hauteur, opacity: dimmed ? 0.3 : 1 }}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId((courant) => (courant === node.id ? null : courant))}
            >
              <FamilyTreeCard
                node={node}
                href={`${hrefBase}/${node.slug}`}
                gabarit={g}
                dates={dates}
                defunt={estDefunt(node)}
                choisie={selectedId === node.id}
                centre={node.id === rootId}
                onSelect={onSelectNode ? () => onSelectNode(node.id) : undefined}
              />
              {onToggleNodeVisibility && node.id !== rootId && touchingEdges.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleNodeVisibility(node, touchingEdges);
                  }}
                  aria-label={nodeIsPublic ? t("masquerWiki", { nom: node.name }) : t("rendreVisibleWiki", { nom: node.name })}
                  title={nodeIsPublic ? t("visibleWiki") : t("masqueWiki")}
                  style={{ transform: `scale(${1 / view.scale})`, transformOrigin: "top left" }}
                  className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-edge-strong bg-panel-raised text-ink shadow-md hover:bg-panel"
                >
                  <EyeIcon open={nodeIsPublic} className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}

        {cases.map((c) => (
          <button
            key={c.edgeId}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddChild?.(c, e.currentTarget.getBoundingClientRect());
            }}
            className="absolute flex items-center justify-center rounded-xl border-[1.5px] border-dashed border-edge-strong text-xs text-ink-muted transition-colors hover:border-accent hover:text-accent"
            style={{ left: c.x + MARGE, top: c.y + MARGE, width: g.largeur, height: g.hauteur }}
          >
            {t("plusEnfant")}
          </button>
        ))}

        {edgesToLabel.map((edge) => {
          const trait = traitDe.get(edge.id);
          if (!trait) return null;
          const isPinned = edge.id === pinnedEdgeId;
          return (
            <div
              key={edge.id}
              className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-edge-strong bg-panel-raised py-1 text-xs text-ink shadow-lg ${isPinned ? "pl-2.5 pr-1" : "pointer-events-none px-2.5"} flex items-center gap-1.5`}
              style={{ left: trait.milieu.x + MARGE, top: trait.milieu.y + MARGE }}
              onClick={(e) => e.stopPropagation()}
            >
              {edge.label}
              {isPinned && onDeleteEdge && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteEdge(edge);
                    setPinnedEdgeId(null);
                  }}
                  aria-label={t("supprimerLien", { lien: edge.label })}
                  title={t("supprimerLienTitre")}
                  className="rounded-full px-1.5 text-danger hover:bg-panel"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-2 right-2 flex gap-1" onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => zoomerBouton(1.25)} aria-label={t("zoomer")} className="rounded-md border border-edge-strong bg-panel-raised px-2 py-1 text-xs text-ink transition-colors hover:bg-panel">
          +
        </button>
        <button type="button" onClick={() => zoomerBouton(0.8)} aria-label={t("dezoomer")} className="rounded-md border border-edge-strong bg-panel-raised px-2 py-1 text-xs text-ink transition-colors hover:bg-panel">
          −
        </button>
        <button type="button" onClick={recadrer} aria-label={t("recadrer")} title={t("recadrer")} className="rounded-md border border-edge-strong bg-panel-raised px-2 py-1 text-xs text-ink transition-colors hover:bg-panel">
          ⤢
        </button>
      </div>
    </div>
  );
}
