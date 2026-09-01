"use client";

import { useEffect, useState } from "react";
import MapCanvas from "@/components/entities/map/MapCanvas";
import type { MapBlockData } from "@/src/core/schemas/blocks/map";
import type { AssetRow } from "@/src/server/repos/assets";
import type { MapSourceInfo } from "@/src/server/services/mapSource";

// Meme hauteur que RelationsGraphCanvas/FamilyTreeCanvas (retour
// utilisateur : "le bloc carte a une forme bizarre") — voir MapBlockEditor.tsx.
const COLLAPSED_HEIGHT = 420;

/**
 * Rendu public/joueur du bloc `map` (Lot I, phases B et F₁) — lecture
 * seule, meme composant `MapCanvas` que l'editeur MJ (`MapBlockEditor.tsx`),
 * juste sans les commandes de televersement. Mode "ref" : l'image vient de
 * `mapSource`, deja resolue et revalidee cote serveur pour CE viewer
 * (`resolveMapSource`, `publicShare.ts`/`playerEntityDetail.ts`) — jamais
 * un fetch client sur le `sourceBlockId` brut, qui exigerait de re-decider
 * la visibilite ici, cote client.
 */
export default function PublicMapBlock({ data, mapSource }: { data: MapBlockData; mapSource?: MapSourceInfo | null }) {
  const assetId = data.mode === "own" ? data.assetId : mapSource?.assetId ?? null;
  const thumbnailAssetId = data.mode === "own" ? data.thumbnailAssetId : mapSource?.thumbnailAssetId ?? null;
  const [asset, setAsset] = useState<AssetRow | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Ajuste pendant le rendu plutot que dans un effet (react.dev,
  // "Adjusting state when a prop changes").
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

  if (data.mode === "ref" && !mapSource) {
    return <p className="text-sm italic text-ink-muted">Carte référencée non disponible pour l&apos;instant.</p>;
  }
  if (!assetId || !thumbnailAssetId) {
    return <p className="text-sm italic text-ink-muted">Aucune carte pour l&apos;instant.</p>;
  }
  if (!asset) {
    return <p className="text-sm text-ink-muted">Chargement…</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => setExpanded(true)} className="w-fit rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel">
        Agrandir
      </button>
      <MapCanvas
        imageUrl={`/api/assets/${thumbnailAssetId}`}
        imageWidth={asset.width ?? 1}
        imageHeight={asset.height ?? 1}
        initialView={data.defaultView}
        height={COLLAPSED_HEIGHT}
        interactive={false}
      />
      {expanded && (
        <div className="fixed inset-0 z-50 flex flex-col bg-scrim p-6" onClick={() => setExpanded(false)}>
          <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-lg border border-edge-strong bg-panel p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end">
              <button type="button" onClick={() => setExpanded(false)} className="rounded-full border border-edge px-2 py-1 text-xs text-ink-muted hover:text-ink">
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <MapCanvas
                imageUrl={`/api/assets/${assetId}`}
                placeholderUrl={`/api/assets/${thumbnailAssetId}`}
                imageWidth={asset.width ?? 1}
                imageHeight={asset.height ?? 1}
                initialView={data.defaultView}
                height="100%"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
