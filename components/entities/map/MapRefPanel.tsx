"use client";

import { useEffect, useRef, useState } from "react";
import MapCanvas from "./MapCanvas";
import type { MapView } from "@/src/core/schemas/blocks/map";
import type { AssetRow } from "@/src/server/repos/assets";
import type { MapSourceInfo } from "@/src/server/services/mapSource";

/**
 * Contenu d'un bloc `map` en mode "ref" (Lot I, phase F₁, ADR 0017
 * décision 1) — affiche l'image de la carte SOURCE (`sourceBlockId`),
 * jamais sa propre image : seul le cadrage (`defaultView`) est propre à
 * ce bloc. `resolveMapSource` (cote serveur) revérifie la visibilité du
 * bloc source pour CE viewer avant de renvoyer quoi que ce soit — jamais
 * l'image d'une carte que ce compte ne devrait pas voir, même référencée
 * depuis un bloc que ce compte peut, lui, éditer.
 */
export default function MapRefPanel({
  sourceBlockId,
  defaultView,
  onSaveDefaultView,
  height = "100%",
}: {
  sourceBlockId: string;
  defaultView: MapView;
  onSaveDefaultView: (view: MapView) => void;
  height?: number | string;
}) {
  const [source, setSource] = useState<MapSourceInfo | null | undefined>(undefined);
  const [asset, setAsset] = useState<AssetRow | null>(null);
  const pendingViewRef = useRef<MapView | null>(null);

  // Ajuste pendant le rendu plutot que dans un effet (react.dev, "Adjusting
  // state when a prop changes") : `sourceBlockId` change (autre carte
  // choisie dans le selecteur) doit vider l'ancienne resolution avant que
  // l'effet ci-dessous ne relance sa requete, jamais un instant ou l'ancien
  // `source` reste affiche sous un `sourceBlockId` deja perime.
  const [trackedSourceBlockId, setTrackedSourceBlockId] = useState(sourceBlockId);
  if (sourceBlockId !== trackedSourceBlockId) {
    setTrackedSourceBlockId(sourceBlockId);
    setSource(undefined);
    setAsset(null);
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/blocks/${sourceBlockId}/map-source`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: MapSourceInfo | null) => {
        if (!cancelled) setSource(body);
      })
      .catch(() => {
        if (!cancelled) setSource(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceBlockId]);

  useEffect(() => {
    if (!source?.assetId) return;
    let cancelled = false;
    fetch(`/api/assets/${source.assetId}/meta`)
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
  }, [source?.assetId]);

  function saveCurrentViewAsDefault() {
    if (!pendingViewRef.current) return;
    onSaveDefaultView(pendingViewRef.current);
  }

  if (source === undefined) {
    return <p className="text-sm text-ink-muted">Chargement…</p>;
  }
  if (source === null) {
    return <p className="text-sm italic text-ink-muted">Carte référencée non disponible pour l&apos;instant.</p>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs text-ink-muted">Référence : {source.entityName}</span>
        {source.assetId && (
          <button type="button" onClick={saveCurrentViewAsDefault} className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised">
            Définir cette vue par défaut
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {source.assetId && source.thumbnailAssetId && asset ? (
          <MapCanvas
            imageUrl={`/api/assets/${source.assetId}`}
            placeholderUrl={`/api/assets/${source.thumbnailAssetId}`}
            imageWidth={asset.width ?? 1}
            imageHeight={asset.height ?? 1}
            initialView={defaultView}
            height={height}
            onViewChange={(v) => {
              pendingViewRef.current = v;
            }}
          />
        ) : (
          <p className="text-sm italic text-ink-muted">« {source.entityName} » n&apos;a pas encore d&apos;image.</p>
        )}
      </div>
    </div>
  );
}
