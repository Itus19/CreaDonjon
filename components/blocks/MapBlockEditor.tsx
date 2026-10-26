"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import MapCanvas, { type CommandesCarte, type MapPinMarkerData } from "@/components/entities/map/MapCanvas";
import CarteListe, { DispositionCarte, type EcrireVisibilite } from "@/components/entities/map/CarteListe";
import { elementsDepuis, rangerParCouches, texteInfoBulle, type ElementCarte } from "@/lib/ui/carte";
import { isVisibilityLevelKey } from "@/components/shared/visibilityOptions";
import type { VisibleMapLayer } from "@/src/server/services/mapLayers";
import MapWorkspace from "@/components/entities/map/MapWorkspace";
import MapRefPanel from "@/components/entities/map/MapRefPanel";
import CartePicker from "@/components/entities/map/CartePicker";
import { DEFAULT_MAP_BLOCK_DATA, type MapBlockData, type MapView } from "@/src/core/schemas/blocks/map";
import type { AssetRow } from "@/src/server/repos/assets";
import type { MapSourceInfo, CarteOption } from "@/src/server/services/mapSource";
import type { VisibleMapPin } from "@/src/server/services/mapPins";
import type { VisibleMapRegion } from "@/src/server/services/mapRegions";
import type { OtherEntityOption } from "@/components/entities/RelationsChips";
import { useEditCommit } from "@/components/shared/EditCommitContext";

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
  blockId,
  otherEntities,
  data,
  visibilityLevel,
  visibilityScopeId,
  onChange,
}: {
  worldSlug: string;
  /** Punaises (Lot I, phase C) : `map_pins` est cle par `block_id`, jamais fourni par `data`. */
  blockId: string;
  otherEntities: OtherEntityOption[];
  data: MapBlockData;
  /** Visibilite du bloc — transmise a `MapWorkspace` pour que l'image televersee herite de la meme visibilite (voir le commentaire dans `MapWorkspace.tsx`). */
  visibilityLevel: string;
  visibilityScopeId: string | null;
  onChange: (data: MapBlockData) => void;
}) {
  /** Persistance immediate (ADR 0023) — voir le commentaire dans `MapWorkspace.tsx`. */
  const commit = useEditCommit();
  const t = useTranslations("fiche.carte");
  const tn = useTranslations("fiche");
  const commandesRef = useRef<CommandesCarte>(null);
  const [allumeId, setAllumeId] = useState<string | null>(null);
  const [layers, setLayers] = useState<VisibleMapLayer[]>([]);
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
      .catch((erreur) => {
        console.error("Chargement du fond de carte impossible", erreur);
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
      .catch((erreur) => {
        console.error("Chargement de la carte source impossible", erreur);
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
      .catch((erreur) => {
        console.error("Chargement de l'image de la carte source impossible", erreur);
        if (!cancelled) setRefAsset(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refSource?.assetId]);

  // Punaises/zones dans l'apercu replie aussi (retour utilisateur, "il
  // manque la zone rouge dans le bloc map d'une fiche" — le comportement
  // d'origine, vignette figee sans survol des elements, etait volontaire
  // (phase C) mais s'est revele surprenant une fois en usage reel). Cle de
  // lecture = bloc SOURCE (`blockId` en mode "own", `sourceBlockId` en mode
  // "ref" — jamais `data`, qui ne porte ni punaises ni zones, ADR 0017
  // decision 1). Redemande a chaque fermeture de la fenetre agrandie
  // (`expanded` repasse a false) pour refleter un ajout/edit fait dedans,
  // qui ne remonte jamais par `data`/`onChange`.
  const overlaySourceId = data.mode === "own" ? blockId : sourceBlockId;
  const [pins, setPins] = useState<VisibleMapPin[]>([]);
  const [regions, setRegions] = useState<VisibleMapRegion[]>([]);
  const [trackedOverlaySourceId, setTrackedOverlaySourceId] = useState(overlaySourceId);
  if (overlaySourceId !== trackedOverlaySourceId) {
    setTrackedOverlaySourceId(overlaySourceId);
    setPins([]);
    setRegions([]);
    setLayers([]);
    setAllumeId(null);
  }

  useEffect(() => {
    if (!overlaySourceId) return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/blocks/${overlaySourceId}/pins`).then((res) => (res.ok ? res.json() : [])),
      fetch(`/api/blocks/${overlaySourceId}/regions`).then((res) => (res.ok ? res.json() : [])),
      fetch(`/api/blocks/${overlaySourceId}/layers`).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([p, r, l]: [VisibleMapPin[], VisibleMapRegion[], VisibleMapLayer[]]) => {
        if (!cancelled) {
          setPins(p);
          setRegions(r);
          setLayers(l);
        }
      })
      .catch((erreur) => {
        console.error("Chargement des repères impossible", erreur);
        if (!cancelled) {
          setPins([]);
          setRegions([]);
          setLayers([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [overlaySourceId, expanded]);

  function pickCarte(option: CarteOption) {
    // Le cadrage precedent n'a de sens que pour l'image d'avant (coordonnees
    // normalisees, mais un autre point d'interet) — repart d'un cadrage par
    // defaut a chaque changement de carte referencee, jamais un cadrage
    // herite qui viserait au hasard sur la nouvelle image.
    const next: MapBlockData = { __v: 1, mode: "ref", sourceBlockId: option.blockId, defaultView: DEFAULT_MAP_BLOCK_DATA.defaultView };
    onChange(next);
    commit?.();
  }

  function useOwnImage() {
    onChange(DEFAULT_MAP_BLOCK_DATA);
    commit?.();
  }

  function saveRefDefaultView(view: MapView) {
    if (data.mode !== "ref") return;
    const next: MapBlockData = { ...data, defaultView: view };
    onChange(next);
    commit?.();
  }

  const elements = elementsDepuis(pins, regions);
  const nomCouche = (layerId: string | null) => layers.find((l) => l.id === layerId)?.name ?? null;
  const niveauLibelle = (n: string) => (isVisibilityLevelKey(n) ? tn(`niveaux.${n}`) : n);

  function choisir(element: ElementCarte) {
    setAllumeId(element.id);
    commandesRef.current?.centrerSur(element.centre);
  }

  /**
   * La pastille d'un élément ou d'une couche écrit par la route PROPRE de
   * l'élément (PATCH partiel) : jamais `onChange`/`commit` du bloc, qui
   * enverrait en plus une sauvegarde du bloc entier (409). L'écran change
   * tout de suite et revient en arrière si le serveur refuse.
   */
  const ecrireVisibilite: EcrireVisibilite = async (genre, id, niveau) => {
    const route = genre === "pin" ? "map-pins" : genre === "region" ? "map-regions" : "map-layers";
    const avant =
      genre === "pin" ? pins.find((p) => p.id === id)?.visibilityLevel : genre === "region" ? regions.find((r) => r.id === id)?.visibilityLevel : layers.find((l) => l.id === id)?.visibilityLevel;
    const poser = (n: string) => {
      if (genre === "pin") setPins((prev) => prev.map((p) => (p.id === id ? { ...p, visibilityLevel: n } : p)));
      else if (genre === "region") setRegions((prev) => prev.map((r) => (r.id === id ? { ...r, visibilityLevel: n } : r)));
      else setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, visibilityLevel: n } : l)));
    };
    poser(niveau);
    try {
      const res = await fetch(`/api/${route}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: { level: niveau, scopeId: null } }),
      });
      if (res.ok) return true;
    } catch (erreur) {
      console.error("Changement de visibilité impossible", erreur);
    }
    if (avant !== undefined) poser(avant);
    return false;
  };

  async function ajouterCouche(nom: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/blocks/${blockId}/layers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nom, visibility: { level: "public", scopeId: null } }),
      });
      if (!res.ok) return false;
      const rel = await fetch(`/api/blocks/${blockId}/layers`);
      if (rel.ok) setLayers((await rel.json()) as VisibleMapLayer[]);
      return true;
    } catch (erreur) {
      console.error("Création de la couche impossible", erreur);
      return false;
    }
  }

  const marqueurs: MapPinMarkerData[] = pins.map((p) => ({
    id: p.id,
    x: p.x,
    y: p.y,
    label: p.label,
    size: p.size as MapPinMarkerData["size"],
    refEntityId: p.ref?.id ?? null,
    infoBulle: texteInfoBulle(p.label, nomCouche(p.layerId), niveauLibelle(p.visibilityLevel)),
  }));
  const zones = regions.map((r) => ({
    id: r.id,
    name: r.name,
    shape: r.shape,
    fillColor: r.fillColor,
    borderColor: r.borderColor,
    unrevealedFog: r.fogGated && !r.revealed,
  }));

  function carteEtListe(assetIdPlein: string, assetIdVignette: string, dims: AssetRow, vue: MapView, source?: string) {
    return (
      <DispositionCarte
        carte={
          <MapCanvas
            imageUrl={`/api/assets/${assetIdPlein}`}
            placeholderUrl={`/api/assets/${assetIdVignette}`}
            imageWidth={dims.width ?? 1}
            imageHeight={dims.height ?? 1}
            initialView={vue}
            height={COLLAPSED_HEIGHT}
            commandes
            commandesRef={commandesRef}
            allumeId={allumeId}
            pins={marqueurs}
            onPinClick={(p) => setAllumeId(p.id)}
            regions={zones}
            onRegionClick={(r) => setAllumeId(r.id)}
          />
        }
        liste={
          <CarteListe
            groupes={rangerParCouches(layers, elements)}
            allumeId={allumeId}
            onChoisir={choisir}
            ecrire={source === undefined ? ecrireVisibilite : undefined}
            sansPrive={false}
            titreSource={source}
            actions={
              source === undefined
                ? { onAjouterPunaise: () => setExpanded(true), onAjouterZone: () => setExpanded(true), onAjouterCouche: ajouterCouche }
                : undefined
            }
          />
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setExpanded(true)} className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel">
          {data.mode === "ref" ? t("agrandirRef") : assetId ? t("agrandirOwn") : t("televerser")}
        </button>
      </div>

      {data.mode === "own" && assetId && thumbnailAssetId && asset && carteEtListe(assetId, thumbnailAssetId, asset, data.defaultView)}

      {data.mode === "ref" &&
        (refSource === undefined ? (
          <p className="text-sm italic text-ink-muted">{t("chargement")}</p>
        ) : refSource === null ? (
          <p className="text-sm italic text-ink-muted">{t("sourceIndisponible")}</p>
        ) : refSource.assetId && refSource.thumbnailAssetId && refAsset ? (
          carteEtListe(refSource.assetId, refSource.thumbnailAssetId, refAsset, data.defaultView, refSource.entityName)
        ) : (
          <p className="text-sm italic text-ink-muted">{t("chargement")}</p>
        ))}

      {expanded && (
        <div className="fixed inset-0 z-50 flex flex-col bg-scrim p-6" onClick={() => setExpanded(false)}>
          <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-lg border border-edge-strong bg-panel p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink">{t("titre")}</span>
                <span className="text-xs text-ink-muted">{t("referencer")}</span>
                <CartePicker worldSlug={worldSlug} value={sourceBlockId} onPick={pickCarte} />
                {data.mode === "ref" && (
                  <button type="button" onClick={useOwnImage} className="rounded-full border border-edge px-3 py-1 text-xs text-ink transition-colors hover:bg-panel-raised">
                    {t("utiliserImage")}
                  </button>
                )}
              </div>
              <button type="button" aria-label={t("fermer")} onClick={() => setExpanded(false)} className="rounded-full border border-edge px-2 py-1 text-xs text-ink-muted hover:text-ink">
                ✕
              </button>
            </div>
            {data.mode === "own" ? (
              <MapWorkspace
                worldSlug={worldSlug}
                blockId={blockId}
                otherEntities={otherEntities}
                data={data}
                visibilityLevel={visibilityLevel}
                visibilityScopeId={visibilityScopeId}
                onChange={onChange}
              />
            ) : (
              <MapRefPanel worldSlug={worldSlug} sourceBlockId={data.sourceBlockId} defaultView={data.defaultView} onSaveDefaultView={saveRefDefaultView} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
