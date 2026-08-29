"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { FamilyTree, FamilyTreeEdge, FamilyTreeNode } from "@/src/core/genealogy/buildFamilyTree";

const CARD_WIDTH = 120;
const CARD_HEIGHT = 150;
// Retour utilisateur : plus d'ecart entre les portraits (44/84 -> 80/120)
// pour que les traits (surtout une fratrie qui se separe en deux) restent
// lisibles sans se chevaucher.
const COL_GAP = 80;
const ROW_GAP = 120;
const COL_WIDTH = CARD_WIDTH + COL_GAP;
const ROW_HEIGHT = CARD_HEIGHT + ROW_GAP;
const VIEWPORT_HEIGHT = 440;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
/** En dessous de ce deplacement (px), un clic-relache reste un clic — pas un panoramique qui devrait avaler le clic suivant. */
const DRAG_THRESHOLD = 4;

function nodeX(node: FamilyTreeNode): number {
  return node.order * COL_WIDTH;
}
function nodeY(node: FamilyTreeNode, minGeneration: number): number {
  return (node.generation - minGeneration) * ROW_HEIGHT;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Canevas de rendu partage entre l'editeur (avec ses "+" au survol) et le
 * wiki public (lecture seule) — V2-H3. Esthetique de reference fournie par
 * l'utilisateur : cartes portrait a etiquette arrondie, traits fins en
 * angle droit, fond a pointilles subtil. Connecteurs traces par arete
 * plutot que regroupes par fratrie (un couple qui a deux enfants produit
 * deux traits paralleles a la meme hauteur de "bus" plutot qu'un seul
 * trait fusionne) : bien plus simple a calculer et a etiqueter
 * individuellement au survol, visuellement quasi identique a la fusion.
 *
 * Navigation (retour utilisateur) : molette pour zoomer, centree sur le
 * curseur (le point du monde sous la souris reste sous la souris apres
 * zoom, comme Figma/Miro) ; clic-glisse pour deplacer. L'arbre s'ouvre
 * centre et ajuste a la fenetre (jamais zoome au-dela de 100% par
 * defaut, seulement dezoome si l'arbre est plus grand que la zone
 * visible) — recalcule quand le nombre de nœuds change (nouvelle
 * relation), jamais sur un simple re-rendu.
 *
 * Survol d'un TRAIT = apercu ephemere de son libelle (hoveredEdgeId) ;
 * clic = "epingle" (pinnedEdgeId), qui seul fait apparaitre les boutons
 * masquer/supprimer — sans cette distinction, deplacer la souris du trait
 * vers le bouton declenche un mouseleave qui referme tout avant d'avoir pu
 * cliquer. Survol d'un PORTRAIT (retour utilisateur) = met en surbrillance
 * ses liens directs et estompe le reste, ET affiche le libelle de CHACUN
 * de ces liens a la fois (pas un seul) — meme principe que le bloc reseau
 * (`RelationsGraphCanvas.tsx`), duplique plutot que partage (mises en page
 * trop differentes, meme raisonnement deja pose pour ce couple de blocs).
 */
export default function FamilyTreeCanvas({
  tree,
  renderCard,
  renderNodeOverlay,
  onDeleteEdge,
  onToggleEdgeVisibility,
}: {
  tree: FamilyTree;
  renderCard: (node: FamilyTreeNode) => ReactNode;
  /**
   * Controles d'edition (bouton "+") positionnes sur chaque carte — omis
   * en lecture seule. `scale` (retour utilisateur) : le zoom courant du
   * canevas, pour que l'appelant puisse contre-appliquer une echelle
   * inverse et garder un bouton de taille constante a l'ecran — sinon un
   * arbre dezoome (beaucoup de nœuds, `MIN_ZOOM` 0.3) retrecit le "+"
   * jusqu'a le rendre quasi impossible a viser.
   */
  renderNodeOverlay?: (node: FamilyTreeNode, scale: number) => ReactNode;
  /** Bouton de suppression sur le trait epingle (clic) — omis en lecture seule (wiki public). */
  onDeleteEdge?: (edge: FamilyTreeEdge) => void;
  /** V2, retour utilisateur : bouton oeil sur le trait epingle — masque/affiche au wiki public, meme relation que la liste du haut de fiche et le bloc reseau. Omis en lecture seule. */
  onToggleEdgeVisibility?: (edge: FamilyTreeEdge) => void;
}) {
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [pinnedEdgeId, setPinnedEdgeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const fittedForRef = useRef<string | null>(null);

  const slotById = new Map(tree.nodes.map((node) => [node.id, { node, x: nodeX(node), y: nodeY(node, tree.minGeneration) }]));
  const treeWidth = tree.nodes.length === 0 ? 0 : Math.max(...[...slotById.values()].map((s) => s.x)) + CARD_WIDTH;
  const treeHeight = tree.nodes.length === 0 ? 0 : Math.max(...[...slotById.values()].map((s) => s.y)) + CARD_HEIGHT;

  // Centre et ajuste a la fenetre au premier affichage et a chaque
  // changement structurel (nœuds ajoutes/retires) — jamais a chaque
  // re-rendu, ce qui effacerait un panoramique/zoom manuel en cours.
  const nodesSignature = tree.nodes
    .map((n) => n.id)
    .sort()
    .join(",");
  useLayoutEffect(() => {
    if (fittedForRef.current === nodesSignature) return;
    fittedForRef.current = nodesSignature;
    const container = containerRef.current;
    if (!container || treeWidth === 0 || treeHeight === 0) return;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const fitScale = clamp(Math.min(containerWidth / (treeWidth + 32), containerHeight / (treeHeight + 32), 1), MIN_ZOOM, MAX_ZOOM);
    setView({
      scale: fitScale,
      x: (containerWidth - treeWidth * fitScale) / 2,
      y: (containerHeight - treeHeight * fitScale) / 2,
    });
  }, [nodesSignature, treeWidth, treeHeight]);

  // Molette non-passive (React attache onWheel en passif par defaut) :
  // sans ceci, preventDefault() n'empeche pas la page de defiler en plus
  // du zoom du canevas.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = container!.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      setView((current) => {
        const nextScale = clamp(current.scale * (1 - e.deltaY * 0.001), MIN_ZOOM, MAX_ZOOM);
        const worldX = (cursorX - current.x) / current.scale;
        const worldY = (cursorY - current.y) / current.scale;
        return { scale: nextScale, x: cursorX - worldX * nextScale, y: cursorY - worldY * nextScale };
      });
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
    if (drag.moved) setView((current) => ({ ...current, x: drag.startPanX + dx, y: drag.startPanY + dy }));
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

  if (tree.nodes.length === 0) {
    return <p className="text-sm text-ink-muted">Aucune parente visible pour l&apos;instant.</p>;
  }

  // Survol d'un portrait : lui + ses voisins directs restent nets, le
  // reste s'estompe (retour utilisateur, meme principe que le bloc reseau).
  const highlightedNodeIds = hoveredNodeId
    ? new Set(
        [hoveredNodeId, ...tree.edges.flatMap((e) => (e.fromId === hoveredNodeId ? [e.toId] : e.toId === hoveredNodeId ? [e.fromId] : []))]
      )
    : null;

  // Etiquette(s) affichee(s) : soit tous les liens directs du portrait
  // survole (retour utilisateur : "les etiquettes s'affichent", au
  // pluriel), soit le seul lien survole/epingle directement.
  const edgesToLabel = hoveredNodeId
    ? tree.edges.filter((e) => e.fromId === hoveredNodeId || e.toId === hoveredNodeId)
    : (() => {
        const id = pinnedEdgeId ?? hoveredEdgeId;
        const edge = tree.edges.find((e) => e.id === id);
        return edge ? [edge] : [];
      })();

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-xl border border-edge/60 select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{
        height: VIEWPORT_HEIGHT,
        backgroundImage: "radial-gradient(var(--edge) 1px, transparent 1px)",
        backgroundSize: `${18 * view.scale}px ${18 * view.scale}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
        backgroundColor: "color-mix(in oklch, var(--panel-sunken) 60%, transparent)",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onClickCapture={handleClickCapture}
      onClick={() => setPinnedEdgeId(null)}
    >
      <div
        className="absolute left-0 top-0"
        style={{ width: treeWidth + 32, height: treeHeight + 32, padding: 16, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: "0 0" }}
      >
        <svg className="pointer-events-none absolute left-4 top-4" width={treeWidth} height={treeHeight}>
          {tree.edges.map((edge) => {
            const from = slotById.get(edge.fromId);
            const to = slotById.get(edge.toId);
            if (!from || !to) return null;
            const isActive = edge.id === pinnedEdgeId || edge.id === hoveredEdgeId || edgesToLabel.some((e) => e.id === edge.id);
            const dimmed = highlightedNodeIds ? !(highlightedNodeIds.has(edge.fromId) && highlightedNodeIds.has(edge.toId)) : false;
            // Retour utilisateur : un lien masque au wiki public (tout
            // sauf `public`) reste grise et pointille — meme traitement
            // que le bloc reseau (RelationsGraphCanvas.tsx).
            const hiddenFromPublic = edge.visibilityLevel !== "public";
            const stroke = isActive ? "var(--accent)" : hiddenFromPublic ? "var(--ink-muted)" : "var(--edge-strong)";
            const dash = !isActive && hiddenFromPublic ? "4 3" : undefined;
            const opacity = dimmed ? 0.15 : 1;

            const handlers = {
              onMouseEnter: () => setHoveredEdgeId(edge.id),
              onMouseLeave: () => setHoveredEdgeId((current: string | null) => (current === edge.id ? null : current)),
              onClick: (e: React.MouseEvent) => {
                e.stopPropagation();
                setPinnedEdgeId((current) => (current === edge.id ? null : edge.id));
              },
            };

            if (edge.kind === "parent-child") {
              const x1 = from.x + CARD_WIDTH / 2;
              const y1 = from.y + CARD_HEIGHT;
              const x2 = to.x + CARD_WIDTH / 2;
              const y2 = to.y;
              const busY = y1 + (y2 - y1) / 2;
              const points = `${x1},${y1} ${x1},${busY} ${x2},${busY} ${x2},${y2}`;
              return (
                <g key={edge.id} className="pointer-events-auto cursor-pointer" style={{ opacity }} {...handlers}>
                  {/* Trait large invisible : la ligne visible (1.5px) est trop fine pour un survol/clic fiable — meme technique que les cibles tactiles agrandies ailleurs dans l'app. */}
                  <polyline points={points} fill="none" stroke="transparent" strokeWidth={16} />
                  <polyline points={points} fill="none" stroke={stroke} strokeWidth={isActive ? 2 : 1.5} strokeDasharray={dash} />
                </g>
              );
            }

            // partner / sibling : simple trait horizontal entre les deux centres.
            const y = from.y + CARD_HEIGHT / 2;
            const x1 = from.x + CARD_WIDTH / 2;
            const x2 = to.x + CARD_WIDTH / 2;
            return (
              <g key={edge.id} className="pointer-events-auto cursor-pointer" style={{ opacity }} {...handlers}>
                <line x1={x1} y1={y} x2={x2} y2={y} stroke="transparent" strokeWidth={16} />
                <line x1={x1} y1={y} x2={x2} y2={y} stroke={stroke} strokeWidth={isActive ? 2 : 1.5} strokeDasharray={dash} />
              </g>
            );
          })}
        </svg>

        {tree.nodes.map((node) => {
          const slot = slotById.get(node.id)!;
          const dimmed = highlightedNodeIds ? !highlightedNodeIds.has(node.id) : false;
          return (
            <div
              key={node.id}
              className="group absolute"
              style={{ left: slot.x + 16, top: slot.y + 16, width: CARD_WIDTH, height: CARD_HEIGHT, opacity: dimmed ? 0.3 : 1 }}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId((current) => (current === node.id ? null : current))}
            >
              {renderCard(node)}
              {renderNodeOverlay?.(node, view.scale)}
            </div>
          );
        })}

        {edgesToLabel.map((edge) => {
          const from = slotById.get(edge.fromId);
          const to = slotById.get(edge.toId);
          if (!from || !to) return null;
          const midX = (from.x + to.x) / 2 + CARD_WIDTH / 2 + 16;
          const midY =
            edge.kind === "parent-child"
              ? from.y + CARD_HEIGHT + (to.y - (from.y + CARD_HEIGHT)) / 2 + 16
              : from.y + CARD_HEIGHT / 2 + 16;
          const isPinned = edge.id === pinnedEdgeId;
          return (
            <div
              key={edge.id}
              className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-edge-strong bg-panel-raised py-1 text-xs text-ink shadow-lg ${isPinned ? "pl-2.5 pr-1" : "pointer-events-none px-2.5"} flex items-center gap-1.5`}
              style={{ left: midX, top: midY }}
              onClick={(e) => e.stopPropagation()}
            >
              {edge.label}
              {isPinned && onToggleEdgeVisibility && (
                <button
                  type="button"
                  onClick={() => onToggleEdgeVisibility(edge)}
                  className="rounded-full px-2 py-0.5 text-ink transition-colors hover:bg-panel"
                >
                  {edge.visibilityLevel === "gm" ? "Rendre visible aux joueurs" : "Masquer aux joueurs"}
                </button>
              )}
              {isPinned && onDeleteEdge && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteEdge(edge);
                    setPinnedEdgeId(null);
                  }}
                  aria-label={`Supprimer le lien ${edge.label}`}
                  title="Supprimer ce lien"
                  className="rounded-full px-1.5 text-danger hover:bg-panel"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
