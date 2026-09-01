"use client";

import { useState } from "react";
import MapWorkspace from "@/components/entities/map/MapWorkspace";
import type { WorldMapSummary } from "@/src/server/services/maps";
import type { MapBlockData } from "@/src/core/schemas/blocks/map";

/**
 * Vue "Cartes" du monde, cote MJ (Lot I, retour utilisateur : "un endroit
 * où je puisse travailler... voir la/les cartes en grand") — liste de
 * toutes les cartes du monde + `MapWorkspace` (meme composant que la vue
 * agrandie en place sur une fiche) pour celle choisie. Sauvegarde directe
 * (`PATCH /api/blocks/[id]`, pas via `EntityBlocks.tsx` — cette page ne
 * passe jamais par la fiche elle-meme).
 */
export default function WorldMapsView({ worldSlug, initialMaps }: { worldSlug: string; initialMaps: WorldMapSummary[] }) {
  const [maps, setMaps] = useState(initialMaps);
  const [selectedId, setSelectedId] = useState<string | null>(initialMaps[0]?.blockId ?? null);
  const [error, setError] = useState<string | null>(null);
  const selected = maps.find((m) => m.blockId === selectedId) ?? null;

  async function saveBlock(map: WorldMapSummary, data: MapBlockData) {
    setError(null);
    const res = await fetch(`/api/blocks/${map.blockId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: map.version,
        display: { label: map.label, layout: "map" },
        data,
        visibility: { level: map.visibilityLevel, scopeId: map.visibilityScopeId },
      }),
    });
    if (!res.ok) {
      setError(res.status === 409 ? "Cette carte a été modifiée ailleurs — rechargez la page." : "Échec de l'enregistrement.");
      return;
    }
    const updated = (await res.json()) as { version: number };
    setMaps((prev) => prev.map((m) => (m.blockId === map.blockId ? { ...m, version: updated.version, data } : m)));
  }

  if (maps.length === 0) {
    return <p className="text-sm text-ink-muted">Aucune carte pour l&apos;instant dans ce monde — ajoutez un bloc &laquo;&nbsp;Carte&nbsp;&raquo; à une fiche.</p>;
  }

  return (
    <div className="flex h-[75vh] min-h-0 flex-col gap-2">
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="flex w-48 shrink-0 flex-col gap-1 overflow-y-auto border-r border-edge/60 pr-3">
          {maps.map((m) => (
            <button
              key={m.blockId}
              type="button"
              onClick={() => setSelectedId(m.blockId)}
              className={`truncate rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-panel-raised ${
                selectedId === m.blockId ? "bg-panel-raised text-accent" : "text-ink-soft"
              }`}
            >
              {m.entityName}
              {m.label !== "Carte" && <span className="text-ink-muted"> — {m.label}</span>}
            </button>
          ))}
        </div>
        <div className="min-h-0 min-w-0 flex-1">
          {selected && selected.data.mode === "own" ? (
            <MapWorkspace worldSlug={worldSlug} data={selected.data} onChange={(d) => saveBlock(selected, d)} />
          ) : (
            <p className="text-sm italic text-ink-muted">Cette carte référence une autre carte — édition non disponible ici pour l&apos;instant.</p>
          )}
        </div>
      </div>
    </div>
  );
}
