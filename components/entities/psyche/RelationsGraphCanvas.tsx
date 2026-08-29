"use client";

import { useMemo, useState } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type SimulationNodeDatum } from "d3-force";
import Link from "next/link";
import { useDesktop } from "@/components/shell/DesktopContext";
import type { RelationsGraph, RelationsGraphEdge, RelationsGraphNode } from "@/src/core/relationsGraph/buildRelationsGraph";

const SIZE = 420;
const CENTER = SIZE / 2;
/** Simulation calculee une fois, statique a l'affichage — pas d'animation continue, un graphe de fiche n'a pas besoin de "respirer". */
const TICKS = 300;

interface PositionedNode extends RelationsGraphNode, SimulationNodeDatum {}

function layout(graph: RelationsGraph): PositionedNode[] {
  const nodes: PositionedNode[] = graph.nodes.map((n) => ({ ...n }));
  const links = graph.edges.map((e) => ({ source: e.fromId, target: e.toId }));

  const simulation = forceSimulation(nodes)
    .force("charge", forceManyBody().strength(-180))
    .force("link", forceLink(links).id((d) => (d as PositionedNode).id).distance(70))
    .force("center", forceCenter(CENTER, CENTER))
    .force("collide", forceCollide(26))
    .stop();

  for (let i = 0; i < TICKS; i++) simulation.tick();
  return nodes;
}

/**
 * Graphe de relations auto-organise (V2-H1 phase 5) — d3-force pour le
 * placement (charge repulsive + liens + collision), rendu en SVG statique.
 * Survol = met en surbrillance le nœud et ses liens de premier degre,
 * estompe le reste (demande du client). Clic sur un nœud ouvre sa fiche ;
 * clic sur un lien permet de le masquer/afficher (reutilise la visibilite
 * des relations, docs/adr — jamais un second systeme de masquage).
 */
export default function RelationsGraphCanvas({
  graph,
  worldSlug,
  edgeColor,
  onToggleEdgeVisibility,
}: {
  graph: RelationsGraph;
  worldSlug: string;
  /** Couleur d'un lien direct depuis la racine (relationshipColor si une attitude existe), sinon `var(--edge)`. */
  edgeColor: (edge: RelationsGraphEdge) => string;
  onToggleEdgeVisibility?: (edge: RelationsGraphEdge) => void;
}) {
  const desktop = useDesktop();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedEdgeId, setPinnedEdgeId] = useState<string | null>(null);

  const positioned = useMemo(() => layout(graph), [graph]);
  const byId = useMemo(() => new Map(positioned.map((n) => [n.id, n])), [positioned]);

  const highlightedNodeIds = useMemo(() => {
    if (!hoveredId) return null;
    const ids = new Set([hoveredId]);
    for (const edge of graph.edges) {
      if (edge.fromId === hoveredId) ids.add(edge.toId);
      if (edge.toId === hoveredId) ids.add(edge.fromId);
    }
    return ids;
  }, [hoveredId, graph.edges]);

  function openEntity(node: RelationsGraphNode, e: React.MouseEvent) {
    if (!desktop) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    desktop.openRef({ kind: "entity", key: node.slug });
  }

  const pinnedEdge = graph.edges.find((e) => e.id === pinnedEdgeId) ?? null;

  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[420px]">
        {graph.edges.map((edge) => {
          const from = byId.get(edge.fromId);
          const to = byId.get(edge.toId);
          if (!from || !to) return null;
          const dimmed = highlightedNodeIds ? !(highlightedNodeIds.has(edge.fromId) && highlightedNodeIds.has(edge.toId)) : false;
          return (
            <g key={edge.id} onClick={() => setPinnedEdgeId(edge.id === pinnedEdgeId ? null : edge.id)} className="cursor-pointer">
              {/* Trait invisible mais large : le trait visible (1.5px) est bien trop fin pour cliquer de maniere fiable a la souris — meme zone de clic que le trait rendu, juste plus genereuse. */}
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="transparent" strokeWidth={14} />
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={edgeColor(edge)}
                strokeWidth={pinnedEdgeId === edge.id ? 3 : 1.5}
                opacity={dimmed ? 0.15 : 0.8}
              />
            </g>
          );
        })}
        {positioned.map((node) => {
          const dimmed = highlightedNodeIds ? !highlightedNodeIds.has(node.id) : false;
          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              opacity={dimmed ? 0.25 : 1}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <Link href={`/m/${worldSlug}/f/${node.slug}`} onClick={(e) => openEntity(node, e)}>
                <circle
                  r={node.degree === 0 ? 14 : 9}
                  fill="var(--panel-raised)"
                  stroke={node.degree === 0 ? "var(--accent)" : "var(--edge-strong)"}
                  strokeWidth={2}
                />
                <text textAnchor="middle" y={node.degree === 0 ? 28 : 22} className="fill-[var(--ink)] text-[10px]">
                  {node.name}
                </text>
              </Link>
            </g>
          );
        })}
      </svg>

      {pinnedEdge && (
        <div className="flex items-center gap-2 rounded-md border border-edge-strong bg-panel-raised px-3 py-1.5 text-xs">
          <span className="text-ink-muted">{pinnedEdge.label}</span>
          <span className="text-ink-muted">— visibilité : {pinnedEdge.visibilityLevel}</span>
          {onToggleEdgeVisibility && (
            <button
              type="button"
              onClick={() => onToggleEdgeVisibility(pinnedEdge)}
              className="ml-auto rounded-full border border-edge px-2 py-0.5 text-ink transition-colors hover:bg-panel"
            >
              {pinnedEdge.visibilityLevel === "gm" ? "Rendre visible aux joueurs" : "Masquer aux joueurs (MJ uniquement)"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
