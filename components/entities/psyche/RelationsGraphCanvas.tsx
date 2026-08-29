"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationNodeDatum } from "d3-force";
import Link from "next/link";
import { useDesktop } from "@/components/shell/DesktopContext";
import RelationsGraphNodeCard from "./RelationsGraphNodeCard";
import type { RelationsGraph, RelationsGraphEdge, RelationsGraphNode } from "@/src/core/relationsGraph/buildRelationsGraph";

const ICON_SIZE = 56;
const ROOT_ICON_SIZE = 80;
/** Marge de securite autour de chaque nœud, pour que son etiquette de nom ne deborde jamais du cadre calcule. */
const NODE_MARGIN = 70;
const VIEWPORT_HEIGHT = 420;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
/** En dessous de ce deplacement (px), un clic-relache reste un clic — pas un panoramique qui devrait avaler le clic suivant. */
const DRAG_THRESHOLD = 4;
/** Simulation calculee une fois, statique a l'affichage — pas d'animation continue, un graphe de fiche n'a pas besoin de "respirer". */
const TICKS = 300;

interface PositionedNode extends RelationsGraphNode, SimulationNodeDatum {}

function layout(graph: RelationsGraph): PositionedNode[] {
  const nodes: PositionedNode[] = graph.nodes.map((n) => ({ ...n }));
  const links = graph.edges.map((e) => ({ source: e.fromId, target: e.toId }));

  const simulation = forceSimulation(nodes)
    .force("charge", forceManyBody().strength(-260))
    .force("link", forceLink(links).id((d) => (d as PositionedNode).id).distance(110))
    .force("center", forceCenter(0, 0))
    .force("collide", forceCollide(ROOT_ICON_SIZE / 2 + 20))
    .stop();

  for (let i = 0; i < TICKS; i++) simulation.tick();
  return nodes;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Graphe de relations auto-organise (V2-H1 phase 5, reprise visuelle sur
 * references fournies par l'utilisateur) — d3-force pour le placement
 * (charge repulsive + liens + collision), nœuds rendus en cartes portrait
 * (`RelationsGraphNodeCard`, meme repli initiale que `FamilyTreeCard`)
 * plutot que de simples cercles. Pan (glisser) + zoom (molette centree sur
 * le curseur) + cadrage automatique a l'ouverture : meme mecanique que
 * `FamilyTreeCanvas.tsx` (genealogie), dupliquee plutot que partagee — la
 * genealogie route ses traits en angle droit par generation/ordre, ce
 * graphe positionne par simulation de forces, deux mises en page trop
 * differentes pour un seul composant (troisieme occurrence a generaliser,
 * pas la deuxieme, CLAUDE.md).
 *
 * Survol d'un nœud = met en surbrillance le nœud et ses liens de premier
 * degre, estompe le reste (demande du client). Survol d'un LIEN = meme
 * estompage sur ses deux extremites, plus son libelle affiche au-dessus
 * (« membre de », « parent de »...) — sans action, juste l'explication ;
 * cliquer le lien l'EPINGLE (le libelle reste affiche apres avoir bouge la
 * souris) et revele en plus le bouton masquer/afficher, si fourni. Clic
 * sur un nœud ouvre sa fiche.
 */
export default function RelationsGraphCanvas({
  graph,
  hrefBase,
  edgeColor,
  onToggleEdgeVisibility,
}: {
  graph: RelationsGraph;
  /** Base des liens vers une fiche — `/m/[worldSlug]/f` en edition, `/m/[worldSlug]/apercu` (ou `/partage/[token]`) sur le wiki public. Meme motif que `PublicGenealogyBlock`/`PublicQuestBlock`. */
  hrefBase: string;
  /** Couleur d'un lien direct depuis la racine (relationshipColor si une attitude existe), sinon `var(--edge)`. */
  edgeColor: (edge: RelationsGraphEdge) => string;
  onToggleEdgeVisibility?: (edge: RelationsGraphEdge) => void;
}) {
  const desktop = useDesktop();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [pinnedEdgeId, setPinnedEdgeId] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const fittedForRef = useRef<string | null>(null);

  const positioned = useMemo(() => layout(graph), [graph]);
  const byId = useMemo(() => new Map(positioned.map((n) => [n.id, n])), [positioned]);

  // Cadre englobant de la simulation (jamais garanti dans une taille fixe,
  // contrairement a l'ancien viewBox statique) : chaque nœud a une marge
  // fixe pour son icone + etiquette, quelle que soit sa taille reelle.
  const bounds = useMemo(() => {
    if (positioned.length === 0) return { minX: 0, minY: 0, width: 0, height: 0 };
    const xs = positioned.map((n) => n.x ?? 0);
    const ys = positioned.map((n) => n.y ?? 0);
    const minX = Math.min(...xs) - NODE_MARGIN;
    const maxX = Math.max(...xs) + NODE_MARGIN;
    const minY = Math.min(...ys) - NODE_MARGIN;
    const maxY = Math.max(...ys) + NODE_MARGIN;
    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }, [positioned]);

  const highlightedNodeIds = useMemo(() => {
    if (hoveredId) {
      const ids = new Set([hoveredId]);
      for (const edge of graph.edges) {
        if (edge.fromId === hoveredId) ids.add(edge.toId);
        if (edge.toId === hoveredId) ids.add(edge.fromId);
      }
      return ids;
    }
    if (hoveredEdgeId) {
      const edge = graph.edges.find((e) => e.id === hoveredEdgeId);
      if (edge) return new Set([edge.fromId, edge.toId]);
    }
    return null;
  }, [hoveredId, hoveredEdgeId, graph.edges]);

  const displayEdgeId = pinnedEdgeId ?? hoveredEdgeId;

  const nodesSignature = graph.nodes
    .map((n) => n.id)
    .sort()
    .join(",");

  // Centre et ajuste a la fenetre a l'ouverture et a chaque changement
  // structurel (degre de liens change, nœud ajoute/retire) — jamais a
  // chaque re-rendu, ce qui effacerait un panoramique/zoom manuel en cours.
  useLayoutEffect(() => {
    if (fittedForRef.current === nodesSignature) return;
    fittedForRef.current = nodesSignature;
    const container = containerRef.current;
    if (!container || bounds.width === 0 || bounds.height === 0) return;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const fitScale = clamp(Math.min(containerWidth / bounds.width, containerHeight / bounds.height, 1), MIN_ZOOM, MAX_ZOOM);
    setView({
      scale: fitScale,
      x: containerWidth / 2 - (bounds.minX + bounds.width / 2) * fitScale,
      y: containerHeight / 2 - (bounds.minY + bounds.height / 2) * fitScale,
    });
  }, [nodesSignature, bounds]);

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

  function openEntity(node: RelationsGraphNode, e: React.MouseEvent) {
    if (!desktop) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    desktop.openRef({ kind: "entity", key: node.slug });
  }

  if (positioned.length === 0) {
    return <p className="text-sm text-ink-muted">Aucune relation visible pour l&apos;instant.</p>;
  }

  const activeEdge = graph.edges.find((e) => e.id === displayEdgeId) ?? null;

  return (
    <div className="flex flex-col gap-2">
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
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: "0 0" }}
        >
          <svg
            className="pointer-events-none absolute"
            style={{ left: bounds.minX, top: bounds.minY }}
            width={bounds.width}
            height={bounds.height}
          >
            {graph.edges.map((edge) => {
              const from = byId.get(edge.fromId);
              const to = byId.get(edge.toId);
              if (!from || !to) return null;
              const dimmed = highlightedNodeIds ? !(highlightedNodeIds.has(edge.fromId) && highlightedNodeIds.has(edge.toId)) : false;
              const x1 = (from.x ?? 0) - bounds.minX;
              const y1 = (from.y ?? 0) - bounds.minY;
              const x2 = (to.x ?? 0) - bounds.minX;
              const y2 = (to.y ?? 0) - bounds.minY;
              return (
                <g
                  key={edge.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinnedEdgeId(edge.id === pinnedEdgeId ? null : edge.id);
                  }}
                  onMouseEnter={() => setHoveredEdgeId(edge.id)}
                  onMouseLeave={() => setHoveredEdgeId((current) => (current === edge.id ? null : current))}
                  className="pointer-events-auto cursor-pointer"
                >
                  {/* Trait invisible mais large : le trait visible (1.5px) est bien trop fin pour cliquer/survoler de maniere fiable a la souris — meme zone de clic que le trait rendu, juste plus genereuse. */}
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={14} />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={edgeColor(edge)}
                    strokeWidth={displayEdgeId === edge.id ? 3 : 1.5}
                    opacity={dimmed ? 0.15 : 0.8}
                  />
                </g>
              );
            })}
          </svg>

          {positioned.map((node) => {
            const dimmed = highlightedNodeIds ? !highlightedNodeIds.has(node.id) : false;
            const isRoot = node.degree === 0;
            const size = isRoot ? ROOT_ICON_SIZE : ICON_SIZE;
            return (
              <Link
                key={node.id}
                href={`${hrefBase}/${node.slug}`}
                onClick={(e) => openEntity(node, e)}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: node.x, top: node.y, opacity: dimmed ? 0.3 : 1 }}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <RelationsGraphNodeCard id={node.id} name={node.name} size={size} isRoot={isRoot} />
              </Link>
            );
          })}

          {activeEdge &&
            (() => {
              const from = byId.get(activeEdge.fromId);
              const to = byId.get(activeEdge.toId);
              if (!from || !to) return null;
              const midX = ((from.x ?? 0) + (to.x ?? 0)) / 2;
              const midY = ((from.y ?? 0) + (to.y ?? 0)) / 2;
              const isPinned = activeEdge.id === pinnedEdgeId;
              return (
                <div
                  className={`pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-edge-strong bg-panel-raised py-1 text-xs text-ink shadow-lg ${isPinned ? "pointer-events-auto pl-2.5 pr-1" : "px-2.5"}`}
                  style={{ left: midX, top: midY }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-ink-muted">{activeEdge.label}</span>
                  {isPinned && onToggleEdgeVisibility && (
                    <button
                      type="button"
                      onClick={() => onToggleEdgeVisibility(activeEdge)}
                      className="rounded-full px-2 py-0.5 text-ink transition-colors hover:bg-panel"
                    >
                      {activeEdge.visibilityLevel === "gm" ? "Rendre visible aux joueurs" : "Masquer aux joueurs"}
                    </button>
                  )}
                </div>
              );
            })()}
        </div>
      </div>
    </div>
  );
}
