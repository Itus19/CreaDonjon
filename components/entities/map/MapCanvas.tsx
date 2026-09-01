"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MapView } from "@/src/core/schemas/blocks/map";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;
/** En dessous de ce deplacement (px), un clic-relache reste un clic — pas un panoramique. */
const DRAG_THRESHOLD = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className={`relative overflow-hidden rounded-md border border-edge/60 bg-panel-sunken ${
        interactive ? (isDragging ? "cursor-grabbing" : "cursor-grab") : ""
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
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
    </div>
  );
}
