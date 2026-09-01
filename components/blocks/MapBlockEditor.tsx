"use client";

import { useEffect, useState } from "react";
import MapCanvas from "@/components/entities/map/MapCanvas";
import MapWorkspace from "@/components/entities/map/MapWorkspace";
import type { MapBlockData } from "@/src/core/schemas/blocks/map";
import type { AssetRow } from "@/src/server/repos/assets";

/**
 * Bloc `map`, mode "own" (Lot I, phase B — ADR 0017). Le mode "ref"
 * (carte partagee, phase F₁) n'a pas encore d'affordance ici : ce
 * composant suppose `data.mode === "own"`, garde par l'appelant
 * (`EntityBlocks.tsx`).
 *
 * Juste l'apercu (vignette figee) + un bouton "Agrandir" qui ouvre
 * `MapWorkspace` (televersement, canevas interactif, cadrage par defaut)
 * en superposition plein ecran — meme composant que la vue "Cartes"
 * dediee (`/m/[worldSlug]/cartes`), jamais une deuxieme implementation du
 * televersement.
 */
export default function MapBlockEditor({
  worldSlug,
  data,
  onChange,
  onSaveNow,
}: {
  worldSlug: string;
  data: MapBlockData;
  onChange: (data: MapBlockData) => void;
  /** Persistance immediate (Lot I) — voir le commentaire dans `MapWorkspace.tsx`. */
  onSaveNow?: (data: MapBlockData) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [asset, setAsset] = useState<AssetRow | null>(null);
  const assetId = data.mode === "own" ? data.assetId : null;
  const thumbnailAssetId = data.mode === "own" ? data.thumbnailAssetId : null;

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

  if (data.mode !== "own") {
    return <p className="text-sm text-danger">Ce bloc référence une autre carte — édition non disponible ici pour l&apos;instant.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setExpanded(true)} className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel">
          {assetId ? "Agrandir / remplacer" : "+ Téléverser une carte"}
        </button>
      </div>

      {assetId && thumbnailAssetId && asset && (
        <MapCanvas
          imageUrl={`/api/assets/${thumbnailAssetId}`}
          imageWidth={asset.width ?? 1}
          imageHeight={asset.height ?? 1}
          initialView={data.defaultView}
          height={220}
          interactive={false}
        />
      )}

      {expanded && (
        <div className="fixed inset-0 z-50 flex flex-col bg-scrim p-6" onClick={() => setExpanded(false)}>
          <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-lg border border-edge-strong bg-panel p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">Carte</span>
              <button type="button" onClick={() => setExpanded(false)} className="rounded-full border border-edge px-2 py-1 text-xs text-ink-muted hover:text-ink">
                ✕
              </button>
            </div>
            <MapWorkspace worldSlug={worldSlug} data={data} onChange={onChange} onSaveNow={onSaveNow} />
          </div>
        </div>
      )}
    </div>
  );
}
