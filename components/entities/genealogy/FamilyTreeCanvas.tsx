"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { FamilyTree, FamilyTreeEdge, FamilyTreeNode } from "@/src/core/genealogy/buildFamilyTree";

const CARD_WIDTH = 120;
const CARD_HEIGHT = 150;
const COL_GAP = 44;
const ROW_GAP = 84;
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
 * Survol = apercu ephemere du libelle (hoveredEdgeId) ; clic = "epingle"
 * (pinnedEdgeId), qui seul fait apparaitre le bouton de suppression —
 * sans cette distinction, deplacer la souris du trait vers le bouton
 * declenche un mouseleave qui referme tout avant d'avoir pu cliquer.
 */
export default function FamilyTreeCanvas({
  tree,
  renderCard,
  renderNodeOverlay,
  onDeleteEdge,
}: {
  tree: FamilyTree;
  renderCard: (node: FamilyTreeNode) => ReactNode;
  /** Controles d'edition (bouton "+") positionnes sur chaque carte — omis en lecture seule. */
  renderNodeOverlay?: (node: FamilyTreeNode) => ReactNode;
  /** Bouton de suppression sur le trait epingle (clic) — omis en lecture seule (wiki public). */
  onDeleteEdge?: (edge: FamilyTreeEdge) => void;
}) {
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [pinnedEdgeId, setPinnedEdgeId] = useState<string | null>(null);
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

  const displayEdgeId = pinnedEdgeId ?? hoveredEdgeId;
  const activeEdge = tree.edges.find((e) => e.id === displayEdgeId);

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
            const isActive = edge.id === displayEdgeId;
            const stroke = isActive ? "var(--accent)" : "var(--edge-strong)";

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
                <g key={edge.id} className="pointer-events-auto cursor-pointer" {...handlers}>
                  {/* Trait large invisible : la ligne visible (1.5px) est trop fine pour un survol/clic fiable — meme technique que les cibles tactiles agrandies ailleurs dans l'app. */}
                  <polyline points={points} fill="none" stroke="transparent" strokeWidth={16} />
                  <polyline points={points} fill="none" stroke={stroke} strokeWidth={isActive ? 2 : 1.5} />
                </g>
              );
            }

            // partner / sibling : simple trait horizontal entre les deux centres.
            const y = from.y + CARD_HEIGHT / 2;
            const x1 = from.x + CARD_WIDTH / 2;
            const x2 = to.x + CARD_WIDTH / 2;
            return (
              <g key={edge.id} className="pointer-events-auto cursor-pointer" {...handlers}>
                <line x1={x1} y1={y} x2={x2} y2={y} stroke="transparent" strokeWidth={16} />
                <line x1={x1} y1={y} x2={x2} y2={y} stroke={stroke} strokeWidth={isActive ? 2 : 1.5} />
              </g>
            );
          })}
        </svg>

        {tree.nodes.map((node) => {
          const slot = slotById.get(node.id)!;
          return (
            <div
              key={node.id}
              className="group absolute"
              style={{ left: slot.x + 16, top: slot.y + 16, width: CARD_WIDTH, height: CARD_HEIGHT }}
            >
              {renderCard(node)}
              {renderNodeOverlay?.(node)}
            </div>
          );
        })}

        {activeEdge &&
          (() => {
            const from = slotById.get(activeEdge.fromId);
            const to = slotById.get(activeEdge.toId);
            if (!from || !to) return null;
            const midX = (from.x + to.x) / 2 + CARD_WIDTH / 2 + 16;
            const midY =
              activeEdge.kind === "parent-child"
                ? from.y + CARD_HEIGHT + (to.y - (from.y + CARD_HEIGHT)) / 2 + 16
                : from.y + CARD_HEIGHT / 2 + 16;
            const isPinned = activeEdge.id === pinnedEdgeId;
            return (
              <div
                className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-edge-strong bg-panel-raised py-1 text-xs text-ink shadow-lg ${isPinned ? "pl-2.5 pr-1" : "pointer-events-none px-2.5"} flex items-center gap-1.5`}
                style={{ left: midX, top: midY }}
                onClick={(e) => e.stopPropagation()}
              >
                {activeEdge.label}
                {isPinned && onDeleteEdge && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteEdge(activeEdge);
                      setPinnedEdgeId(null);
                    }}
                    aria-label={`Supprimer le lien ${activeEdge.label}`}
                    title="Supprimer ce lien"
                    className="rounded-full px-1.5 text-danger hover:bg-panel"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })()}
      </div>
    </div>
  );
}
