"use client";

import { useEffect, useRef, useState } from "react";
import MapCanvas from "@/components/entities/map/MapCanvas";
import type { MapBlockData, MapView } from "@/src/core/schemas/blocks/map";
import type { AssetRow } from "@/src/server/repos/assets";

const THUMBNAIL_MAX_DIMENSION = 800;
const FULL_MAX_DIMENSION = 4096;

/**
 * Bloc `map`, mode "own" (Lot I, phase B — ADR 0017). Le mode "ref"
 * (carte partagee, phase F₁) n'a pas encore d'affordance ici : ce
 * composant suppose `data.mode === "own"`, garde par l'appelant
 * (`EntityBlocks.tsx`).
 *
 * Deux televersements par image (retour utilisateur, "carte de 4000px,
 * vignette d'abord") : une vignette rapide (apercu dans la fiche, jamais
 * la pleine resolution) et un plein format plafonne (vue agrandie,
 * fondu vignette -> plein format des qu'il a fini de charger, voir
 * `MapCanvas`).
 */
export default function MapBlockEditor({ worldSlug, data, onChange }: { worldSlug: string; data: MapBlockData; onChange: (data: MapBlockData) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [asset, setAsset] = useState<AssetRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingViewRef = useRef<MapView | null>(null);
  const assetId = data.mode === "own" ? data.assetId : null;

  // Ajuste pendant le rendu plutot que dans un effet (react.dev,
  // "Adjusting state when a prop changes") : evite un flash de l'ancienne
  // vignette des que `assetId` change (nouveau televersement).
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

  async function uploadVariant(worldSlug: string, file: File, maxDimension: number, visibilityLevel: string): Promise<AssetRow> {
    const formData = new FormData();
    formData.set("file", file);
    formData.set("maxDimension", String(maxDimension));
    formData.set("visibilityLevel", visibilityLevel);
    const res = await fetch(`/api/worlds/${worldSlug}/assets`, { method: "POST", body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Échec du téléversement.");
    }
    return res.json();
  }

  async function upload(file: File) {
    if (data.mode !== "own") return;
    setUploading(true);
    setError(null);
    try {
      const [full, thumbnail] = await Promise.all([
        uploadVariant(worldSlug, file, FULL_MAX_DIMENSION, "public"),
        uploadVariant(worldSlug, file, THUMBNAIL_MAX_DIMENSION, "public"),
      ]);
      setAsset(full);
      onChange({ ...data, assetId: full.id, thumbnailAssetId: thumbnail.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec du téléversement.");
    } finally {
      setUploading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) upload(file);
  }

  function saveCurrentViewAsDefault() {
    if (!pendingViewRef.current || data.mode !== "own") return;
    onChange({ ...data, defaultView: pendingViewRef.current });
  }

  if (data.mode !== "own") {
    return <p className="text-sm text-danger">Ce bloc référence une autre carte — édition non disponible ici pour l&apos;instant.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel disabled:opacity-50"
        >
          {uploading ? "Téléversement…" : data.assetId ? "Remplacer la carte" : "+ Téléverser une carte"}
        </button>
        {data.assetId && (
          <button type="button" onClick={() => setExpanded(true)} className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel">
            Agrandir
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFileChange} />
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      {data.assetId && data.thumbnailAssetId && asset && (
        <MapCanvas
          imageUrl={`/api/assets/${data.thumbnailAssetId}`}
          imageWidth={asset.width ?? 1}
          imageHeight={asset.height ?? 1}
          initialView={data.defaultView}
          height={220}
          interactive={false}
        />
      )}

      {expanded && data.assetId && data.thumbnailAssetId && asset && (
        <div className="fixed inset-0 z-50 flex flex-col bg-scrim p-6" onClick={() => setExpanded(false)}>
          <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-lg border border-edge-strong bg-panel p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">Carte</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={saveCurrentViewAsDefault} className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised">
                  Définir cette vue par défaut
                </button>
                <button type="button" onClick={() => setExpanded(false)} className="rounded-full border border-edge px-2 py-1 text-xs text-ink-muted hover:text-ink">
                  ✕
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <MapCanvas
                imageUrl={`/api/assets/${data.assetId}`}
                placeholderUrl={`/api/assets/${data.thumbnailAssetId}`}
                imageWidth={asset.width ?? 1}
                imageHeight={asset.height ?? 1}
                initialView={data.defaultView}
                height="100%"
                onViewChange={(v) => {
                  pendingViewRef.current = v;
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
