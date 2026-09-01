"use client";

import { useEffect, useState } from "react";
import MapCanvas from "@/components/entities/map/MapCanvas";
import MapWorkspace from "@/components/entities/map/MapWorkspace";
import MapRefPanel from "@/components/entities/map/MapRefPanel";
import CartePicker from "@/components/entities/map/CartePicker";
import { DEFAULT_MAP_BLOCK_DATA, type MapBlockData, type MapView } from "@/src/core/schemas/blocks/map";
import type { AssetRow } from "@/src/server/repos/assets";
import type { MapSourceInfo, CarteOption } from "@/src/server/services/mapSource";

// Meme hauteur que RelationsGraphCanvas/FamilyTreeCanvas (retour
// utilisateur : "le bloc carte a une forme bizarre" — il faisait 220px,
// nettement plus bas que ses voisins genealogie/reseau, sans raison liee au
// contenu de ce bloc precis).
const COLLAPSED_HEIGHT = 420;

/**
 * Bloc `map`, mode "own" OU "ref" (Lot I, phase F₁ — ADR 0017 décision 1).
 * Aperçu figé (vignette) + un bouton "Agrandir" qui ouvre soit
 * `MapWorkspace` (téléversement, mode "own"), soit `MapRefPanel` (carte
 * d'une fiche `carte` existante, mode "ref") en superposition plein écran.
 * Un `CartePicker` reste toujours accessible dans la modale pour basculer
 * d'un mode à l'autre — jamais un second écran de choix séparé.
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
  // `undefined` = pas encore resolu, distinct de `null` = confirme
  // indisponible (retour utilisateur : un flash "Carte référencée non
  // disponible" apparaissait a chaque chargement, le temps que la requete
  // reponde — les deux etats etaient confondus sous `null`).
  const [refSource, setRefSource] = useState<MapSourceInfo | null | undefined>(undefined);
  const [refAsset, setRefAsset] = useState<AssetRow | null>(null);

  const assetId = data.mode === "own" ? data.assetId : null;
  const thumbnailAssetId = data.mode === "own" ? data.thumbnailAssetId : null;
  const sourceBlockId = data.mode === "ref" ? data.sourceBlockId : null;

  // L'aperçu replié affiche le plein format (retour utilisateur : "si on
  // peut avoir plus net fait le" — la vignette, meme relevee a 1600px,
  // restait un cran en dessous du plein format une fois etiree a la
  // largeur d'un bloc) avec la vignette comme `placeholderUrl` pendant son
  // chargement (meme fondu que la vue agrandie, `MapWorkspace.tsx`) — les
  // dimensions doivent donc venir du plein format (`assetId`), pas de la
  // vignette, meme raison que le bug precedent en sens inverse.
  const [trackedAssetId, setTrackedAssetId] = useState(assetId);
  if (assetId !== trackedAssetId) {
    setTrackedAssetId(assetId);
    setAsset(null);
  }
  const [trackedSourceBlockId, setTrackedSourceBlockId] = useState(sourceBlockId);
  if (sourceBlockId !== trackedSourceBlockId) {
    setTrackedSourceBlockId(sourceBlockId);
    setRefSource(undefined);
    setRefAsset(null);
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

  useEffect(() => {
    if (!sourceBlockId) return;
    let cancelled = false;
    fetch(`/api/blocks/${sourceBlockId}/map-source`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: MapSourceInfo | null) => {
        if (!cancelled) setRefSource(body);
      })
      .catch(() => {
        if (!cancelled) setRefSource(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceBlockId]);

  useEffect(() => {
    if (!refSource?.assetId) return;
    let cancelled = false;
    fetch(`/api/assets/${refSource.assetId}/meta`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: AssetRow | null) => {
        if (!cancelled) setRefAsset(body);
      })
      .catch(() => {
        if (!cancelled) setRefAsset(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refSource?.assetId]);

  function pickCarte(option: CarteOption) {
    // Le cadrage precedent n'a de sens que pour l'image d'avant (coordonnees
    // normalisees, mais un autre point d'interet) — repart d'un cadrage par
    // defaut a chaque changement de carte referencee, jamais un cadrage
    // herite qui viserait au hasard sur la nouvelle image.
    const next: MapBlockData = { __v: 1, mode: "ref", sourceBlockId: option.blockId, defaultView: DEFAULT_MAP_BLOCK_DATA.defaultView };
    onChange(next);
    onSaveNow?.(next);
  }

  function useOwnImage() {
    onChange(DEFAULT_MAP_BLOCK_DATA);
    onSaveNow?.(DEFAULT_MAP_BLOCK_DATA);
  }

  function saveRefDefaultView(view: MapView) {
    if (data.mode !== "ref") return;
    const next: MapBlockData = { ...data, defaultView: view };
    onChange(next);
    onSaveNow?.(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setExpanded(true)} className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel">
          {data.mode === "ref" ? "Agrandir / changer" : assetId ? "Agrandir / remplacer" : "+ Téléverser une carte"}
        </button>
      </div>

      {data.mode === "own" && assetId && thumbnailAssetId && asset && (
        <MapCanvas
          imageUrl={`/api/assets/${assetId}`}
          placeholderUrl={`/api/assets/${thumbnailAssetId}`}
          imageWidth={asset.width ?? 1}
          imageHeight={asset.height ?? 1}
          initialView={data.defaultView}
          height={COLLAPSED_HEIGHT}
          interactive={false}
        />
      )}

      {data.mode === "ref" &&
        (refSource === undefined ? (
          <p className="text-sm italic text-ink-muted">Chargement…</p>
        ) : refSource === null ? (
          <p className="text-sm italic text-ink-muted">Carte référencée non disponible pour l&apos;instant.</p>
        ) : refSource.assetId && refSource.thumbnailAssetId && refAsset ? (
          <MapCanvas
            imageUrl={`/api/assets/${refSource.assetId}`}
            placeholderUrl={`/api/assets/${refSource.thumbnailAssetId}`}
            imageWidth={refAsset.width ?? 1}
            imageHeight={refAsset.height ?? 1}
            initialView={data.defaultView}
            height={COLLAPSED_HEIGHT}
            interactive={false}
          />
        ) : (
          <p className="text-sm italic text-ink-muted">Chargement…</p>
        ))}

      {expanded && (
        <div className="fixed inset-0 z-50 flex flex-col bg-scrim p-6" onClick={() => setExpanded(false)}>
          <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-lg border border-edge-strong bg-panel p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink">Carte</span>
                <span className="text-xs text-ink-muted">— référencer :</span>
                <CartePicker worldSlug={worldSlug} value={sourceBlockId} onPick={pickCarte} />
                {data.mode === "ref" && (
                  <button type="button" onClick={useOwnImage} className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised">
                    Téléverser ma propre image à la place
                  </button>
                )}
              </div>
              <button type="button" onClick={() => setExpanded(false)} className="rounded-full border border-edge px-2 py-1 text-xs text-ink-muted hover:text-ink">
                ✕
              </button>
            </div>
            {data.mode === "own" ? (
              <MapWorkspace worldSlug={worldSlug} data={data} onChange={onChange} onSaveNow={onSaveNow} />
            ) : (
              <MapRefPanel sourceBlockId={data.sourceBlockId} defaultView={data.defaultView} onSaveDefaultView={saveRefDefaultView} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
