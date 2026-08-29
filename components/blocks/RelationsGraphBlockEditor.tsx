"use client";

import { useEffect, useMemo, useState } from "react";
import Dropdown from "@/components/shared/Dropdown";
import RelationsGraphCanvas from "@/components/entities/psyche/RelationsGraphCanvas";
import { relationshipColor } from "@/src/core/psyche/relationshipColor";
import { buildRelationsGraph, type RelationsGraphEdge } from "@/src/core/relationsGraph/buildRelationsGraph";
import type { RelationsGraphData } from "@/src/server/services/relationsGraph";
import type { RelationsGraphBlockData } from "@/src/core/schemas/blocks/relationsGraph";

const DEGREE_OPTIONS = [1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n} degré${n > 1 ? "s" : ""}` }));

/**
 * Bloc `relations_graph` (V2-H1 phase 5) : graphe auto-organise des vraies
 * relations de l'entite. La racine est toujours l'entite hote (pas de
 * selecteur — un diagramme sur SA fiche) ; seul le degre de liens visible
 * est configurable, comme demande par le client.
 *
 * Retour utilisateur ("changer le degre met du temps a charger") : les
 * aretes/entites du monde (deux requetes sur toute la base, filtrees par
 * visibilite) ne dependent PAS du degre choisi — seul le parcours en
 * largeur qui en derive le sous-graphe visible en depend, et c'est une
 * fonction PURE (`buildRelationsGraph`, src/core, sans reseau). Ce bloc ne
 * recupere donc plus les donnees qu'une fois par montage (`rawData`), et
 * recalcule le graphe affiche localement (`useMemo`) a chaque changement
 * de degre — plus aucun aller-retour serveur pour ce geste, qui devient
 * instantane. Meme raisonnement pour les couleurs d'attitude : elles ne
 * dependent que des aretes qui touchent la racine, qui ne changent pas
 * avec le degre — l'effet qui les recupere depend de `rawData`, jamais du
 * graphe affiche, pour ne plus jamais se rejouer a un simple changement
 * de degre.
 */
export default function RelationsGraphBlockEditor({
  entityId,
  worldSlug,
  data,
  onChange,
  onRelationsChanged,
  reloadSignal,
}: {
  entityId: string;
  worldSlug: string;
  data: RelationsGraphBlockData;
  onChange: (data: RelationsGraphBlockData) => void;
  /** V2, retour utilisateur : signale au reste de la fiche (liste du haut, bloc genealogie) qu'une visibilite a change ici. */
  onRelationsChanged?: () => void;
  /** V2, retour utilisateur : incremente par un ancetre quand une relation change ailleurs — force le rechargement du graphe, qui sinon ne rejoue jamais son effet (`entityId` seul en dependance sinon). */
  reloadSignal?: number;
}) {
  const [rawData, setRawData] = useState<RelationsGraphData | null>(null);
  const [edgeColors, setEdgeColors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/entities/${entityId}/relations-graph-data`)
      .then((res) => (res.ok ? res.json() : { edges: [], entities: [] }))
      .then((d: RelationsGraphData) => {
        if (!cancelled) setRawData(d);
      });
    return () => {
      cancelled = true;
    };
  }, [entityId, reloadSignal]);

  // Recalcul PUR, sans reseau (retour utilisateur — voir le commentaire
  // au-dessus du composant) : instantane a chaque changement de degre.
  const graph = useMemo(() => {
    if (!rawData) return null;
    return buildRelationsGraph({
      rootId: entityId,
      maxDegree: data.degreesVisible,
      edges: rawData.edges,
      entities: rawData.entities,
    });
  }, [rawData, entityId, data.degreesVisible]);

  // Couleur des liens qui touchent directement la racine : derivee de
  // l'attitude reelle (friendship_hostility) si une campagne/relation
  // existe — un lien entre deux AUTRES entites reste neutre, on ne connait
  // pas leur attitude mutuelle depuis cette fiche. Depend de `rawData`
  // (jamais de `graph`) : les aretes qui touchent la racine ne changent
  // pas selon le degre choisi, inutile de tout re-demander a chaque fois.
  useEffect(() => {
    if (!rawData) return;
    const rootEdges = rawData.edges.filter((e) => e.sourceId === entityId || e.targetId === entityId);
    let cancelled = false;
    Promise.all(
      rootEdges.map(async (edge) => {
        const otherId = edge.sourceId === entityId ? edge.targetId : edge.sourceId;
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
  }, [rawData, entityId]);

  async function toggleEdgeVisibility(edge: RelationsGraphEdge) {
    const nextLevel = edge.visibilityLevel === "gm" ? "public" : "gm";
    await fetch(`/api/relations/${edge.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: { level: nextLevel, scopeId: null } }),
    });
    setRawData((prev) =>
      prev ? { ...prev, edges: prev.edges.map((e) => (e.id === edge.id ? { ...e, visibilityLevel: nextLevel } : e)) } : prev
    );
    onRelationsChanged?.();
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
