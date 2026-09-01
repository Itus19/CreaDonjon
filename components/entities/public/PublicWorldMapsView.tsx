"use client";

import { useEffect, useState } from "react";
import MapCanvas from "@/components/entities/map/MapCanvas";
import type { WorldMapSummary } from "@/src/server/services/maps";
import type { AssetRow } from "@/src/server/repos/assets";

/**
 * Vue "Cartes" du wiki public/joueur (Lot I, retour utilisateur : "voir
 * la/les cartes en grand", MJ ou wiki public) — lecture seule, liste de
 * toutes les cartes visibles du monde + canevas interactif (pan/zoom,
 * jamais d'edition) pour celle choisie.
 */
export default function PublicWorldMapsView({ maps }: { maps: WorldMapSummary[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(maps[0]?.blockId ?? null);
  const selected = maps.find((m) => m.blockId === selectedId) ?? null;
  const assetId = selected?.data.mode === "own" ? selected.data.assetId : null;
  const [asset, setAsset] = useState<AssetRow | null>(null);

  const [trackedAssetId, setTrackedAssetId] = useState(assetId);
  if (assetId !== trackedAssetId) {
    setTrackedAssetId(assetId);
    setAsset(null);
  }

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    fetch(`/api/assets/${assetId}/meta`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: AssetRow | null) => {
        if (!cancelled) setAsset(body);
      })
      .catch(() => {
        if (!cancelled) setAsset(null);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  if (maps.length === 0) {
    return <p className="text-sm text-ink-muted">Aucune carte visible pour l&apos;instant dans ce monde.</p>;
  }

  return (
    <div className="flex h-[70vh] min-h-0 flex-col gap-4 md:flex-row">
      <div className="flex shrink-0 flex-col gap-1 overflow-y-auto md:w-48 md:border-r md:border-edge/60 md:pr-3">
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
        {selected?.data.mode === "own" && selected.data.assetId && selected.data.thumbnailAssetId && asset ? (
          <MapCanvas
            imageUrl={`/api/assets/${selected.data.assetId}`}
            placeholderUrl={`/api/assets/${selected.data.thumbnailAssetId}`}
            imageWidth={asset.width ?? 1}
            imageHeight={asset.height ?? 1}
            initialView={selected.data.defaultView}
            height="100%"
          />
        ) : (
          <p className="text-sm italic text-ink-muted">Cette carte n&apos;a pas encore d&apos;image.</p>
        )}
      </div>
    </div>
  );
}
