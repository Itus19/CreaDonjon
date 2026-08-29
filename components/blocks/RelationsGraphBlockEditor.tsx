"use client";

import { useEffect, useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import RelationsGraphCanvas from "@/components/entities/psyche/RelationsGraphCanvas";
import { relationshipColor } from "@/src/core/psyche/relationshipColor";
import type { RelationsGraph, RelationsGraphEdge } from "@/src/core/relationsGraph/buildRelationsGraph";
import type { RelationsGraphBlockData } from "@/src/core/schemas/blocks/relationsGraph";

const DEGREE_OPTIONS = [1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n} degré${n > 1 ? "s" : ""}` }));

/**
 * Bloc `relations_graph` (V2-H1 phase 5) : graphe auto-organise des vraies
 * relations de l'entite. La racine est toujours l'entite hote (pas de
 * selecteur — un diagramme sur SA fiche) ; seul le degre de liens visible
 * est configurable, comme demande par le client.
 */
export default function RelationsGraphBlockEditor({
  entityId,
  worldSlug,
  data,
  onChange,
}: {
  entityId: string;
  worldSlug: string;
  data: RelationsGraphBlockData;
  onChange: (data: RelationsGraphBlockData) => void;
}) {
  const [graph, setGraph] = useState<RelationsGraph | null>(null);
  const [edgeColors, setEdgeColors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/entities/${entityId}/relations-graph?rootEntityId=${entityId}&maxDegree=${data.degreesVisible}`)
      .then((res) => (res.ok ? res.json() : { nodes: [], edges: [] }))
      .then((g: RelationsGraph) => setGraph(g));
  }, [entityId, data.degreesVisible]);

  // Couleur des liens qui touchent directement la racine : derivee de
  // l'attitude reelle (friendship_hostility) si une campagne/relation
  // existe — un lien entre deux AUTRES entites reste neutre, on ne connait
  // pas leur attitude mutuelle depuis cette fiche.
  useEffect(() => {
    if (!graph) return;
    const rootEdges = graph.edges.filter((e) => e.fromId === entityId || e.toId === entityId);
    let cancelled = false;
    Promise.all(
      rootEdges.map(async (edge) => {
        const otherId = edge.fromId === entityId ? edge.toId : edge.fromId;
        const res = await fetch(`/api/entities/${entityId}/attitudes/${otherId}`);
        if (!res.ok) return [edge.id, null] as const;
        const body = (await res.json()) as { axes: { friendship_hostility?: number } };
        return [edge.id, body.axes.friendship_hostility ?? null] as const;
      })
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [edgeId, value] of results) {
        if (value !== null) next[edgeId] = relationshipColor(value);
      }
      setEdgeColors(next);
    });
    return () => {
      cancelled = true;
    };
  }, [graph, entityId]);

  async function toggleEdgeVisibility(edge: RelationsGraphEdge) {
    const nextLevel = edge.visibilityLevel === "gm" ? "public" : "gm";
    await fetch(`/api/relations/${edge.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: { level: nextLevel, scopeId: null } }),
    });
    setGraph((prev) =>
      prev
        ? { ...prev, edges: prev.edges.map((e) => (e.id === edge.id ? { ...e, visibilityLevel: nextLevel } : e)) }
        : prev
    );
  }

  function edgeColor(edge: RelationsGraphEdge): string {
    return edgeColors[edge.id] ?? "var(--edge)";
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Degré de liens visible</span>
        <Dropdown
          value={String(data.degreesVisible)}
          options={DEGREE_OPTIONS}
          onChange={(v) => onChange({ ...data, degreesVisible: Number(v) })}
          aria-label="Degré de liens visible"
        />
      </div>

      {!graph && <p className="text-sm text-ink-muted">Chargement…</p>}
      {graph && graph.nodes.length <= 1 && (
        <p className="text-sm italic text-ink-muted">Aucune relation visible pour l&apos;instant.</p>
      )}
      {graph && graph.nodes.length > 1 && (
        <RelationsGraphCanvas
          graph={graph}
          hrefBase={`/m/${worldSlug}/f`}
          edgeColor={edgeColor}
          onToggleEdgeVisibility={toggleEdgeVisibility}
        />
      )}
    </div>
  );
}
