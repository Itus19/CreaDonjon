"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MapView } from "@/src/core/schemas/blocks/map";
import type { MapPinSize } from "@/src/core/schemas/mapPin";
import MapPinMarker from "./MapPinMarker";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
/** En dessous de ce deplacement (px), un clic-relache reste un clic — pas un panoramique. */
const DRAG_THRESHOLD = 4;
/** Rayon (px ecran) dans lequel un clic sur le premier sommet ferme le polygone en cours (retour utilisateur : "relier le dernier point sur le premier ferme la zone"). */
const CLOSE_REGION_HIT_RADIUS = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface MapPinMarkerData {
  id: string;
  x: number;
  y: number;
  label: string;
  size: MapPinSize;
  refEntityId?: string | null;
}

export interface MapRegionShapeData {
  id: string;
  name: string;
  shape: { x: number; y: number }[];
  fillColor: string;
  borderColor: string;
  /** V2-I2 (brouillard de guerre) — indicateur MJ seul (jamais fourni pour un viewer joueur/public, qui ne recoit deja plus la zone tant qu'elle n'est pas revelee) : contour en pointilles pour une zone `fogGated` pas encore revelee. */
  unrevealedFog?: boolean;
}

/**
 * Canevas de la carte (Lot I, phase B) — meme motif de pan/zoom que
 * `FamilyTreeCanvas`/`RelationsGraphCanvas`/`TimelineAxis` (ctrl+molette,
 * glisser) : une seule convention d'interaction dans toute l'appli, jamais
 * une quatrieme variante. `initialView` est normalise (0-1, retour
 * utilisateur : "centrer la vue par defaut sur une zone differente dans
 * chacun des blocs map") — converti ici en pan/echelle ecran a l'ouverture
 * seulement, jamais recalcule a chaque rendu (effacerait un panoramique en
 * cours).
 */
export default function MapCanvas({
  imageUrl,
  placeholderUrl,
  imageWidth,
  imageHeight,
  initialView,
  height = 320,
  interactive = true,
  onViewChange,
  pins,
  onPinClick,
  placingPin = false,
  onPlacePin,
  regions,
  onRegionClick,
  drawingRegion = false,
  pendingRegionPoints,
  onAddRegionPoint,
  onFinishRegion,
}: {
  /** Plein format (retour utilisateur, "carte de 4000px, vignette d'abord") — jamais charge sans un `placeholderUrl` deja a l'ecran pour eviter un flash de vide pendant le chargement. */
  imageUrl: string;
  /** Vignette, affichee immediatement et laissee visible sous le plein format tant qu'il n'a pas fini de charger (fondu, jamais un flash bloc-a-bloc). */
  placeholderUrl?: string;
  imageWidth: number;
  imageHeight: number;
  initialView: MapView;
  height?: number | string;
  /** Apercu dans la fiche (retour utilisateur, capture 1) : pas de pan/zoom, juste une vignette figee sur le cadrage par defaut. */
  interactive?: boolean;
  onViewChange?: (view: MapView) => void;
  /** Punaises deja filtrees par visibilite (Lot I, phase C) — positionnees ici, jamais par l'appelant, seul ce composant connait la transformation ecran courante (pan/zoom). */
  pins?: MapPinMarkerData[];
  onPinClick?: (pin: MapPinMarkerData) => void;
  /** Outil « point » actif (retour utilisateur : "un outil de point qui permet d'ajouter des points") — un clic sur le fond (jamais sur une punaise existante) pose une nouvelle punaise a cet endroit. */
  placingPin?: boolean;
  onPlacePin?: (x: number, y: number) => void;
  /** Zones deja filtrees par visibilite (Lot I, phase D) — memes conventions que `pins`. */
  regions?: MapRegionShapeData[];
  onRegionClick?: (region: MapRegionShapeData) => void;
  /** Outil « zone » actif (retour utilisateur : "polygone trace point par point, sommets visibles pendant le trace") — un clic ajoute un sommet ; un clic pres du PREMIER sommet (des que 3 sont deja poses) ferme et termine le polygone. */
  drawingRegion?: boolean;
  /** Polygone en cours (etat du parent, pas de ce composant — le trace survit a un re-rendu du canevas). */
  pendingRegionPoints?: { x: number; y: number }[];
  onAddRegionPoint?: (x: number, y: number) => void;
  onFinishRegion?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [fullLoaded, setFullLoaded] = useState(false);
  // Ajuste un etat pendant le rendu plutot que dans un effet (react.dev,
  // "Adjusting state when a prop changes") : `imageUrl` change quand le
  // plein format devient disponible ou qu'une nouvelle carte est
  // televersee — le fondu doit repartir de zero, jamais un effet qui
  // provoquerait un rendu en cascade evitable.
  const [trackedImageUrl, setTrackedImageUrl] = useState(imageUrl);
  if (imageUrl !== trackedImageUrl) {
    setTrackedImageUrl(imageUrl);
    setFullLoaded(false);
  }
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const fittedForRef = useRef<string | null>(null);

  const signature = `${imageUrl}:${initialView.x}:${initialView.y}:${initialView.zoom}`;

  useLayoutEffect(() => {
    if (fittedForRef.current === signature) return;
    fittedForRef.current = signature;
    const container = containerRef.current;
    if (!container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const baseScale = imageWidth > 0 ? w / imageWidth : 1;
    const scale = clamp(baseScale * initialView.zoom, MIN_ZOOM, MAX_ZOOM);
    const centerPxX = initialView.x * imageWidth;
    const centerPxY = initialView.y * imageHeight;
    setView({ scale, x: w / 2 - centerPxX * scale, y: h / 2 - centerPxY * scale });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, imageWidth, imageHeight]);

  useEffect(() => {
    if (!interactive) return;
    const container = containerRef.current;
    if (!container) return;
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const rect = container!.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      setView((current) => {
        const nextScale = clamp(current.scale * (1 - e.deltaY * 0.001), MIN_ZOOM, MAX_ZOOM);
        const worldX = (cursorX - current.x) / current.scale;
        const worldY = (cursorY - current.y) / current.scale;
        const next = { scale: nextScale, x: cursorX - worldX * nextScale, y: cursorY - worldY * nextScale };
        reportView(next);
        return next;
      });
    }
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);

  function reportView(v: { x: number; y: number; scale: number }) {
    if (!onViewChange) return;
    const container = containerRef.current;
    if (!container || imageWidth === 0) return;
    const w = container.clientWidth;
    const baseScale = w / imageWidth;
    const centerPxX = (w / 2 - v.x) / v.scale;
    const centerPxY = (container.clientHeight / 2 - v.y) / v.scale;
    onViewChange({
      x: clamp(centerPxX / imageWidth, 0, 1),
      y: clamp(centerPxY / imageHeight, 0, 1),
      zoom: clamp(v.scale / baseScale, 0.1, 20),
    });
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (!interactive || e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPanX: view.x, startPanY: view.y, moved: false };
    setIsDragging(true);
  }
  function handleMouseMove(e: React.MouseEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) drag.moved = true;
    if (drag.moved) setView((current) => ({ ...current, x: drag.startPanX + dx, y: drag.startPanY + dy }));
  }
  function endDrag() {
    if (dragRef.current?.moved) {
      suppressClickRef.current = true;
      reportView(view);
    }
    dragRef.current = null;
    setIsDragging(false);
  }

  function eventToNormalizedPoint(e: React.MouseEvent): { x: number; y: number } | null {
    const container = containerRef.current;
    if (!container || imageWidth === 0 || imageHeight === 0) return null;
    const rect = container.getBoundingClientRect();
    return {
      x: clamp((e.clientX - rect.left - view.x) / (imageWidth * view.scale), 0, 1),
      y: clamp((e.clientY - rect.top - view.y) / (imageHeight * view.scale), 0, 1),
    };
  }

  function handleCanvasClick(e: React.MouseEvent) {
    // Un clic sur une punaise/zone existante s'arrete avant d'atteindre ici
    // (`stopPropagation`) — ce gestionnaire ne voit donc que les clics sur
    // le fond de la carte.
    if (placingPin && onPlacePin) {
      const point = eventToNormalizedPoint(e);
      if (point) onPlacePin(point.x, point.y);
      return;
    }
    if (drawingRegion && onAddRegionPoint) {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      // Retour utilisateur : "revenir au premier point posé valide la
      // fermeture" — au moins 3 sommets deja poses (sinon "fermer" sur le
      // premier point degenererait en une ligne, jamais un polygone), et le
      // clic doit tomber pres de l'ECRAN du premier sommet (pas de ses
      // coordonnees normalisees, dont la distance n'a pas de sens visuel
      // une fois zoomee).
      if (onFinishRegion && pendingRegionPoints && pendingRegionPoints.length >= 3) {
        const first = pendingRegionPoints[0];
        const firstScreenX = view.x + first.x * imageWidth * view.scale;
        const firstScreenY = view.y + first.y * imageHeight * view.scale;
        if (Math.hypot(clickX - firstScreenX, clickY - firstScreenY) <= CLOSE_REGION_HIT_RADIUS) {
          onFinishRegion();
          return;
        }
      }
      const point = eventToNormalizedPoint(e);
      if (point) onAddRegionPoint(point.x, point.y);
    }
  }

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className={`relative overflow-hidden rounded-md border border-edge/60 bg-panel-sunken ${
        placingPin || drawingRegion ? "cursor-crosshair" : interactive ? (isDragging ? "cursor-grabbing" : "cursor-grab") : ""
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onClick={handleCanvasClick}
      onClickCapture={(e) => {
        if (suppressClickRef.current) {
          e.preventDefault();
          e.stopPropagation();
          suppressClickRef.current = false;
        }
      }}
    >
      {placeholderUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- image dynamique servie par /api/assets/[id]
        <img
          src={placeholderUrl}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: view.x,
            top: view.y,
            width: imageWidth * view.scale,
            height: imageHeight * view.scale,
            maxWidth: "none",
          }}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- image dynamique servie par /api/assets/[id], jamais connue de next/image a la compilation */}
      <img
        key={imageUrl}
        src={imageUrl}
        alt=""
        draggable={false}
        onLoad={() => setFullLoaded(true)}
        className="transition-opacity duration-300"
        style={{
          position: "absolute",
          left: view.x,
          top: view.y,
          width: imageWidth * view.scale,
          height: imageHeight * view.scale,
          maxWidth: "none",
          opacity: placeholderUrl ? (fullLoaded ? 1 : 0) : 1,
        }}
      />
      {(regions && regions.length > 0) || (pendingRegionPoints && pendingRegionPoints.length > 0) ? (
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          {regions?.map((region) => {
            // Un outil "punaise"/"zone" actif doit pouvoir agir a travers une
            // zone deja tracee (retour utilisateur : impossible de poser une
            // punaise a l'interieur d'une zone existante) — sans ce garde, le
            // polygone interceptait tout clic avant qu'il n'atteigne
            // `handleCanvasClick` sur le conteneur.
            const regionInteractive = !!onRegionClick && !placingPin && !drawingRegion;
            return (
              <polygon
                key={region.id}
                points={region.shape.map((p) => `${view.x + p.x * imageWidth * view.scale},${view.y + p.y * imageHeight * view.scale}`).join(" ")}
                fill={region.fillColor}
                fillOpacity={0.35}
                stroke={region.borderColor}
                strokeWidth={2}
                strokeDasharray={region.unrevealedFog ? "6 4" : undefined}
                className={regionInteractive ? "pointer-events-auto cursor-pointer" : undefined}
                onClick={
                  regionInteractive
                    ? (e) => {
                        e.stopPropagation();
                        onRegionClick?.(region);
                      }
                    : undefined
                }
              />
            );
          })}
          {pendingRegionPoints && pendingRegionPoints.length > 0 && (
            <>
              <polyline
                points={pendingRegionPoints.map((p) => `${view.x + p.x * imageWidth * view.scale},${view.y + p.y * imageHeight * view.scale}`).join(" ")}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
              {pendingRegionPoints.map((p, i) => (
                <circle
                  key={i}
                  cx={view.x + p.x * imageWidth * view.scale}
                  cy={view.y + p.y * imageHeight * view.scale}
                  // Le premier sommet grossit des que la fermeture devient
                  // possible (retour utilisateur) — indique visuellement ou
                  // cliquer pour terminer le polygone.
                  r={i === 0 && pendingRegionPoints.length >= 3 ? CLOSE_REGION_HIT_RADIUS : 4}
                  fill={i === 0 && pendingRegionPoints.length >= 3 ? "none" : "var(--accent)"}
                  stroke={i === 0 && pendingRegionPoints.length >= 3 ? "var(--accent)" : undefined}
                  strokeWidth={i === 0 && pendingRegionPoints.length >= 3 ? 2 : undefined}
                />
              ))}
            </>
          )}
        </svg>
      ) : null}
      {pins?.map((pin) => (
        <MapPinMarker
          key={pin.id}
          label={pin.label}
          size={pin.size}
          refEntityId={pin.refEntityId}
          left={view.x + pin.x * imageWidth * view.scale}
          top={view.y + pin.y * imageHeight * view.scale}
          onClick={() => onPinClick?.(pin)}
        />
      ))}
    </div>
  );
}
