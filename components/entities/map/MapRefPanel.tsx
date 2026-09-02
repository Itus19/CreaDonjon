"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MapCanvas, { type MapPinMarkerData, type MapRegionShapeData } from "./MapCanvas";
import type { MapView } from "@/src/core/schemas/blocks/map";
import type { AssetRow } from "@/src/server/repos/assets";
import type { MapSourceInfo } from "@/src/server/services/mapSource";
import type { VisibleMapPin } from "@/src/server/services/mapPins";
import type { VisibleMapRegion } from "@/src/server/services/mapRegions";

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
  worldSlug,
  sourceBlockId,
  defaultView,
  onSaveDefaultView,
  height = "100%",
}: {
  worldSlug: string;
  sourceBlockId: string;
  defaultView: MapView;
  onSaveDefaultView: (view: MapView) => void;
  height?: number | string;
}) {
  const router = useRouter();
  const [source, setSource] = useState<MapSourceInfo | null | undefined>(undefined);
  const [asset, setAsset] = useState<AssetRow | null>(null);
  const [pins, setPins] = useState<VisibleMapPin[]>([]);
  const [regions, setRegions] = useState<VisibleMapRegion[]>([]);
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
    setPins([]);
    setRegions([]);
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
    let cancelled = false;
    fetch(`/api/blocks/${sourceBlockId}/pins`)
      .then((res) => (res.ok ? res.json() : []))
      .then((body: VisibleMapPin[]) => {
        if (!cancelled) setPins(body);
      })
      .catch(() => {
        if (!cancelled) setPins([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceBlockId]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/blocks/${sourceBlockId}/regions`)
      .then((res) => (res.ok ? res.json() : []))
      .then((body: VisibleMapRegion[]) => {
        if (!cancelled) setRegions(body);
      })
      .catch(() => {
        if (!cancelled) setRegions([]);
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

  /** Lecture seule (retour utilisateur : "clic sur une punaise liée navigue vers la fiche") — les punaises appartiennent au bloc SOURCE, jamais editables depuis une reference. */
  function handlePinClick(pin: MapPinMarkerData) {
    const full = pins.find((p) => p.id === pin.id);
    if (full?.refEntity) router.push(`/m/${worldSlug}/f/${full.refEntity.slug}`);
  }

  /** Meme motif que `handlePinClick`, pour les zones. */
  function handleRegionClick(region: MapRegionShapeData) {
    const full = regions.find((r) => r.id === region.id);
    if (full?.refEntity) router.push(`/m/${worldSlug}/f/${full.refEntity.slug}`);
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
            pins={pins.map((p) => ({ id: p.id, x: p.x, y: p.y, label: p.label, size: p.size as MapPinMarkerData["size"], refEntityId: p.ref?.id ?? null }))}
            onPinClick={handlePinClick}
            regions={regions.map((r) => ({
              id: r.id,
              name: r.name,
              shape: r.shape,
              fillColor: r.fillColor,
              borderColor: r.borderColor,
              unrevealedFog: r.fogGated && !r.revealed,
            }))}
            onRegionClick={handleRegionClick}
          />
        ) : (
          <p className="text-sm italic text-ink-muted">« {source.entityName} » n&apos;a pas encore d&apos;image.</p>
        )}
      </div>
    </div>
  );
}
