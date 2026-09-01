"use client";

import { useEffect, useRef, useState } from "react";
import MapCanvas from "./MapCanvas";
import type { MapBlockData, MapView } from "@/src/core/schemas/blocks/map";
import type { AssetRow } from "@/src/server/repos/assets";

// Retour utilisateur, avec capture a l'appui : la vignette a 800px restait
// visiblement floue une fois etiree a la largeur reelle d'un bloc de fiche
// (souvent 900-1400px CSS, plus encore sur un ecran haute densite) — la
// bonne association vignette/dimensions (autre correctif) n'y change rien,
// 800 reels px etires sur une largeur d'affichage plus grande restent flous
// par nature. Alignee sur IMAGE_MAX_DIMENSION (blockImages.ts, meme
// compromis poids/nettete pour un bloc `image` ordinaire).
const THUMBNAIL_MAX_DIMENSION = 1600;
const FULL_MAX_DIMENSION = 4096;

/**
 * Espace de travail d'une carte (Lot I, retour utilisateur : "un endroit
 * où je puisse travailler et où [je] pourrai voir la/les cartes en
 * grand") — televersement/remplacement, canevas interactif plein format,
 * "Définir cette vue par défaut". Extrait de `MapBlockEditor.tsx` pour
 * etre partage entre la vue agrandie EN PLACE (modale sur la fiche) et la
 * vue "Cartes" dediee (`/m/[worldSlug]/cartes`, `BookSkin` — MJ ou wiki
 * public), plutot que deux implementations paralleles du meme televersement.
 *
 * Mode "own" seul (garde par l'appelant) — le mode "ref" (phase F₁) n'a
 * pas encore d'affordance de televersement (rien a televerser, ce n'est
 * pas lui le proprietaire de l'image).
 */
export default function MapWorkspace({
  worldSlug,
  data,
  onChange,
  onSaveNow,
  height = "100%",
}: {
  worldSlug: string;
  data: Extract<MapBlockData, { mode: "own" }>;
  onChange: (data: MapBlockData) => void;
  /**
   * Persistance immediate (Lot I) : quand ce composant est ouvert dans une
   * fenetre modale imbriquee dans le conteneur du bloc (`MapBlockEditor.tsx`),
   * aucun clic a l'interieur ne declenche la sauvegarde habituelle au blur
   * du conteneur — bug decouvert en test live (upload visible a l'ecran,
   * jamais persiste). `onChange` reste responsable de l'etat local en
   * memoire ; quand fourni, `onSaveNow` persiste en plus, tout de suite,
   * avec la donnee qu'on vient de calculer (meme motif que le dropdown de
   * visibilite : `onPatchBlock` puis `onSaveBlock` avec la donnee en
   * surcharge, jamais lue depuis un etat qui n'a pas encore re-rendu).
   * Absent (vue "Cartes" dediee) : `onChange` persiste deja lui-meme.
   */
  onSaveNow?: (data: MapBlockData) => void;
  height?: number | string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asset, setAsset] = useState<AssetRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingViewRef = useRef<MapView | null>(null);

  const [trackedAssetId, setTrackedAssetId] = useState(data.assetId);
  if (data.assetId !== trackedAssetId) {
    setTrackedAssetId(data.assetId);
    setAsset(null);
  }

  useEffect(() => {
    if (!data.assetId) return;
    let cancelled = false;
    fetch(`/api/assets/${data.assetId}/meta`)
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
  }, [data.assetId]);

  async function uploadVariant(file: File, maxDimension: number, visibilityLevel: string): Promise<AssetRow> {
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
    setUploading(true);
    setError(null);
    try {
      const [full, thumbnail] = await Promise.all([
        uploadVariant(file, FULL_MAX_DIMENSION, "public"),
        uploadVariant(file, THUMBNAIL_MAX_DIMENSION, "public"),
      ]);
      setAsset(full);
      const next: MapBlockData = { ...data, assetId: full.id, thumbnailAssetId: thumbnail.id };
      onChange(next);
      onSaveNow?.(next);
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
    if (!pendingViewRef.current) return;
    const next: MapBlockData = { ...data, defaultView: pendingViewRef.current };
    onChange(next);
    onSaveNow?.(next);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel disabled:opacity-50"
        >
          {uploading ? "Téléversement…" : data.assetId ? "Remplacer la carte" : "+ Téléverser une carte"}
        </button>
        {data.assetId && (
          <button type="button" onClick={saveCurrentViewAsDefault} className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised">
            Définir cette vue par défaut
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFileChange} />
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      <div className="min-h-0 flex-1">
        {data.assetId && data.thumbnailAssetId && asset ? (
          <MapCanvas
            imageUrl={`/api/assets/${data.assetId}`}
            placeholderUrl={`/api/assets/${data.thumbnailAssetId}`}
            imageWidth={asset.width ?? 1}
            imageHeight={asset.height ?? 1}
            initialView={data.defaultView}
            height={height}
            onViewChange={(v) => {
              pendingViewRef.current = v;
            }}
          />
        ) : (
          <p className="text-sm italic text-ink-muted">Aucune carte pour l&apos;instant — téléversez une image.</p>
        )}
      </div>
    </div>
  );
}
